"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuthUserFromCookies, requireRole } from "@/lib/auth";
import { assertAccesoAPersona } from "@/lib/persona-access";
import { createPersona as createPersonaService } from "@/services/persona.service";
import {
  updateMedidasBasicas,
  updateNivelOverride,
  updateDisponibilidad,
  type DisponibilidadInput,
} from "@/services/persona.service";
import { guardarYVincularAtleta } from "@/services/atleta-compartido.service";
import { isUserLevel } from "@/lib/user-level";

export type EntryState = {
  error: string | null;
  redirectTo: string | null;
  submittedCC: string;
};

export type RegistroState = {
  error: string | null;
  redirectTo: string | null;
};

export type MedidasBasicasState = {
  error: string | null;
  success: boolean;
  masaCorporal: number | null;
  talla: number | null;
};

type CreatePersonaInput = {
  cc: string;
  nombre: string;
  sexo: string;
  masaCorporal: number;
  edad: number;
  talla: number;
  entrenado: boolean;
};

function normalizeCC(value: string) {
  return value.trim();
}

function toFiniteNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return Number.NaN;
  }

  return Number(value);
}

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

// Los servicios no conocen la sesión: comprobar aquí el vínculo del entrenador.
async function assertPuedeEditarPersonaPorCC(cc: string): Promise<void> {
  const authUser = await getAuthUserFromCookies();
  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: { id: true },
  });

  if (!persona) {
    throw new Error("No existe una persona con ese CC.");
  }

  await assertAccesoAPersona(authUser, persona.id);
}

function parseCreatePersonaInput(
  formData: FormData,
): { ok: true; data: CreatePersonaInput } | { ok: false; error: string } {
  const cc = normalizeCC(getString(formData.get("cc")));
  const nombre = getString(formData.get("nombre"));
  const sexo = getString(formData.get("sexo"));
  const masaCorporal = toFiniteNumber(formData.get("masaCorporal"));
  const edad = toFiniteNumber(formData.get("edad"));
  const talla = toFiniteNumber(formData.get("talla"));
  const entrenado = false;

  if (!cc) {
    return { ok: false, error: "El CC es obligatorio." };
  }

  if (!nombre) {
    return { ok: false, error: "El nombre es obligatorio." };
  }

  if (!sexo) {
    return { ok: false, error: "El sexo es obligatorio." };
  }

  return {
    ok: true,
    data: {
      cc,
      nombre,
      sexo,
      masaCorporal,
      edad,
      talla,
      entrenado,
    },
  };
}

export async function checkPersonaByCC(cc: string) {
  await requireRole(["admin", "entrenador"]);
  const normalizedCC = normalizeCC(cc);

  if (!normalizedCC) {
    return false;
  }

  const persona = await prisma.persona.findUnique({
    where: { cc: normalizedCC },
    select: { id: true },
  });

  return Boolean(persona);
}

export async function getPersonaByCC(cc: string) {
  await requireRole(["admin", "entrenador"]);
  const normalizedCC = normalizeCC(cc);

  if (!normalizedCC) {
    return null;
  }

  return prisma.persona.findUnique({
    where: { cc: normalizedCC },
    select: {
      id: true,
      cc: true,
    },
  });
}

export async function getSessionDatesByCC(cc: string) {
  await requireRole(["admin", "entrenador"]);
  const normalizedCC = normalizeCC(cc);

  if (!normalizedCC) {
    return [] as Date[];
  }

  const sesiones = await prisma.sesion.findMany({
    where: {
      persona: {
        cc: normalizedCC,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
    },
  });

  return sesiones.map((sesion) => sesion.createdAt);
}

export async function createPersona(
  data: CreatePersonaInput,
): Promise<{ ok: true; cc: string } | { ok: false; error: string }> {
  try {
    const authUser = await requireRole(["admin", "entrenador"]);
    const persona = await createPersonaService({
      ...data,
      entrenadorId: authUser.userId,
    });

    return { ok: true, cc: persona.cc };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible registrar el usuario. Intenta nuevamente.",
    };
  }
}

export async function resolvePersonaEntry(
  _prevState: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const cc = normalizeCC(getString(formData.get("cc")));

  if (!cc) {
    return {
      error: "Debes ingresar un numero de identificacion.",
      redirectTo: null,
      submittedCC: "",
    };
  }

  await requireRole(["admin", "entrenador"]);

  redirect(`/registro?cc=${encodeURIComponent(cc)}`);
}

export async function createPersonaAction(
  _prevState: RegistroState,
  formData: FormData,
): Promise<RegistroState> {
  const parsedInput = parseCreatePersonaInput(formData);

  if (!parsedInput.ok) {
    return {
      error: parsedInput.error,
      redirectTo: null,
    };
  }

  const result = await createPersona(parsedInput.data);

  if (!result.ok) {
    return {
      error: result.error,
      redirectTo: null,
    };
  }

  redirect(`/dashboard?cc=${encodeURIComponent(result.cc)}`);
}

export async function actualizarMedidasBasicasAction(
  _prevState: MedidasBasicasState,
  formData: FormData,
): Promise<MedidasBasicasState> {
  const cc = normalizeCC(getString(formData.get("cc")));

  if (!cc) {
    return {
      error: "Debes enviar el CC de la persona.",
      success: false,
      masaCorporal: null,
      talla: null,
    };
  }

  const masaCorporal = toFiniteNumber(formData.get("masaCorporal"));
  const talla = toFiniteNumber(formData.get("talla"));

  try {
    await assertPuedeEditarPersonaPorCC(cc);
    const persona = await updateMedidasBasicas(cc, { masaCorporal, talla });

    return {
      error: null,
      success: true,
      masaCorporal: persona.masaCorporal,
      talla: persona.talla,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No fue posible actualizar los datos. Intenta nuevamente.",
      success: false,
      masaCorporal: null,
      talla: null,
    };
  }
}

export async function updateNivelOverrideAction(cc: string, nivel: string | null) {
  const normalizedCC = normalizeCC(cc);

  if (!normalizedCC) {
    throw new Error("El CC es obligatorio.");
  }

  const parsedNivel = nivel !== null && isUserLevel(nivel) ? nivel : null;

  await assertPuedeEditarPersonaPorCC(normalizedCC);
  await updateNivelOverride(normalizedCC, parsedNivel);

  revalidatePath("/dashboard");
  revalidatePath("/sesion/[id]", "page");
}

// TASK-051/D-14: avanzarAFuerzaAction y updateFaseEntrenamientoAction se
// retiraron — eran un sistema de progresión paralelo e independiente del
// mesociclo activo (avance automático a los 60 días, o botones manuales sin
// relación con el plan real del atleta). Ver docs/DECISIONES.md.

export type DisponibilidadState = {
  error: string | null;
  success: boolean;
};

/** TASK-025 · C-12: disponibilidad y contexto del atleta, insumo del motor de planificación (M5). */
export async function actualizarDisponibilidadAction(
  _prevState: DisponibilidadState,
  formData: FormData,
): Promise<DisponibilidadState> {
  const cc = normalizeCC(getString(formData.get("cc")));

  if (!cc) {
    return { error: "Debes enviar el CC de la persona.", success: false };
  }

  const equipamientoRaw = getString(formData.get("equipamiento"));
  const input: DisponibilidadInput = {
    mesesEntrenamiento: Math.trunc(toFiniteNumber(formData.get("mesesEntrenamiento"))),
    diasDisponibles: Math.trunc(toFiniteNumber(formData.get("diasDisponibles"))),
    minutosPorSesion: Math.trunc(toFiniteNumber(formData.get("minutosPorSesion"))),
    equipamiento: equipamientoRaw
      ? equipamientoRaw.split(",").map((v) => v.trim()).filter(Boolean)
      : [],
    limitaciones: getString(formData.get("limitaciones")) || null,
  };

  try {
    await assertPuedeEditarPersonaPorCC(cc);
    await updateDisponibilidad(cc, input);
    revalidatePath("/dashboard");
    return { error: null, success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No fue posible actualizar la disponibilidad. Intenta nuevamente.",
      success: false,
    };
  }
}

export async function guardarAtletaCompartidoAction(
  _prevState: RegistroState,
  formData: FormData,
): Promise<RegistroState> {
  const cc = normalizeCC(getString(formData.get("cc")));
  try {
    const autor = await requireRole(["admin", "entrenador"]);
    const editar = formData.get("operacion") === "guardar";
    const version = getString(formData.get("version"));
    if (editar && !Number.isFinite(Date.parse(version))) {
      throw new Error("Recarga la ficha antes de guardar.");
    }
    await guardarYVincularAtleta({
      cc, version, autor,
      datos: editar ? {
        nombre: getString(formData.get("nombre")),
        sexo: getString(formData.get("sexo")),
        masaCorporal: toFiniteNumber(formData.get("masaCorporal")),
        edad: toFiniteNumber(formData.get("edad")),
        talla: toFiniteNumber(formData.get("talla")),
      } : undefined,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No fue posible guardar el atleta.", redirectTo: null };
  }
  revalidatePath("/atletas");
  revalidatePath("/admin");
  revalidatePath("/admin/personas");
  revalidatePath("/dashboard");
  revalidatePath("/registro");
  redirect(`/dashboard?cc=${encodeURIComponent(cc)}`);
}

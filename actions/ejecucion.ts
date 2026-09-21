"use server";

import { revalidatePath } from "next/cache";

import { getAuthUserFromCookies } from "@/lib/auth";
import { assertAccesoAPersona } from "@/lib/persona-access";
import { prisma } from "@/lib/prisma";
import {
  crearSesionRealizada,
  guardarWodSesionPlanificada,
  omitirSesionRealizada,
  registrarSerie,
} from "@/services/ejecucion.service";
import {
  evaluarDeloadReactivoPorSesion,
  evaluarDisponibilidadPorSesion,
  evaluarYProponerAjustesPorSesion,
} from "@/services/progresion.service";
import {
  codificarMotivoOmision,
  esCodigoMotivoOmision,
  type CodigoMotivoOmision,
} from "@/lib/ejecucion";

async function getPersonaDeSesionPlanificada(sesionPlanificadaId: number) {
  const sesionPlanificada = await prisma.sesionPlanificada.findUniqueOrThrow({
    where: { id: sesionPlanificadaId },
    select: {
      semana: {
        select: { macrociclo: { select: { personaId: true } } },
      },
    },
  });
  return sesionPlanificada.semana.macrociclo.personaId;
}

// ADR-52: estas acciones solo reciben ids numéricos (sesionPlanificadaId /
// sesionRealizadaId), sin el cc que permitiría filtrar por dueño como en
// otras partes de la app. Se resuelve la Persona detrás de ese id y se
// verifica ahí.
async function assertAccesoAPersonaId(personaId: number): Promise<void> {
  const authUser = await getAuthUserFromCookies();
  const persona = await prisma.persona.findUnique({
    where: { id: personaId },
    select: { id: true },
  });

  if (!persona) {
    throw new Error("Persona no encontrada.");
  }

  await assertAccesoAPersona(authUser, persona.id);
}

async function getPersonaDeSesionRealizada(sesionRealizadaId: number) {
  const sesionRealizada = await prisma.sesionRealizada.findUniqueOrThrow({
    where: { id: sesionRealizadaId },
    select: { personaId: true },
  });
  return sesionRealizada.personaId;
}

/**
 * P-07 · TASK-041: obtiene la SesionRealizada "en curso" para esta
 * SesionPlanificada, o crea una nueva si no existe todavía.
 */
export async function iniciarOContinuarSesionAction(
  sesionPlanificadaId: number,
): Promise<{ ok: true; sesionRealizadaId: number } | { ok: false; error: string }> {
  try {
    const personaId = await getPersonaDeSesionPlanificada(sesionPlanificadaId);
    await assertAccesoAPersonaId(personaId);

    const existente = await prisma.sesionRealizada.findFirst({
      where: { sesionPlanificadaId, estado: { in: ["parcial"] } },
      orderBy: { createdAt: "desc" },
    });

    if (existente) {
      return { ok: true, sesionRealizadaId: existente.id };
    }

    const creada = await crearSesionRealizada({
      personaId,
      sesionPlanificadaId,
      estado: "parcial",
    });

    return { ok: true, sesionRealizadaId: creada.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible iniciar la sesión.",
    };
  }
}

export type RegistrarSerieActionInput = {
  sesionRealizadaId: number;
  prescripcionId: number | null;
  ejercicioId: number;
  numeroSerie: number;
  cargaKg: number;
  repeticiones: number;
  rir: number | null;
  fallo: boolean;
  requestId: string;
};

export async function registrarSerieAction(
  input: RegistrarSerieActionInput,
): Promise<{ ok: true; e1rmKg: number | null } | { ok: false; error: string }> {
  try {
    const sesionRealizada = await prisma.sesionRealizada.findUniqueOrThrow({
      where: { id: input.sesionRealizadaId },
      select: { personaId: true },
    });
    await assertAccesoAPersonaId(sesionRealizada.personaId);

    const serie = await registrarSerie(
      {
        sesionRealizadaId: input.sesionRealizadaId,
        prescripcionId: input.prescripcionId,
        ejercicioId: input.ejercicioId,
        numeroSerie: input.numeroSerie,
        cargaKg: input.cargaKg,
        repeticiones: input.repeticiones,
        rir: input.rir,
        fallo: input.fallo,
        requestId: input.requestId,
      },
      sesionRealizada.personaId,
    );

    return { ok: true, e1rmKg: serie.e1rmKg };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible registrar la serie.",
    };
  }
}

export async function completarSesionAction(
  sesionRealizadaId: number,
  cc: string,
  rpeSesion: number | null = null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAccesoAPersonaId(
      await getPersonaDeSesionRealizada(sesionRealizadaId),
    );

    const sesionRealizada = await prisma.sesionRealizada.update({
      where: { id: sesionRealizadaId },
      data: { estado: "completa", rpeSesion },
      select: { sesionPlanificadaId: true },
    });

    if (sesionRealizada.sesionPlanificadaId) {
      await prisma.sesionPlanificada.update({
        where: { id: sesionRealizada.sesionPlanificadaId },
        data: { estado: "realizada" },
      });
    }

    // R-13: evalúa el rendimiento de esta sesión contra la anterior y
    // propone ajustes (nunca los aplica solo, AC-20).
    await evaluarYProponerAjustesPorSesion(sesionRealizadaId);
    // R-13 (disponibilidad) y R-10 (deload reactivo): señales a nivel de
    // microciclo/atleta que una sola sesión no puede evaluar por sí sola.
    await evaluarDisponibilidadPorSesion(sesionRealizadaId);
    await evaluarDeloadReactivoPorSesion(sesionRealizadaId);

    revalidatePath(`/dashboard?cc=${encodeURIComponent(cc)}`);
    revalidatePath(`/ajustes?cc=${encodeURIComponent(cc)}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible completar la sesión.",
    };
  }
}

/**
 * P-07 · registra que una sesión planificada no se hizo, con un motivo
 * codificado (ver lib/ejecucion.ts) para que R-13/R-10 puedan usarlo.
 */
export async function omitirSesionAction(
  sesionRealizadaId: number,
  cc: string,
  motivoCodigo: string,
  motivoDetalle: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!esCodigoMotivoOmision(motivoCodigo)) {
      return { ok: false, error: "Selecciona un motivo válido." };
    }

    await assertAccesoAPersonaId(
      await getPersonaDeSesionRealizada(sesionRealizadaId),
    );

    const motivo = codificarMotivoOmision(
      motivoCodigo as CodigoMotivoOmision,
      motivoDetalle,
    );
    await omitirSesionRealizada(sesionRealizadaId, motivo);

    // R-13: una sesión omitida puede hacer cruzar el umbral de
    // disponibilidad del microciclo.
    await evaluarDisponibilidadPorSesion(sesionRealizadaId);

    revalidatePath(`/dashboard?cc=${encodeURIComponent(cc)}`);
    revalidatePath(`/ajustes?cc=${encodeURIComponent(cc)}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No fue posible registrar la sesión omitida.",
    };
  }
}

/** ADR-49 · Guarda el WOD que el entrenador escribió para esta sesión. */
export async function guardarWodAction(
  sesionPlanificadaId: number,
  cc: string,
  wod: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAccesoAPersonaId(
      await getPersonaDeSesionPlanificada(sesionPlanificadaId),
    );
    await guardarWodSesionPlanificada(sesionPlanificadaId, wod);
    revalidatePath(`/entrenamiento/${sesionPlanificadaId}?cc=${encodeURIComponent(cc)}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible guardar el WOD.",
    };
  }
}

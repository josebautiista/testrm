"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { calculateRM, calculateRMForSession, roundToTwo } from "@/lib/rm";
import { estimarRm } from "@/lib/rm/estimacion";
import { actualizarRmVigente } from "@/services/rm.service";

type RMMethod = "estimation" | "casas" | "nacleiro";

type ResultadoInput = {
  ejercicioId: number;
  repeticiones: number;
  carga: number;
  pesoEquipo: number;
  casas: number;
  nacleiro: number;
};

type CreateSesionInput = {
  cc: string;
  requestId: string;
  peso: number;
  trainingMonths: number;
  rmMethod: RMMethod;
  estimatedRM: number;
  finalRM: number;
  protocolData: Prisma.InputJsonValue | null;
  ejercicios: ResultadoInput[];
  macrocicloId?: number | null;
  returnTo?: string | null;
};

type CreateSesionResult = {
  success: true;
  sesionId: number;
};

function normalizeCC(value: string) {
  return value.trim();
}

function normalizeRequestId(value: string) {
  return value.trim();
}

function parseNonNegativeInt(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
}

function parseNonNegativeNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return 0;
  }

  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

function toPositiveInt(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);
  if (rounded <= 0) {
    return null;
  }

  return rounded;
}

function parseRMMethod(value: FormDataEntryValue | null, trainingMonths: number): RMMethod {
  if (trainingMonths < 4) {
    return "estimation";
  }

  if (value === "casas" || value === "nacleiro") {
    return value;
  }

  return "estimation";
}

function parseProtocolData(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}

function getFormulaRM(
  input: ResultadoInput,
  sexo: string,
  ejerciciosSinCarga: ReadonlySet<number>,
) {
  const carga = ejerciciosSinCarga.has(input.ejercicioId)
    ? 0
    : input.carga + input.pesoEquipo;
  const rm = calculateRM(carga, input.repeticiones, sexo);
  return {
    ...rm,
    // D-02: la estimación puntual es la fórmula primaria (Epley), nunca el
    // máximo entre fórmulas — max() sesga sistemáticamente al alza.
    // Ver lib/rm/estimacion.ts y ADR-01/ADR-02 en docs/DECISIONES.md.
    estimated: rm.epley,
  };
}

function parseCreateSesionInput(
  formData: FormData,
):
  | { ok: true; data: CreateSesionInput }
  | { ok: false; error: string; cc: string } {
  const cc = normalizeCC(
    typeof formData.get("cc") === "string"
      ? (formData.get("cc") as string)
      : "",
  );
  const requestId = normalizeRequestId(
    typeof formData.get("requestId") === "string"
      ? (formData.get("requestId") as string)
      : "",
  );
  const rawPeso = formData.get("peso");
  const peso = typeof rawPeso === "string" ? Number(rawPeso.trim()) : NaN;
  const trainingMonths = parseNonNegativeInt(formData.get("trainingMonths"));
  const rmMethod = parseRMMethod(formData.get("rmMethod"), trainingMonths);
  const estimatedRM = parseNonNegativeNumber(formData.get("estimatedRM"));
  const finalRM = parseNonNegativeNumber(formData.get("finalRM"));
  const protocolData = parseProtocolData(formData.get("protocolData"));
  const rawMacrocicloId = formData.get("macrocicloId");
  const macrocicloId =
    typeof rawMacrocicloId === "string" && rawMacrocicloId.trim() !== ""
      ? Number(rawMacrocicloId.trim())
      : null;
  const returnTo =
    typeof formData.get("returnTo") === "string"
      ? formData.get("returnTo")?.toString().trim() || null
      : null;

  if (!cc) {
    return { ok: false, error: "Cédula inválida.", cc: "" };
  }

  if (!requestId) {
    return {
      ok: false,
      error: "No fue posible preparar el envío de la sesión.",
      cc,
    };
  }

  if (!Number.isFinite(peso) || peso <= 0) {
    return { ok: false, error: "Peso inválido.", cc };
  }

  const resultados: ResultadoInput[] = [];

  for (const rawId of formData.getAll("ejercicioIds")) {
    if (typeof rawId !== "string") {
      continue;
    }

    const ejercicioId = Number(rawId);
    if (!Number.isInteger(ejercicioId) || ejercicioId <= 0) {
      continue;
    }

    resultados.push({
      ejercicioId,
      repeticiones: parseNonNegativeInt(
        formData.get(`repeticiones_${ejercicioId}`),
      ),
      carga: parseNonNegativeNumber(formData.get(`carga_${ejercicioId}`)),
      pesoEquipo: parseNonNegativeNumber(
        formData.get(`pesoEquipo_${ejercicioId}`),
      ),
      casas: parseNonNegativeNumber(formData.get(`casas_${ejercicioId}`)),
      nacleiro: parseNonNegativeNumber(formData.get(`nacleiro_${ejercicioId}`)),
    });
  }

  if (rmMethod === "estimation" && resultados.length === 0) {
    return {
      ok: false,
      error: "No se encontraron ejercicios válidos para registrar.",
      cc,
    };
  }

  if (rmMethod !== "estimation" && finalRM <= 0) {
    return {
      ok: false,
      error: "Debes completar el protocolo para registrar el RM final.",
      cc,
    };
  }

  return {
    ok: true,
    data: {
      cc,
      requestId,
      peso,
      trainingMonths,
      rmMethod,
      estimatedRM,
      finalRM,
      protocolData,
      ejercicios: resultados,
      macrocicloId: macrocicloId && Number.isInteger(macrocicloId) && macrocicloId > 0 ? macrocicloId : null,
      returnTo,
    },
  };
}

function sanitizeInputEjercicios(ejercicios: unknown): ResultadoInput[] {
  if (!Array.isArray(ejercicios)) {
    return [];
  }

  const sanitized: ResultadoInput[] = [];

  for (const item of ejercicios) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const rawEjercicioId = (item as { ejercicioId?: unknown }).ejercicioId;
    const ejercicioId = toPositiveInt(
      typeof rawEjercicioId === "number"
        ? rawEjercicioId
        : Number(rawEjercicioId),
    );

    if (!ejercicioId) {
      continue;
    }

    const rawRepeticiones = (item as { repeticiones?: unknown }).repeticiones;
    const rawCarga = (item as { carga?: unknown }).carga;
    const rawPesoEquipo = (item as { pesoEquipo?: unknown }).pesoEquipo;
    const rawCasas = (item as { casas?: unknown }).casas;
    const rawNacleiro = (item as { nacleiro?: unknown }).nacleiro;
    const repeticionesNumber =
      typeof rawRepeticiones === "number"
        ? rawRepeticiones
        : Number(rawRepeticiones);
    const cargaNumber =
      typeof rawCarga === "number" ? rawCarga : Number(rawCarga);
    const pesoEquipoNumber =
      typeof rawPesoEquipo === "number" ? rawPesoEquipo : Number(rawPesoEquipo);
    const casasNumber =
      typeof rawCasas === "number" ? rawCasas : Number(rawCasas);
    const nacleiroNumber =
      typeof rawNacleiro === "number" ? rawNacleiro : Number(rawNacleiro);

    sanitized.push({
      ejercicioId,
      repeticiones: Number.isFinite(repeticionesNumber)
        ? Math.max(0, Math.floor(repeticionesNumber))
        : 0,
      carga: Number.isFinite(cargaNumber) ? Math.max(0, cargaNumber) : 0,
      pesoEquipo: Number.isFinite(pesoEquipoNumber)
        ? Math.max(0, pesoEquipoNumber)
        : 0,
      casas: Number.isFinite(casasNumber) ? Math.max(0, casasNumber) : 0,
      nacleiro: Number.isFinite(nacleiroNumber)
        ? Math.max(0, nacleiroNumber)
        : 0,
    });
  }

  return sanitized;
}

export async function createSesion(
  input: CreateSesionInput,
): Promise<CreateSesionResult> {
  const cc = normalizeCC(typeof input.cc === "string" ? input.cc : "");
  const requestId = normalizeRequestId(
    typeof input.requestId === "string" ? input.requestId : "",
  );
  const sanitizedEjercicios = sanitizeInputEjercicios(input.ejercicios);
  const trainingMonths = Number.isFinite(input.trainingMonths)
    ? Math.max(0, Math.floor(input.trainingMonths))
    : 0;
  const rmMethod = parseRMMethod(input.rmMethod, trainingMonths);

  if (!cc) {
    throw new Error("CC invalido.");
  }

  if (!requestId) {
    throw new Error("No fue posible preparar el envio de la sesion.");
  }

  if (rmMethod === "estimation" && sanitizedEjercicios.length === 0) {
    throw new Error("No se encontraron ejercicios validos para registrar.");
  }

  try {
    const createdSesion = await prisma.$transaction(async (tx) => {
      const persona = await tx.persona.findUnique({
        where: { cc },
        select: {
          id: true,
          masaCorporal: true,
          sexo: true,
          faseEntrenamiento: true,
        },
      });

      if (!persona) {
        throw new Error("Usuario no encontrado.");
      }

      const ejerciciosDB = await tx.ejercicio.findMany({
        select: {
          id: true,
          porcentajeMasaHombre: true,
          porcentajeMasaMujer: true,
          esDeTiempo: true,
        },
      });
      const ejerciciosSinCarga = new Set(
        ejerciciosDB.filter((e) => e.esDeTiempo).map((e) => e.id),
      );

      const fallbackResults = calculateRMForSession(
        input.peso,
        ejerciciosDB,
        sanitizedEjercicios,
        persona.sexo,
      );
      const fallbackByExercise = new Map(
        fallbackResults.map((item) => [item.ejercicioId, item]),
      );

      const ejerciciosPermitidos = new Set(
        sanitizedEjercicios.map((item) => item.ejercicioId),
      );

      const resultadosData = sanitizedEjercicios
        .filter((item) => ejerciciosPermitidos.has(item.ejercicioId))
        .map((item) => {
          const fallback = fallbackByExercise.get(item.ejercicioId);
          const withoutLoad = ejerciciosSinCarga.has(item.ejercicioId);
          const pesoLevantado = item.carga > 0 ? item.carga : fallback?.carga ?? 0;
          const pesoEquipo = withoutLoad ? 0 : item.pesoEquipo;
          const carga = withoutLoad ? 0 : pesoLevantado + pesoEquipo;
          const formula = calculateRM(carga, item.repeticiones, persona.sexo);
          // C-03/M4: estimador único con banda e incertidumbre, guardado
          // junto a las 8 fórmulas de referencia. withoutLoad (esDeTiempo)
          // no produce un RM utilizable (D-17/esDeTiempo).
          const estimacion = withoutLoad
            ? null
            : estimarRm(carga, item.repeticiones, { sexo: persona.sexo });

          return {
            ejercicioId: item.ejercicioId,
            repeticiones: item.repeticiones,
            carga: roundToTwo(carga),
            pesoEquipo: roundToTwo(pesoEquipo),
            epley: roundToTwo(formula.epley),
            brzycki: roundToTwo(formula.brzycki),
            lombardi: roundToTwo(formula.lombardi),
            lander: roundToTwo(formula.lander),
            oconnor: roundToTwo(formula.oconnor),
            mayhew: roundToTwo(formula.mayhew),
            wathen: roundToTwo(formula.wathen),
            baechle: roundToTwo(formula.baechle),
            casas: roundToTwo(rmMethod === "casas" ? item.casas : 0),
            nacleiro: roundToTwo(rmMethod === "nacleiro" ? item.nacleiro : 0),
            rm1Estimado: estimacion ? roundToTwo(estimacion.valor) : null,
            rmMin: estimacion ? roundToTwo(estimacion.min) : null,
            rmMax: estimacion ? roundToTwo(estimacion.max) : null,
            confianza: estimacion?.confianza ?? null,
            formulaPrimaria: estimacion ? "epley" : null,
            fueraDeRango: estimacion?.fueraDeRango ?? false,
          };
        });

      if (rmMethod === "estimation" && resultadosData.length === 0) {
        throw new Error(
          "No se pudieron preparar resultados validos para la sesion.",
        );
      }

      await tx.persona.update({
        where: { id: persona.id },
        data: {
          masaCorporal: input.peso,
          // D-15: guardar una sesión no debe borrar en silencio el
          // nivelOverride que el entrenador fijó a mano.
          ...(persona.faseEntrenamiento === null
            ? { faseEntrenamiento: "resistencia", faseInicioAt: new Date() }
            : {}),
        },
      });

      // D-01: Sesion.estimatedRM/finalRM ya no se calculan como el máximo
      // entre ejercicios distintos (ese escalar no tiene sentido físico: la
      // prensa de pierna dominaría siempre sobre press banca). El RM de cada
      // ejercicio ya vive en su propio ResultadoEjercicio. Solo se persiste
      // un valor a nivel de sesión cuando es inequívoco: un único ejercicio
      // evaluado, o un protocolo Casas/Nacleiro sobre un ejercicio de
      // referencia (sanitizedEjercicios vacío en ese caso).
      const primerEjercicio =
        sanitizedEjercicios.length === 1 ? sanitizedEjercicios[0] : null;
      const estimatedRM = primerEjercicio
        ? getFormulaRM(primerEjercicio, persona.sexo, ejerciciosSinCarga).estimated
        : sanitizedEjercicios.length === 0
          ? input.estimatedRM
          : 0;
      const finalRM = primerEjercicio
        ? getFormulaRM(primerEjercicio, persona.sexo, ejerciciosSinCarga).estimated
        : sanitizedEjercicios.length === 0
          ? input.finalRM
          : 0;

      const creada = await tx.sesion.create({
        data: {
          personaId: persona.id,
          peso: input.peso,
          requestId,
          trainingMonths,
          rmMethod,
          estimatedRM: estimatedRM > 0 ? roundToTwo(estimatedRM) : null,
          finalRM: finalRM > 0 ? roundToTwo(finalRM) : null,
          protocolData: input.protocolData ?? Prisma.JsonNull,
          createdAt: new Date(),
          resultados: {
            create: resultadosData,
          },
        },
        select: {
          id: true,
          createdAt: true,
          resultados: {
            select: {
              id: true,
              ejercicioId: true,
              rm1Estimado: true,
              confianza: true,
              fueraDeRango: true,
            },
          },
        },
      });

      // M4/TASK-022: cada resultado con una estimación utilizable pasa a
      // ser el RM vigente de ese ejercicio (D-01: nunca uno global). Un
      // resultado fuera de rango no reemplaza el vigente (D-04/AC-06).
      for (const resultado of creada.resultados) {
        if (
          resultado.rm1Estimado === null ||
          resultado.rm1Estimado <= 0 ||
          resultado.fueraDeRango ||
          !(resultado.confianza === "alta" || resultado.confianza === "media" || resultado.confianza === "baja")
        ) {
          continue;
        }

        await actualizarRmVigente(tx, {
          personaId: persona.id,
          ejercicioId: resultado.ejercicioId,
          valorKg: resultado.rm1Estimado,
          origen: "estimacion",
          confianza: resultado.confianza,
          resultadoRmId: resultado.id,
          fecha: creada.createdAt,
        });
      }

      return { id: creada.id };
    });

    return {
      success: true,
      sesionId: createdSesion.id,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingSesion = await prisma.sesion.findUnique({
        where: {
          requestId,
        },
        select: {
          id: true,
        },
      });

      if (existingSesion) {
        return {
          success: true,
          sesionId: existingSesion.id,
        };
      }

      throw new Error("No fue posible guardar la sesion. Intenta nuevamente.");
    }

    if (error instanceof Error) {
      if (
        error.message === "CC invalido." ||
        error.message ===
          "No se encontraron ejercicios validos para registrar." ||
        error.message === "Usuario no encontrado." ||
        error.message ===
          "No se pudieron preparar resultados validos para la sesion."
      ) {
        throw error;
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[createSesion Prisma Error]", error);
      throw new Error("No fue posible guardar la sesion. Intenta nuevamente.");
    }

    console.error("[createSesion Unexpected Error]", error);
    throw new Error("Error inesperado al crear la sesion.");
  }
}

export async function createSesionAction(formData: FormData) {
  const parsed = parseCreateSesionInput(formData);

  if (!parsed.ok) {
    const fallbackCC = parsed.cc ? `?cc=${encodeURIComponent(parsed.cc)}` : "";
    const separator = fallbackCC ? "&" : "?";
    redirect(
      `/nueva-sesion${fallbackCC}${separator}error=${encodeURIComponent(parsed.error)}`,
    );
  }

  let saveError: string | null = null;
  let result: CreateSesionResult | null = null;

  try {
    result = await createSesion(parsed.data);
  } catch (error) {
    saveError =
      error instanceof Error
        ? error.message
        : "No fue posible crear la sesion. Intenta nuevamente.";
  }

  if (saveError || !result) {
    const errorMessage =
      saveError ?? "No fue posible crear la sesión. Intenta nuevamente.";
    redirect(
      `/nueva-sesion?cc=${encodeURIComponent(parsed.data.cc)}&error=${encodeURIComponent(errorMessage)}`,
    );
  }

  if (
    parsed.data.returnTo === "macrociclo" &&
    parsed.data.macrocicloId &&
    result?.sesionId
  ) {
    redirect(
      `/macrociclo/${parsed.data.macrocicloId}/editar?cc=${encodeURIComponent(parsed.data.cc)}&paso=2`,
    );
  }

  redirect(
    `/dashboard?cc=${encodeURIComponent(parsed.data.cc)}&saved=1&sesionId=${result.sesionId}`,
  );
}

export async function deleteSesionAction(formData: FormData) {
  const rawSesionId = formData.get("sesionId");
  const rawCC = formData.get("cc");
  const sesionId = typeof rawSesionId === "string" ? Number(rawSesionId) : NaN;
  const cc = typeof rawCC === "string" ? normalizeCC(rawCC) : "";

  if (!cc) {
    redirect("/atletas");
  }

  if (!Number.isInteger(sesionId) || sesionId <= 0) {
    redirect(`/dashboard?cc=${encodeURIComponent(cc)}&deleteError=1`);
  }

  await prisma.sesion.deleteMany({
    where: {
      id: sesionId,
      persona: {
        cc,
      },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard?cc=${encodeURIComponent(cc)}&deleted=1`);
}

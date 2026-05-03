"use server";

import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "@prisma/client";

import { calculateRM, calculateRMForSession, roundToTwo } from "@/lib/rm";

type RMMethod = "estimation" | "casas" | "nacleiro";

type ResultadoInput = {
  ejercicioId: number;
  repeticiones: number;
  carga: number;
  casas: number;
  nacleiro: number;
};

type CreateSesionInput = {
  cc: string;
  requestId: string;
  peso: number;
  trainingMonths: number;
  rmMethod: RMMethod;
  protocolData: Prisma.InputJsonValue | null;
  ejercicios: ResultadoInput[];
};

type CreateSesionResult = {
  success: true;
  sesionId: number;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const adapter = new PrismaMariaDb(databaseUrl);
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

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

function getFormulaRM(input: ResultadoInput, sexo: string) {
  const rm = calculateRM(input.carga, input.repeticiones, sexo);
  return {
    ...rm,
    estimated: Math.max(rm.epley, rm.brzycki),
  };
}

function getFinalRM(input: ResultadoInput, rmMethod: RMMethod, sexo: string) {
  if (rmMethod === "casas" && input.casas > 0) {
    return input.casas;
  }

  if (rmMethod === "nacleiro" && input.nacleiro > 0) {
    return input.nacleiro;
  }

  return getFormulaRM(input, sexo).estimated;
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
  const protocolData = parseProtocolData(formData.get("protocolData"));

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
      casas: parseNonNegativeNumber(formData.get(`casas_${ejercicioId}`)),
      nacleiro: parseNonNegativeNumber(formData.get(`nacleiro_${ejercicioId}`)),
    });
  }

  if (resultados.length === 0) {
    return {
      ok: false,
      error: "No se encontraron ejercicios válidos para registrar.",
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
      protocolData,
      ejercicios: resultados,
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
    const rawCasas = (item as { casas?: unknown }).casas;
    const rawNacleiro = (item as { nacleiro?: unknown }).nacleiro;
    const repeticionesNumber =
      typeof rawRepeticiones === "number"
        ? rawRepeticiones
        : Number(rawRepeticiones);
    const cargaNumber =
      typeof rawCarga === "number" ? rawCarga : Number(rawCarga);
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

  if (sanitizedEjercicios.length === 0) {
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
        },
      });

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
          const carga = item.carga > 0 ? item.carga : fallback?.carga ?? 0;
          const formula = calculateRM(carga, item.repeticiones, persona.sexo);

          return {
            ejercicioId: item.ejercicioId,
            repeticiones: item.repeticiones,
            carga: roundToTwo(carga),
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
          };
        });

      if (resultadosData.length === 0) {
        throw new Error(
          "No se pudieron preparar resultados validos para la sesion.",
        );
      }

      await tx.persona.update({
        where: { id: persona.id },
        data: { masaCorporal: input.peso },
      });

      const estimatedRM = Math.max(
        ...sanitizedEjercicios.map((item) => getFormulaRM(item, persona.sexo).estimated),
      );
      const finalRM = Math.max(
        ...sanitizedEjercicios.map((item) =>
          getFinalRM(item, rmMethod, persona.sexo),
        ),
      );

      return tx.sesion.create({
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
        },
      });
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

  redirect(`/dashboard?cc=${encodeURIComponent(parsed.data.cc)}&saved=1`);
}

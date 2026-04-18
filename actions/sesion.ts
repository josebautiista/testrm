"use server";

import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "@prisma/client";

import { calculateRMForSession, roundToTwo } from "@/lib/rm";

type ResultadoInput = {
  ejercicioId: number;
  repeticiones: number;
};

type CreateSesionInput = {
  cc: string;
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

  if (!cc) {
    return { ok: false, error: "CC invalido.", cc: "" };
  }

  const rawEjercicioIds = formData.getAll("ejercicioIds");
  const resultados: ResultadoInput[] = [];

  for (const rawId of rawEjercicioIds) {
    if (typeof rawId !== "string") {
      continue;
    }

    const ejercicioId = Number(rawId);

    if (!Number.isInteger(ejercicioId) || ejercicioId <= 0) {
      continue;
    }

    const repeticiones = parseNonNegativeInt(
      formData.get(`repeticiones_${ejercicioId}`),
    );

    resultados.push({
      ejercicioId,
      repeticiones,
    });
  }

  if (resultados.length === 0) {
    return {
      ok: false,
      error: "No se encontraron ejercicios validos para registrar.",
      cc,
    };
  }

  return {
    ok: true,
    data: {
      cc,
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
    const rawRepeticiones = (item as { repeticiones?: unknown }).repeticiones;

    const ejercicioId = toPositiveInt(
      typeof rawEjercicioId === "number"
        ? rawEjercicioId
        : Number(rawEjercicioId),
    );

    if (!ejercicioId) {
      continue;
    }

    const repeticionesNumber =
      typeof rawRepeticiones === "number"
        ? rawRepeticiones
        : Number(rawRepeticiones);

    const repeticiones = Number.isFinite(repeticionesNumber)
      ? Math.max(0, Math.floor(repeticionesNumber))
      : 0;

    sanitized.push({
      ejercicioId,
      repeticiones,
    });
  }

  return sanitized;
}

export async function createSesion(
  input: CreateSesionInput,
): Promise<CreateSesionResult> {
  const cc = normalizeCC(typeof input.cc === "string" ? input.cc : "");
  const sanitizedEjercicios = sanitizeInputEjercicios(input.ejercicios);

  if (!cc) {
    throw new Error("CC invalido.");
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
        },
      });

      if (!persona) {
        throw new Error("Usuario no encontrado.");
      }

      const ejerciciosDB = await tx.ejercicio.findMany({
        select: {
          id: true,
          porcentajeMasa: true,
        },
      });

      const rmResults = calculateRMForSession(
        persona.masaCorporal,
        ejerciciosDB,
        sanitizedEjercicios,
      );

      const ejerciciosPermitidos = new Set(
        sanitizedEjercicios.map((item) => item.ejercicioId),
      );

      const resultadosData = rmResults
        .filter((item) => ejerciciosPermitidos.has(item.ejercicioId))
        .map((item) => ({
          ejercicioId: item.ejercicioId,
          repeticiones: Number.isFinite(item.repeticiones)
            ? Math.max(0, Math.floor(item.repeticiones))
            : 0,
          carga: roundToTwo(Number.isFinite(item.carga) ? item.carga : 0),
          epley: roundToTwo(Number.isFinite(item.epley) ? item.epley : 0),
          brzycki: roundToTwo(Number.isFinite(item.brzycki) ? item.brzycki : 0),
          lombardi: roundToTwo(
            Number.isFinite(item.lombardi) ? item.lombardi : 0,
          ),
          lander: roundToTwo(Number.isFinite(item.lander) ? item.lander : 0),
          oconnor: roundToTwo(Number.isFinite(item.oconnor) ? item.oconnor : 0),
          mayhew: roundToTwo(Number.isFinite(item.mayhew) ? item.mayhew : 0),
          wathen: roundToTwo(Number.isFinite(item.wathen) ? item.wathen : 0),
          baechle: roundToTwo(Number.isFinite(item.baechle) ? item.baechle : 0),
        }));

      if (resultadosData.length === 0) {
        throw new Error(
          "No se pudieron preparar resultados validos para la sesion.",
        );
      }

      return tx.sesion.create({
        data: {
          personaId: persona.id,
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
      throw new Error("No fue posible guardar la sesion. Intenta nuevamente.");
    }

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

  try {
    await createSesion(parsed.data);
  } catch (error) {
    saveError =
      error instanceof Error
        ? error.message
        : "No fue posible crear la sesion. Intenta nuevamente.";
  }

  if (saveError) {
    redirect(
      `/nueva-sesion?cc=${encodeURIComponent(parsed.data.cc)}&error=${encodeURIComponent(saveError)}`,
    );
  }

  redirect(`/dashboard?cc=${encodeURIComponent(parsed.data.cc)}`);
}

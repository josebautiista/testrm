import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "@prisma/client";

import {
  normalizeCircumferenceToCentimeters,
  normalizeHeightToMeters,
  normalizeWeightToKilograms,
} from "@/helpers/units";
import { normalizeSexo, validatePersonaInput } from "@/helpers/validators";

export type PersonaInput = {
  cc: string;
  nombre: string;
  sexo: string;
  masaCorporal: number;
  cintura?: number;
  cadera?: number;
  edad: number;
  talla: number;
  entrenado: boolean;
};

export type PersonaUpdateInput = PersonaInput & {
  id: number;
};

export type PersonaServiceResult = {
  id: number;
  cc: string;
};

export type NormalizedPersonaInput = {
  cc: string;
  nombre: string;
  sexo: "masculino" | "femenino";
  masaCorporal: number;
  cintura?: number;
  cadera?: number;
  edad: number;
  talla: number;
  entrenado: boolean;
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

function normalizeText(value: string): string {
  return value.trim();
}

export function normalizeAndValidatePersona(
  input: PersonaInput,
): NormalizedPersonaInput {
  const normalizedSexo = normalizeSexo(input.sexo);

  if (!normalizedSexo) {
    throw new Error("El sexo debe ser masculino o femenino.");
  }

  const normalizedCintura =
    typeof input.cintura === "number"
      ? normalizeCircumferenceToCentimeters(input.cintura)
      : undefined;

  const normalizedCadera =
    typeof input.cadera === "number"
      ? normalizeCircumferenceToCentimeters(input.cadera)
      : undefined;

  const normalizedPersona: NormalizedPersonaInput = {
    cc: normalizeText(input.cc),
    nombre: normalizeText(input.nombre),
    sexo: normalizedSexo,
    masaCorporal: normalizeWeightToKilograms(input.masaCorporal),
    cintura: normalizedCintura,
    cadera: normalizedCadera,
    edad: input.edad,
    talla: normalizeHeightToMeters(input.talla),
    entrenado: Boolean(input.entrenado),
  };

  validatePersonaInput(normalizedPersona);

  return normalizedPersona;
}

function mapKnownRequestError(error: unknown): Error | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new Error("Ya existe un usuario con ese CC.");
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new Error(
      `Error de base de datos al registrar el usuario (${error.code}): ${error.message}`,
    );
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new Error(`Error de validacion de Prisma: ${error.message}`);
  }

  return null;
}

export async function createPersona(
  data: PersonaInput,
): Promise<PersonaServiceResult> {
  const cleanData = normalizeAndValidatePersona(data);
  const personaData = {
    ...cleanData,
    cintura: cleanData.cintura ?? 0,
    cadera: cleanData.cadera ?? 0,
  };

  const existingPersona = await prisma.persona.findUnique({
    where: { cc: cleanData.cc },
    select: { id: true },
  });

  if (existingPersona) {
    throw new Error("Ya existe un usuario con ese CC.");
  }

  try {
    return await prisma.persona.create({
      data: personaData,
      select: {
        id: true,
        cc: true,
      },
    });
  } catch (error) {
    const knownRequestError = mapKnownRequestError(error);
    if (knownRequestError) {
      throw knownRequestError;
    }

    throw new Error(
      error instanceof Error
        ? `No fue posible registrar el usuario. ${error.message}`
        : `No fue posible registrar el usuario. ${String(error)}`,
    );
  }
}

export async function updatePersona(
  data: PersonaUpdateInput,
): Promise<PersonaServiceResult> {
  if (!Number.isInteger(data.id) || data.id <= 0) {
    throw new Error("El ID de la persona es obligatorio.");
  }

  const cleanData = normalizeAndValidatePersona(data);

  try {
    return await prisma.persona.update({
      where: { id: data.id },
      data: cleanData,
      select: {
        id: true,
        cc: true,
      },
    });
  } catch (error) {
    const knownRequestError = mapKnownRequestError(error);
    if (knownRequestError) {
      throw knownRequestError;
    }

    throw new Error(
      error instanceof Error
        ? `No fue posible actualizar el usuario. ${error.message}`
        : `No fue posible actualizar el usuario. ${String(error)}`,
    );
  }
}

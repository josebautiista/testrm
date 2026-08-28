import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
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

export type MedidasBasicasInput = {
  masaCorporal: number;
  talla: number;
};

export type MedidasBasicasResult = {
  masaCorporal: number;
  talla: number;
};

export async function updateMedidasBasicas(
  cc: string,
  data: MedidasBasicasInput,
): Promise<MedidasBasicasResult> {
  const normalizedCC = normalizeText(cc);

  if (!normalizedCC) {
    throw new Error("El CC es obligatorio.");
  }

  const masaCorporal = normalizeWeightToKilograms(data.masaCorporal);
  const talla = normalizeHeightToMeters(data.talla);

  if (!Number.isFinite(talla) || talla < 1.2 || talla > 2.2) {
    throw new Error(
      `La talla debe quedar entre 1.2 y 2.2 metros. Recibido: ${talla}. Si la ingresaste en centimetros, debe ser mayor que 3 para que se convierta automaticamente.`,
    );
  }

  if (
    !Number.isFinite(masaCorporal) ||
    masaCorporal < 30 ||
    masaCorporal > 300
  ) {
    throw new Error(
      `La masa corporal debe quedar entre 30 y 300 kg. Recibido: ${masaCorporal}. Si la ingresaste en libras, debe ser mayor que 150 para que se convierta automaticamente.`,
    );
  }

  try {
    return await prisma.persona.update({
      where: { cc: normalizedCC },
      data: {
        masaCorporal,
        talla,
      },
      select: {
        masaCorporal: true,
        talla: true,
      },
    });
  } catch (error) {
    const knownRequestError = mapKnownRequestError(error);
    if (knownRequestError) {
      throw knownRequestError;
    }

    throw new Error(
      error instanceof Error
        ? `No fue posible actualizar las medidas. ${error.message}`
        : `No fue posible actualizar las medidas. ${String(error)}`,
    );
  }
}

export async function updateNivelOverride(
  cc: string,
  nivel: "beginner" | "intermediate" | "advanced" | null,
): Promise<{ nivelOverride: string | null }> {
  const normalizedCC = normalizeText(cc);

  if (!normalizedCC) {
    throw new Error("El CC es obligatorio.");
  }

  try {
    return await prisma.persona.update({
      where: { cc: normalizedCC },
      data: { nivelOverride: nivel },
      select: { nivelOverride: true },
    });
  } catch (error) {
    const knownRequestError = mapKnownRequestError(error);
    if (knownRequestError) {
      throw knownRequestError;
    }

    throw new Error(
      error instanceof Error
        ? `No fue posible actualizar el nivel. ${error.message}`
        : `No fue posible actualizar el nivel. ${String(error)}`,
    );
  }
}

// TASK-051/D-14: updateFaseEntrenamiento se retiró junto con sus dos únicos
// llamadores (avanzarAFuerzaAction, updateFaseEntrenamientoAction en
// actions/persona.ts) — era el sistema de progresión paralelo al mesociclo
// activo. Ver docs/DECISIONES.md.

export type DisponibilidadInput = {
  mesesEntrenamiento: number;
  diasDisponibles: number;
  minutosPorSesion: number;
  equipamiento: string[];
  limitaciones?: string | null;
};

export type DisponibilidadResult = {
  mesesEntrenamiento: number;
  diasDisponibles: number;
  minutosPorSesion: number;
  equipamiento: Prisma.JsonValue;
  limitaciones: string | null;
};

/**
 * C-12/TASK-025: disponibilidad y contexto del atleta — lo que el motor de
 * planificación (M5) necesita como input, además del RM vigente.
 */
export async function updateDisponibilidad(
  cc: string,
  data: DisponibilidadInput,
): Promise<DisponibilidadResult> {
  const normalizedCC = normalizeText(cc);

  if (!normalizedCC) {
    throw new Error("El CC es obligatorio.");
  }

  if (!Number.isInteger(data.mesesEntrenamiento) || data.mesesEntrenamiento < 0) {
    throw new Error("Los meses de entrenamiento deben ser un entero >= 0.");
  }

  if (
    !Number.isInteger(data.diasDisponibles) ||
    data.diasDisponibles < 1 ||
    data.diasDisponibles > 7
  ) {
    throw new Error("Los días disponibles por semana deben estar entre 1 y 7.");
  }

  if (
    !Number.isInteger(data.minutosPorSesion) ||
    data.minutosPorSesion < 20 ||
    data.minutosPorSesion > 240
  ) {
    throw new Error("Los minutos por sesión deben estar entre 20 y 240.");
  }

  try {
    return await prisma.persona.update({
      where: { cc: normalizedCC },
      data: {
        mesesEntrenamiento: data.mesesEntrenamiento,
        diasDisponibles: data.diasDisponibles,
        minutosPorSesion: data.minutosPorSesion,
        equipamiento: data.equipamiento as Prisma.InputJsonValue,
        limitaciones: data.limitaciones?.trim() || null,
      },
      select: {
        mesesEntrenamiento: true,
        diasDisponibles: true,
        minutosPorSesion: true,
        equipamiento: true,
        limitaciones: true,
      },
    });
  } catch (error) {
    const knownRequestError = mapKnownRequestError(error);
    if (knownRequestError) {
      throw knownRequestError;
    }

    throw new Error(
      error instanceof Error
        ? `No fue posible actualizar la disponibilidad. ${error.message}`
        : `No fue posible actualizar la disponibilidad. ${String(error)}`,
    );
  }
}

"use server";

import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "@prisma/client";

export type EntryState = {
  error: string | null;
  redirectTo: string | null;
  submittedCC: string;
};

export type RegistroState = {
  error: string | null;
  redirectTo: string | null;
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

type CreatePersonaResult =
  | { ok: true; cc: string }
  | { ok: false; error: string };

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

function toFiniteNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return Number.NaN;
  }

  return Number(value);
}

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function validateCreatePersonaInput(
  input: CreatePersonaInput,
): { ok: true; data: CreatePersonaInput } | { ok: false; error: string } {
  const cc = normalizeCC(input.cc);
  const nombre = input.nombre.trim();
  const sexo = input.sexo.toLowerCase();

  if (!cc) {
    return { ok: false, error: "El CC es obligatorio." };
  }

  if (!nombre) {
    return { ok: false, error: "El nombre es obligatorio." };
  }

  if (!sexo) {
    return { ok: false, error: "El sexo es obligatorio." };
  }

  if (sexo !== "masculino" && sexo !== "femenino") {
    return { ok: false, error: "El sexo debe ser Masculino o Femenino." };
  }

  if (!Number.isFinite(input.masaCorporal) || input.masaCorporal <= 0) {
    return { ok: false, error: "La masa corporal debe ser un numero valido." };
  }

  if (
    !Number.isFinite(input.edad) ||
    !Number.isInteger(input.edad) ||
    input.edad <= 0
  ) {
    return { ok: false, error: "La edad debe ser un entero positivo." };
  }

  if (!Number.isFinite(input.talla) || input.talla <= 0) {
    return { ok: false, error: "La talla debe ser un numero valido." };
  }

  return {
    ok: true,
    data: {
      ...input,
      cc,
      nombre,
      sexo,
    },
  };
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
  const entrenado =
    formData.get("entrenado") === "on" || formData.get("entrenado") === "true";

  return validateCreatePersonaInput({
    cc,
    nombre,
    sexo,
    masaCorporal,
    edad,
    talla,
    entrenado,
  });
}

export async function checkPersonaByCC(cc: string) {
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
): Promise<CreatePersonaResult> {
  const validated = validateCreatePersonaInput(data);

  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const existingPersona = await prisma.persona.findUnique({
    where: { cc: validated.data.cc },
    select: { id: true },
  });

  if (existingPersona) {
    return { ok: false, error: "Ya existe un usuario con ese CC." };
  }

  try {
    const persona = await prisma.persona.create({
      data: validated.data,
      select: {
        cc: true,
      },
    });

    return { ok: true, cc: persona.cc };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "Ya existe un usuario con ese CC." };
    }

    return {
      ok: false,
      error: "No fue posible registrar el usuario. Intenta nuevamente.",
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

  const exists = await checkPersonaByCC(cc);

  if (exists) {
    redirect(`/dashboard?cc=${encodeURIComponent(cc)}`);
  }

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

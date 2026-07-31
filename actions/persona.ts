"use server";

import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { createPersona as createPersonaService } from "@/services/persona.service";

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
): Promise<{ ok: true; cc: string } | { ok: false; error: string }> {
  try {
    const persona = await createPersonaService(data);

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

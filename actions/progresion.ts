"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuthUserFromCookies } from "@/lib/auth";
import {
  aceptarAjustePropuesto,
  rechazarAjustePropuesto,
} from "@/services/progresion.service";

async function getResueltoPor(): Promise<string> {
  const authUser = await getAuthUserFromCookies();
  return authUser?.username ?? "entrenador";
}

async function getPersonaCCById(personaId: number): Promise<string | null> {
  const persona = await prisma.persona.findUnique({
    where: { id: personaId },
    select: { cc: true },
  });
  return persona?.cc ?? null;
}

export async function aceptarAjusteAction(
  ajusteId: number,
  personaId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resueltoPor = await getResueltoPor();
    await aceptarAjustePropuesto(ajusteId, resueltoPor);

    const cc = await getPersonaCCById(personaId);
    if (cc) revalidatePath(`/ajustes?cc=${encodeURIComponent(cc)}`);

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible aceptar el ajuste.",
    };
  }
}

export async function rechazarAjusteAction(
  ajusteId: number,
  personaId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resueltoPor = await getResueltoPor();
    await rechazarAjustePropuesto(ajusteId, resueltoPor);

    const cc = await getPersonaCCById(personaId);
    if (cc) revalidatePath(`/ajustes?cc=${encodeURIComponent(cc)}`);

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible rechazar el ajuste.",
    };
  }
}

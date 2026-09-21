"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { assertAccesoAPersona, getAuthUserFromCookies } from "@/lib/auth";
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

// ADR-52: personaId llega desde el cliente junto al ajuste que se ve en
// /ajustes, pero ni aceptarAjustePropuesto ni rechazarAjustePropuesto
// comprueban dueño (solo el ajusteId). Sin esto, un entrenador podría
// aceptar/rechazar el ajuste de un atleta que no es suyo con solo cambiar
// el personaId enviado.
async function assertAjusteDeLaPersona(ajusteId: number, personaId: number) {
  const authUser = await getAuthUserFromCookies();
  const ajuste = await prisma.ajustePropuesto.findUnique({
    where: { id: ajusteId },
    select: { personaId: true, persona: { select: { entrenadorId: true } } },
  });

  if (!ajuste || ajuste.personaId !== personaId) {
    throw new Error("El ajuste no corresponde a esta persona.");
  }

  assertAccesoAPersona(authUser, ajuste.persona.entrenadorId);
}

export async function aceptarAjusteAction(
  ajusteId: number,
  personaId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAjusteDeLaPersona(ajusteId, personaId);
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
    await assertAjusteDeLaPersona(ajusteId, personaId);
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

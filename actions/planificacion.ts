"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getAuthUserFromCookies } from "@/lib/auth";
import type { AuditContext } from "@/services/macrociclo.service";
import {
  construirContexto,
  generarPropuesta,
  publicarPlan,
  regenerarDesde,
} from "@/services/planificacion.service";
import type { PropuestaPlan } from "@/lib/planificacion/tipos";

async function getContext(): Promise<AuditContext> {
  const authUser = await getAuthUserFromCookies();
  return { userType: "admin", adminId: authUser?.userId ?? null };
}

async function getPersonaByCC(cc: string) {
  const persona = await prisma.persona.findUnique({ where: { cc } });
  if (!persona) {
    throw new Error("Persona no encontrada.");
  }
  return persona;
}

/** P-04 · TASK-039: genera una propuesta con el motor, sin persistir nada. */
export async function generarPropuestaAction(
  cc: string,
  macrocicloId: number,
): Promise<{ ok: true; propuesta: PropuestaPlan } | { ok: false; error: string }> {
  try {
    const persona = await getPersonaByCC(cc);
    const contexto = await construirContexto(macrocicloId, persona.id);
    const propuesta = generarPropuesta(contexto);
    return { ok: true, propuesta };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible generar el plan.",
    };
  }
}

/** P-04 · TASK-039: persiste una propuesta ya generada y revisada. */
export async function publicarPlanAction(
  cc: string,
  macrocicloId: number,
  propuesta: PropuestaPlan,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const persona = await getPersonaByCC(cc);
    const context = await getContext();
    await publicarPlan({ macrocicloId, personaId: persona.id, propuesta, context });

    await prisma.macrociclo.update({
      where: { id: macrocicloId },
      data: { pasoActual: Math.max(8, 0) },
    });

    revalidatePath(`/macrociclo/${macrocicloId}`);
    revalidatePath(`/macrociclo/${macrocicloId}/generar`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible publicar el plan.",
    };
  }
}

/** P-05 · TASK-035: regenera el plan desde hoy (o una fecha), respetando overrides y semanas pasadas. */
export async function regenerarDesdeAction(
  cc: string,
  macrocicloId: number,
  fechaCorte?: string,
): Promise<{ ok: true; propuesta: PropuestaPlan } | { ok: false; error: string }> {
  try {
    const persona = await getPersonaByCC(cc);
    const context = await getContext();
    const propuesta = await regenerarDesde({
      macrocicloId,
      personaId: persona.id,
      fechaCorte: fechaCorte ? new Date(fechaCorte) : undefined,
      context,
    });

    revalidatePath(`/macrociclo/${macrocicloId}`);
    revalidatePath(`/macrociclo/${macrocicloId}/generar`);
    return { ok: true, propuesta };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible regenerar el plan.",
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  crearSesionRealizada,
  registrarSerie,
} from "@/services/ejecucion.service";
import { evaluarYProponerAjustesPorSesion } from "@/services/progresion.service";

async function getPersonaDeSesionPlanificada(sesionPlanificadaId: number) {
  const sesionPlanificada = await prisma.sesionPlanificada.findUniqueOrThrow({
    where: { id: sesionPlanificadaId },
    select: {
      semana: {
        select: { macrociclo: { select: { personaId: true } } },
      },
    },
  });
  return sesionPlanificada.semana.macrociclo.personaId;
}

/**
 * P-07 · TASK-041: obtiene la SesionRealizada "en curso" para esta
 * SesionPlanificada, o crea una nueva si no existe todavía.
 */
export async function iniciarOContinuarSesionAction(
  sesionPlanificadaId: number,
): Promise<{ ok: true; sesionRealizadaId: number } | { ok: false; error: string }> {
  try {
    const personaId = await getPersonaDeSesionPlanificada(sesionPlanificadaId);

    const existente = await prisma.sesionRealizada.findFirst({
      where: { sesionPlanificadaId, estado: { in: ["parcial"] } },
      orderBy: { createdAt: "desc" },
    });

    if (existente) {
      return { ok: true, sesionRealizadaId: existente.id };
    }

    const creada = await crearSesionRealizada({
      personaId,
      sesionPlanificadaId,
      estado: "parcial",
    });

    return { ok: true, sesionRealizadaId: creada.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible iniciar la sesión.",
    };
  }
}

export type RegistrarSerieActionInput = {
  sesionRealizadaId: number;
  prescripcionId: number | null;
  ejercicioId: number;
  numeroSerie: number;
  cargaKg: number;
  repeticiones: number;
  rir: number | null;
  fallo: boolean;
  requestId: string;
};

export async function registrarSerieAction(
  input: RegistrarSerieActionInput,
): Promise<{ ok: true; e1rmKg: number | null } | { ok: false; error: string }> {
  try {
    const sesionRealizada = await prisma.sesionRealizada.findUniqueOrThrow({
      where: { id: input.sesionRealizadaId },
      select: { personaId: true },
    });

    const serie = await registrarSerie(
      {
        sesionRealizadaId: input.sesionRealizadaId,
        prescripcionId: input.prescripcionId,
        ejercicioId: input.ejercicioId,
        numeroSerie: input.numeroSerie,
        cargaKg: input.cargaKg,
        repeticiones: input.repeticiones,
        rir: input.rir,
        fallo: input.fallo,
        requestId: input.requestId,
      },
      sesionRealizada.personaId,
    );

    return { ok: true, e1rmKg: serie.e1rmKg };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible registrar la serie.",
    };
  }
}

export async function completarSesionAction(
  sesionRealizadaId: number,
  cc: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sesionRealizada = await prisma.sesionRealizada.update({
      where: { id: sesionRealizadaId },
      data: { estado: "completa" },
      select: { sesionPlanificadaId: true },
    });

    if (sesionRealizada.sesionPlanificadaId) {
      await prisma.sesionPlanificada.update({
        where: { id: sesionRealizada.sesionPlanificadaId },
        data: { estado: "realizada" },
      });
    }

    // R-13: evalúa el rendimiento de esta sesión contra la anterior y
    // propone ajustes (nunca los aplica solo, AC-20).
    await evaluarYProponerAjustesPorSesion(sesionRealizadaId);

    revalidatePath(`/dashboard?cc=${encodeURIComponent(cc)}`);
    revalidatePath(`/ajustes?cc=${encodeURIComponent(cc)}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No fue posible completar la sesión.",
    };
  }
}

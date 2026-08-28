// TASK-037 · M7: registra lo que realmente ocurrió. Cierra el ciclo
// evaluación -> prescripción -> ejecución -> reevaluación.
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { estimarE1rmConRir } from "@/lib/rm/estimacion";
import { actualizarRmVigenteSiSupera } from "@/services/rm.service";

export type RegistrarSerieInput = {
  sesionRealizadaId: number;
  prescripcionId?: number | null;
  ejercicioId: number;
  numeroSerie: number;
  cargaKg: number;
  repeticiones: number;
  rir?: number | null;
  fallo?: boolean;
  /** TASK-038: idempotencia — dos envíos con el mismo requestId crean una sola serie. */
  requestId?: string | null;
};

export type CrearSesionRealizadaInput = {
  personaId: number;
  sesionPlanificadaId?: number | null;
  fecha?: Date;
  duracionMin?: number | null;
  rpeSesion?: number | null;
  estado: "completa" | "parcial" | "omitida";
  motivoOmision?: string | null;
  notas?: string | null;
};

export async function crearSesionRealizada(input: CrearSesionRealizadaInput) {
  const sesion = await prisma.sesionRealizada.create({
    data: {
      personaId: input.personaId,
      sesionPlanificadaId: input.sesionPlanificadaId ?? null,
      fecha: input.fecha ?? new Date(),
      duracionMin: input.duracionMin ?? null,
      rpeSesion: input.rpeSesion ?? null,
      estado: input.estado,
      motivoOmision: input.motivoOmision ?? null,
      notas: input.notas ?? null,
    },
  });

  if (input.sesionPlanificadaId) {
    await prisma.sesionPlanificada.update({
      where: { id: input.sesionPlanificadaId },
      data: { estado: input.estado === "completa" ? "realizada" : input.estado },
    });
  }

  return sesion;
}

/**
 * F-03: calcula e1RM desde la serie (carga, reps, RIR) y, si supera el RM
 * vigente del ejercicio, lo actualiza (origen "e1rm_entrenamiento") — a
 * diferencia de una evaluación, una serie de entrenamiento nunca baja el
 * vigente, solo lo mejora (§16.2).
 */
export async function registrarSerie(
  input: RegistrarSerieInput,
  personaId: number,
) {
  if (
    !Number.isFinite(input.cargaKg) ||
    input.cargaKg < 0 ||
    !Number.isInteger(input.repeticiones) ||
    input.repeticiones <= 0
  ) {
    throw new Error("Carga y repeticiones inválidas.");
  }

  const rir = typeof input.rir === "number" && Number.isFinite(input.rir) ? input.rir : null;
  const estimacion =
    rir !== null ? estimarE1rmConRir(input.cargaKg, input.repeticiones, rir) : null;
  const e1rmKg = estimacion?.valido ? estimacion.valor : null;
  const requestId = input.requestId?.trim() || null;

  try {
    return await prisma.$transaction(async (tx) => {
      const serie = await tx.serieRealizada.create({
        data: {
          sesionRealizadaId: input.sesionRealizadaId,
          prescripcionId: input.prescripcionId ?? null,
          ejercicioId: input.ejercicioId,
          numeroSerie: input.numeroSerie,
          cargaKg: input.cargaKg,
          repeticiones: input.repeticiones,
          rir,
          fallo: input.fallo ?? false,
          e1rmKg,
          requestId,
        },
      });

      if (e1rmKg !== null) {
        await actualizarRmVigenteSiSupera(tx, {
          personaId,
          ejercicioId: input.ejercicioId,
          valorKg: e1rmKg,
          origen: "e1rm_entrenamiento",
          confianza: "media",
          fecha: new Date(),
        });
      }

      return serie;
    });
  } catch (error) {
    // TASK-038: dos envíos con el mismo requestId -> devuelve la serie ya creada.
    if (
      requestId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existente = await prisma.serieRealizada.findUnique({ where: { requestId } });
      if (existente) return existente;
    }
    throw error;
  }
}

export async function listarSeriesDeSesion(sesionRealizadaId: number) {
  return prisma.serieRealizada.findMany({
    where: { sesionRealizadaId },
    orderBy: [{ ejercicioId: "asc" }, { numeroSerie: "asc" }],
  });
}

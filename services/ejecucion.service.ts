// TASK-037 · M7: registra lo que realmente ocurrió. Cierra el ciclo
// evaluación -> prescripción -> ejecución -> reevaluación.
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { estimarE1rmConRir, estimarRm } from "@/lib/rm/estimacion";
import { actualizarRmVigenteSiSupera } from "@/services/rm.service";
import type { ConfianzaRmVigente } from "@/lib/rm/vigente";

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
 *
 * Con RIR reportado usa la fórmula específica de entrenamiento (F-03,
 * `estimarE1rmConRir`, válida solo si reps+RIR<=10 y RIR<=3). Sin RIR (caso
 * del campo "posible marca" del registro de sesión, ADR-51) cae al
 * estimador primario `estimarRm` — el mismo que usa un test de RM — que sí
 * sabe estimar sin RIR, con confianza más baja y respetando la ventana de
 * validez (D-04/ADR-03): nunca se usa si las repeticiones no son utilizables.
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

  let e1rmKg: number | null = null;
  let confianza: ConfianzaRmVigente = "media";

  if (rir !== null) {
    const estimacion = estimarE1rmConRir(input.cargaKg, input.repeticiones, rir);
    if (estimacion.valido) {
      e1rmKg = estimacion.valor;
      confianza = "media";
    }
  } else {
    const estimacion = estimarRm(input.cargaKg, input.repeticiones);
    if (!estimacion.noUtilizable && estimacion.valor > 0) {
      e1rmKg = estimacion.valor;
      confianza = estimacion.confianza;
    }
  }

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
          confianza,
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

/** ADR-49: guarda el WOD que el entrenador escribió para esta sesión planificada. */
export async function guardarWodSesionPlanificada(
  sesionPlanificadaId: number,
  wod: string,
) {
  return prisma.sesionPlanificada.update({
    where: { id: sesionPlanificadaId },
    data: { wod: wod.trim() || null },
  });
}

/**
 * Marca como omitida una `SesionRealizada` ya iniciada (creada "parcial" al
 * abrir la pantalla de registro). Sin esto no había forma de que R-13
 * (>=30% de sesiones omitidas -> revisar disponibilidad) ni el criterio de
 * "sesiones omitidas por fatiga" del deload reactivo (R-10) tuvieran datos
 * reales de los que partir.
 */
export async function omitirSesionRealizada(
  sesionRealizadaId: number,
  motivoOmision: string,
) {
  const sesion = await prisma.sesionRealizada.update({
    where: { id: sesionRealizadaId },
    data: { estado: "omitida", motivoOmision },
    select: { sesionPlanificadaId: true },
  });

  if (sesion.sesionPlanificadaId) {
    await prisma.sesionPlanificada.update({
      where: { id: sesion.sesionPlanificadaId },
      data: { estado: "omitida" },
    });
  }

  return sesion;
}

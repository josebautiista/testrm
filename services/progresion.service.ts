// TASK-049 · Crear, aceptar y rechazar AjustePropuesto. Aceptar una
// propuesta sobre una prescripción concreta crea una NUEVA versión (R-12):
// la anterior queda encadenada vía supersededById, nunca se reescribe.
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { redondearAIncremento } from "@/lib/config/parametros";
import {
  evaluarRendimientoEjercicio,
  type PropuestaAjuste,
  type RegistroSesionEjercicio,
} from "@/lib/progresion/reglas";

export type CrearAjustePropuestoInput = {
  personaId: number;
  macrocicloId: number;
  alcance: "prescripcion" | "sesion" | "semana" | "mesociclo";
  objetivoId: number;
  propuesta: PropuestaAjuste;
};

/** Evita proponer dos veces lo mismo: una propuesta pendiente por alcance+objetivo+tipo. */
export async function crearAjustePropuesto(input: CrearAjustePropuestoInput) {
  const existente = await prisma.ajustePropuesto.findFirst({
    where: {
      personaId: input.personaId,
      alcance: input.alcance,
      objetivoId: input.objetivoId,
      tipo: input.propuesta.tipo,
      estado: "pendiente",
    },
  });

  if (existente) {
    return existente;
  }

  return prisma.ajustePropuesto.create({
    data: {
      personaId: input.personaId,
      macrocicloId: input.macrocicloId,
      alcance: input.alcance,
      objetivoId: input.objetivoId,
      tipo: input.propuesta.tipo,
      magnitud: input.propuesta.magnitudPct,
      justificacion: input.propuesta.justificacion,
      evidencia: input.propuesta.evidencia as Prisma.InputJsonValue,
      estado: "pendiente",
    },
  });
}

export async function listarAjustesPendientes(personaId: number) {
  return prisma.ajustePropuesto.findMany({
    where: { personaId, estado: "pendiente" },
    orderBy: { createdAt: "desc" },
  });
}

export class AjusteYaResueltoError extends Error {
  constructor() {
    super("Este ajuste ya fue resuelto.");
    this.name = "AjusteYaResueltoError";
  }
}

/**
 * R-12/AC-20: aplica la propuesta solo tras aceptación humana explícita. Si
 * el alcance es una prescripción con carga y el tipo es subir/bajar carga,
 * crea una nueva versión anclada (origen "autorregulado") en vez de
 * modificar la fila publicada.
 */
export async function aceptarAjustePropuesto(id: number, resueltoPor: string) {
  return prisma.$transaction(async (tx) => {
    const ajuste = await tx.ajustePropuesto.findUniqueOrThrow({ where: { id } });

    if (ajuste.estado !== "pendiente") {
      throw new AjusteYaResueltoError();
    }

    if (
      ajuste.alcance === "prescripcion" &&
      (ajuste.tipo === "subir_carga" || ajuste.tipo === "bajar_carga") &&
      ajuste.magnitud !== null
    ) {
      const prescripcionActual = await tx.prescripcion.findUnique({
        where: { id: ajuste.objetivoId },
        include: { ejercicio: { select: { incrementoMinimoKg: true } } },
      });

      if (prescripcionActual && prescripcionActual.cargaKg !== null) {
        const factor =
          ajuste.tipo === "subir_carga" ? 1 + ajuste.magnitud / 100 : 1 - ajuste.magnitud / 100;
        const nuevaCarga = redondearAIncremento(
          prescripcionActual.cargaKg * factor,
          prescripcionActual.ejercicio.incrementoMinimoKg,
        );

        const nuevaVersion = await tx.prescripcion.create({
          data: {
            sesionPlanificadaId: prescripcionActual.sesionPlanificadaId,
            ejercicioId: prescripcionActual.ejercicioId,
            orden: prescripcionActual.orden,
            series: prescripcionActual.series,
            repeticionesObjetivo: prescripcionActual.repeticionesObjetivo,
            repsMin: prescripcionActual.repsMin,
            repsMax: prescripcionActual.repsMax,
            porcentajeRm: prescripcionActual.porcentajeRm,
            rirObjetivo: prescripcionActual.rirObjetivo,
            cargaKg: nuevaCarga,
            descansoSeg: prescripcionActual.descansoSeg,
            rmUsadoKg: prescripcionActual.rmUsadoKg,
            rmVigenteId: prescripcionActual.rmVigenteId,
            formulaRm: prescripcionActual.formulaRm,
            origen: "autorregulado",
            motivoAjuste: ajuste.justificacion,
            version: prescripcionActual.version + 1,
          },
        });

        await tx.prescripcion.update({
          where: { id: prescripcionActual.id },
          data: { supersededById: nuevaVersion.id },
        });
      }
    }

    return tx.ajustePropuesto.update({
      where: { id },
      data: { estado: "aceptado", resueltoPor, resueltoEn: new Date() },
    });
  });
}

export async function rechazarAjustePropuesto(id: number, resueltoPor: string) {
  const ajuste = await prisma.ajustePropuesto.findUniqueOrThrow({ where: { id } });

  if (ajuste.estado !== "pendiente") {
    throw new AjusteYaResueltoError();
  }

  return prisma.ajustePropuesto.update({
    where: { id },
    data: { estado: "rechazado", resueltoPor, resueltoEn: new Date() },
  });
}

/**
 * Conecta la ejecución real con R-13: al completar una sesión, evalúa cada
 * ejercicio contra su sesión anterior y propone ajustes si corresponde.
 *
 * Alcance de esta implementación (documentado, no todo R-13/R-10 está
 * cableado todavía): cubre las 3 reglas que se evalúan con el historial de
 * UN ejercicio entre 2 sesiones (bajar carga, subir carga, deload por caída
 * de e1RM). La regla de disponibilidad (§R-13, ≥30% de sesiones omitidas en
 * el microciclo) y el deload reactivo de 4 criterios (§R-10, necesitan RPE
 * de sesión y sesiones omitidas a lo largo de varias semanas) requieren un
 * agregado a nivel de semana/microciclo que no se calcula por sesión
 * individual — quedan para un job periódico futuro, no para este disparador.
 */
export async function evaluarYProponerAjustesPorSesion(sesionRealizadaId: number) {
  const sesion = await prisma.sesionRealizada.findUnique({
    where: { id: sesionRealizadaId },
    include: {
      series: { orderBy: { numeroSerie: "asc" } },
      sesionPlanificada: {
        select: { semana: { select: { macrocicloId: true } } },
      },
    },
  });

  if (!sesion || sesion.series.length === 0) {
    return [];
  }

  const macrocicloId = sesion.sesionPlanificada?.semana.macrocicloId;
  if (!macrocicloId) {
    return [];
  }

  const ejercicioIds = [...new Set(sesion.series.map((s) => s.ejercicioId))];
  const propuestasCreadas: Awaited<ReturnType<typeof crearAjustePropuesto>>[] = [];

  for (const ejercicioId of ejercicioIds) {
    const seriesActual = sesion.series.filter((s) => s.ejercicioId === ejercicioId);
    const prescripcionId = seriesActual.find((s) => s.prescripcionId !== null)?.prescripcionId;
    if (!prescripcionId) continue;

    const prescripcion = await prisma.prescripcion.findUnique({ where: { id: prescripcionId } });
    if (!prescripcion) continue;

    const sesionAnterior = await prisma.sesionRealizada.findFirst({
      where: {
        personaId: sesion.personaId,
        id: { not: sesion.id },
        estado: "completa",
        fecha: { lt: sesion.fecha },
        series: { some: { ejercicioId } },
      },
      orderBy: { fecha: "desc" },
      include: { series: { where: { ejercicioId }, orderBy: { numeroSerie: "asc" } } },
    });

    const aRegistro = (
      series: typeof seriesActual,
      fecha: Date,
    ): RegistroSesionEjercicio => ({
      fecha,
      repsLogradas: Math.min(...series.map((s) => s.repeticiones)),
      repsMinObjetivo: prescripcion.repsMin,
      rirReportado: series.at(-1)?.rir ?? null,
      rirObjetivo: prescripcion.rirObjetivo,
    });

    const sesiones: RegistroSesionEjercicio[] = [];
    if (sesionAnterior && sesionAnterior.series.length > 0) {
      sesiones.push(aRegistro(sesionAnterior.series, sesionAnterior.fecha));
    }
    sesiones.push(aRegistro(seriesActual, sesion.fecha));

    const e1rmActual = Math.max(
      0,
      ...seriesActual.map((s) => s.e1rmKg ?? 0).filter((v) => v > 0),
    );
    const mejorHistorico = await prisma.serieRealizada.aggregate({
      where: { sesionRealizada: { personaId: sesion.personaId }, ejercicioId, e1rmKg: { not: null } },
      _max: { e1rmKg: true },
    });

    const propuestas = evaluarRendimientoEjercicio({
      ejercicioId,
      sesiones,
      e1rmActual: e1rmActual > 0 ? e1rmActual : null,
      e1rmMejorDelBloque: mejorHistorico._max.e1rmKg,
    });

    for (const propuesta of propuestas) {
      const creado = await crearAjustePropuesto({
        personaId: sesion.personaId,
        macrocicloId,
        alcance: "prescripcion",
        objetivoId: prescripcionId,
        propuesta,
      });
      propuestasCreadas.push(creado);
    }
  }

  return propuestasCreadas;
}

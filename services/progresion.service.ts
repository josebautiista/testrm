// TASK-049 · Crear, aceptar y rechazar AjustePropuesto. Aceptar una
// propuesta sobre una prescripción concreta crea una NUEVA versión (R-12):
// la anterior queda encadenada vía supersededById, nunca se reescribe.
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { DELOAD, redondearAIncremento } from "@/lib/config/parametros";
import {
  evaluarDisponibilidad,
  evaluarRendimientoEjercicio,
  type PropuestaAjuste,
  type RegistroSesionEjercicio,
} from "@/lib/progresion/reglas";
import { evaluarDeloadReactivo } from "@/lib/progresion/deload";
import { esOmisionPorFatiga } from "@/lib/ejecucion";

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

    // R-10: aceptar un deload reactivo marca la próxima semana como
    // descarga con el recorte de volumen máximo (−50%), intensidad intacta
    // — "Ejecución del deload" de docs/PLAN-MAESTRO.md. Esto NO regenera
    // las `SesionPlanificada`/`Prescripcion` que ya existan para esa semana
    // si el macrociclo se generó con el motor automático: la app no
    // recalcula cargas por sí sola sobre un plan ya publicado (R-11/R-12).
    // Si hace falta que el recorte se refleje en las sesiones, el
    // entrenador debe regenerar el plan desde hoy — se lo indica la propia
    // UI de ajustes.
    if (ajuste.alcance === "semana" && ajuste.tipo === "deload") {
      await tx.macrocicloSemana.update({
        where: { id: ajuste.objetivoId },
        data: {
          esDeload: true,
          factorVolumen: DELOAD.volumenFactorMin,
          factorIntensidad: DELOAD.intensidadFactorMax,
        },
      });
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

/**
 * R-13 (disponibilidad): >=30% de sesiones omitidas en el microciclo ->
 * propone revisar disponibilidad, nunca bajar la carga. Se dispara al
 * completar u omitir una sesión — cualquiera de las dos puede ser la que
 * cruce el umbral del microciclo.
 */
export async function evaluarDisponibilidadPorSesion(sesionRealizadaId: number) {
  const sesion = await prisma.sesionRealizada.findUnique({
    where: { id: sesionRealizadaId },
    select: {
      personaId: true,
      sesionPlanificada: {
        select: { semanaId: true, semana: { select: { macrocicloId: true } } },
      },
    },
  });

  const semanaId = sesion?.sesionPlanificada?.semanaId;
  const macrocicloId = sesion?.sesionPlanificada?.semana.macrocicloId;
  if (!sesion || !semanaId || !macrocicloId) {
    return null;
  }

  const sesionesDeLaSemana = await prisma.sesionPlanificada.findMany({
    where: { semanaId },
    select: { estado: true },
  });

  const propuesta = evaluarDisponibilidad(
    sesionesDeLaSemana.length,
    sesionesDeLaSemana.filter((s) => s.estado === "omitida").length,
  );
  if (!propuesta) {
    return null;
  }

  return crearAjustePropuesto({
    personaId: sesion.personaId,
    macrocicloId,
    alcance: "semana",
    objetivoId: semanaId,
    propuesta,
  });
}

/**
 * R-10 (deload reactivo): >=2 de 4 señales de fatiga acumulada -> propone
 * descarga sobre la próxima semana aún no ejecutada (una semana en curso o
 * pasada no se toca, R-11). Se dispara al completar una sesión — necesita
 * el e1RM/RIR/RPE de entrenamiento real, que una sesión omitida no aporta.
 *
 * Ventanas de agregación (documentadas porque R-10 no las fija con
 * precisión): la caída de e1RM y el RIR usan esta sesión (mismo criterio de
 * "señal reciente" que R-13 usa con 2 sesiones); el RPE usa las últimas 3
 * sesiones completas del atleta, tal como pide el criterio; las sesiones
 * omitidas por fatiga se cuentan dentro del microciclo actual.
 */
export async function evaluarDeloadReactivoPorSesion(sesionRealizadaId: number) {
  const sesion = await prisma.sesionRealizada.findUnique({
    where: { id: sesionRealizadaId },
    include: {
      series: true,
      sesionPlanificada: {
        select: { semanaId: true, semana: { select: { macrocicloId: true } } },
      },
    },
  });

  const semanaId = sesion?.sesionPlanificada?.semanaId;
  const macrocicloId = sesion?.sesionPlanificada?.semana.macrocicloId;
  if (!sesion || !semanaId || !macrocicloId) {
    return null;
  }

  const ejercicioIds = [...new Set(sesion.series.map((s) => s.ejercicioId))];
  let peorCaidaE1rmPct: number | null = null;
  for (const ejercicioId of ejercicioIds) {
    const e1rmActual = Math.max(
      0,
      ...sesion.series
        .filter((s) => s.ejercicioId === ejercicioId)
        .map((s) => s.e1rmKg ?? 0),
    );
    if (e1rmActual <= 0) continue;

    const mejorHistorico = await prisma.serieRealizada.aggregate({
      where: { sesionRealizada: { personaId: sesion.personaId }, ejercicioId, e1rmKg: { not: null } },
      _max: { e1rmKg: true },
    });
    const mejor = mejorHistorico._max.e1rmKg;
    if (mejor && mejor > 0) {
      const caidaPct = ((mejor - e1rmActual) / mejor) * 100;
      if (peorCaidaE1rmPct === null || caidaPct > peorCaidaE1rmPct) {
        peorCaidaE1rmPct = caidaPct;
      }
    }
  }

  const seriesConRir = sesion.series.filter(
    (s) => s.rir !== null && s.prescripcionId !== null,
  );
  let diferenciaRirPromedio: number | null = null;
  if (seriesConRir.length > 0) {
    const prescripciones = await prisma.prescripcion.findMany({
      where: { id: { in: seriesConRir.map((s) => s.prescripcionId as number) } },
      select: { id: true, rirObjetivo: true },
    });
    const objetivoPorPrescripcion = new Map(prescripciones.map((p) => [p.id, p.rirObjetivo]));
    const diferencias = seriesConRir
      .map((s) => {
        const objetivo = objetivoPorPrescripcion.get(s.prescripcionId as number);
        return objetivo === undefined ? null : (s.rir as number) - objetivo;
      })
      .filter((v): v is number => v !== null);
    if (diferencias.length > 0) {
      diferenciaRirPromedio = diferencias.reduce((a, b) => a + b, 0) / diferencias.length;
    }
  }

  const omitidasDeLaSemana = await prisma.sesionRealizada.findMany({
    where: { personaId: sesion.personaId, estado: "omitida", sesionPlanificada: { semanaId } },
    select: { motivoOmision: true },
  });
  const sesionesOmitidasPorFatiga = omitidasDeLaSemana.filter((s) =>
    esOmisionPorFatiga(s.motivoOmision),
  ).length;

  const ultimasSesiones = await prisma.sesionRealizada.findMany({
    where: { personaId: sesion.personaId, estado: "completa" },
    orderBy: { fecha: "desc" },
    take: 3,
    select: { rpeSesion: true },
  });
  const rpeSesionRecientes = ultimasSesiones
    .map((s) => s.rpeSesion)
    .filter((v): v is number => v !== null)
    .reverse();

  const resultado = evaluarDeloadReactivo({
    caidaE1rmPct: peorCaidaE1rmPct,
    diferenciaRirPromedio,
    sesionesOmitidasPorFatiga,
    rpeSesionRecientes,
  });

  if (!resultado.aplica) {
    return null;
  }

  const proximaSemana = await prisma.macrocicloSemana.findFirst({
    where: { macrocicloId, fechaFin: { gte: new Date() } },
    orderBy: { numeroSemana: "asc" },
    select: { id: true },
  });
  if (!proximaSemana) {
    return null;
  }

  return crearAjustePropuesto({
    personaId: sesion.personaId,
    macrocicloId,
    alcance: "semana",
    objetivoId: proximaSemana.id,
    propuesta: {
      tipo: "deload",
      magnitudPct: null,
      justificacion: `Se cumplen ${resultado.criteriosCumplidos.length} de 4 señales de fatiga acumulada (con 2 alcanza): ${resultado.criteriosCumplidos.join(", ")}.`,
      evidencia: {
        criteriosCumplidos: resultado.criteriosCumplidos,
        peorCaidaE1rmPct,
        diferenciaRirPromedio,
        sesionesOmitidasPorFatiga,
        rpeSesionRecientes,
      },
    },
  });
}

// TASK-031 · Los 10 invariantes de R-16. El motor no publica un plan que
// viole alguno de ellos (ver services/planificacion.service.ts, Bloque H).
import { diasEntre } from "@/lib/macrociclo";
import { MAX_SEMANAS_SIN_DESCARGA } from "@/lib/config/parametros";
import { MINUTOS_POR_SERIE_ESTIMADO } from "./prescripcion";
import type { EjercicioCatalogo, PropuestaPlan } from "./tipos";

function semanasEnRango(fechaInicio: Date, fechaFin: Date): number {
  return Math.round((diasEntre(fechaInicio, fechaFin) + 1) / 7);
}

/** Tolerancia sobre el presupuesto de minutos (invariante #8: hasta un 20% de exceso). */
const TOLERANCIA_MINUTOS = 1.2;

export function validarPlan(
  propuesta: PropuestaPlan,
  catalogo: EjercicioCatalogo[],
): string[] {
  const errores: string[] = [];
  const catalogoPorId = new Map(catalogo.map((e) => [e.id, e]));

  // #1 · Σ semanas periodos = Σ semanas etapas = Σ semanas mesociclos = total.
  const semanasPeriodos = propuesta.periodos.reduce(
    (sum, p) => sum + semanasEnRango(p.fechaInicio, p.fechaFin),
    0,
  );
  if (semanasPeriodos !== propuesta.totalSemanas) {
    errores.push(
      `#1 La suma de semanas de periodos (${semanasPeriodos}) no coincide con el total (${propuesta.totalSemanas}).`,
    );
  }
  for (const periodo of propuesta.periodos) {
    const semanasEtapas = periodo.etapas.reduce(
      (sum, e) => sum + semanasEnRango(e.fechaInicio, e.fechaFin),
      0,
    );
    const semanasPeriodo = semanasEnRango(periodo.fechaInicio, periodo.fechaFin);
    if (semanasEtapas !== semanasPeriodo) {
      errores.push(
        `#1 Las etapas de "${periodo.tipo}" suman ${semanasEtapas} semanas pero el periodo tiene ${semanasPeriodo}.`,
      );
    }
  }
  const semanasMesociclos = propuesta.mesociclos.reduce(
    (sum, m) => sum + semanasEnRango(m.fechaInicio, m.fechaFin),
    0,
  );
  if (semanasMesociclos !== propuesta.totalSemanas) {
    errores.push(
      `#1 La suma de semanas de mesociclos (${semanasMesociclos}) no coincide con el total (${propuesta.totalSemanas}).`,
    );
  }

  // #2 · Ninguna fecha de bloque excede fechaFin.
  for (const periodo of propuesta.periodos) {
    if (periodo.fechaFin > propuesta.fechaFin) {
      errores.push(`#2 El periodo "${periodo.tipo}" termina después de fechaFin.`);
    }
    for (const etapa of periodo.etapas) {
      if (etapa.fechaFin > propuesta.fechaFin) {
        errores.push(`#2 La etapa "${etapa.tipo}" (${periodo.tipo}) termina después de fechaFin.`);
      }
    }
  }
  for (const mesociclo of propuesta.mesociclos) {
    if (mesociclo.fechaFin > propuesta.fechaFin) {
      errores.push(`#2 El mesociclo "${mesociclo.tipo}" termina después de fechaFin.`);
    }
  }

  // #3 y #4 · cada semana pertenece exactamente a un mesociclo; ninguna huérfana.
  const ordenesMesociclo = new Set(propuesta.mesociclos.map((m) => m.orden));
  const numerosVistos = new Set<number>();
  for (const semana of propuesta.semanas) {
    if (!ordenesMesociclo.has(semana.mesocicloOrden)) {
      errores.push(`#3 La semana ${semana.numeroSemana} no pertenece a ningún mesociclo válido.`);
    }
    if (numerosVistos.has(semana.numeroSemana)) {
      errores.push(`#3 La semana ${semana.numeroSemana} está duplicada.`);
    }
    numerosVistos.add(semana.numeroSemana);
  }
  for (let n = 1; n <= propuesta.totalSemanas; n += 1) {
    if (!numerosVistos.has(n)) {
      errores.push(`#4 La semana ${n} quedó huérfana (no se generó).`);
    }
  }

  // #5 · al menos una descarga cada MAX_SEMANAS_SIN_DESCARGA semanas consecutivas de carga.
  let semanasSinDescarga = 0;
  for (const semana of propuesta.semanas) {
    if (semana.esDeload) {
      semanasSinDescarga = 0;
    } else {
      semanasSinDescarga += 1;
      if (semanasSinDescarga > MAX_SEMANAS_SIN_DESCARGA) {
        errores.push(
          `#5 Más de ${MAX_SEMANAS_SIN_DESCARGA} semanas consecutivas sin descarga (hasta la semana ${semana.numeroSemana}).`,
        );
      }
    }
  }

  // #10 · no hay dos semanas de choque consecutivas.
  for (let i = 1; i < propuesta.semanas.length; i += 1) {
    if (
      propuesta.semanas[i].tipoMicrociclo === "choque" &&
      propuesta.semanas[i - 1].tipoMicrociclo === "choque"
    ) {
      errores.push(
        `#10 Las semanas ${propuesta.semanas[i - 1].numeroSemana} y ${propuesta.semanas[i].numeroSemana} son ambas de choque.`,
      );
    }
  }

  // #6, #7, #8, #9 · sobre las prescripciones.
  for (const semana of propuesta.semanas) {
    for (const sesion of semana.sesiones) {
      const totalSeries = sesion.prescripciones.reduce((sum, p) => sum + p.series, 0);
      const minutosEstimados = totalSeries * MINUTOS_POR_SERIE_ESTIMADO;
      if (minutosEstimados > sesion.duracionEstimadaMin * TOLERANCIA_MINUTOS) {
        errores.push(
          `#8 La sesión ${sesion.orden} de la semana ${semana.numeroSemana} excede su presupuesto de minutos en más de un 20%.`,
        );
      }

      for (const p of sesion.prescripciones) {
        if ((p.porcentajeRm ?? 0) > 100) {
          errores.push(
            `#6 La prescripción del ejercicio ${p.ejercicioId} en la semana ${semana.numeroSemana} tiene porcentajeRm > 100.`,
          );
        }

        if (p.cargaKg !== null) {
          const ejercicioCatalogo = catalogoPorId.get(p.ejercicioId);
          const incremento = ejercicioCatalogo?.incrementoMinimoKg ?? 2.5;
          const cociente = p.cargaKg / incremento;
          if (Math.abs(cociente - Math.round(cociente)) > 1e-6) {
            errores.push(
              `#7 La carga del ejercicio ${p.ejercicioId} en la semana ${semana.numeroSemana} no es múltiplo del incremento del equipo.`,
            );
          }

          if (p.rmVigenteId === null || p.rmUsadoKg === null) {
            errores.push(
              `#9 La prescripción con carga del ejercicio ${p.ejercicioId} en la semana ${semana.numeroSemana} no tiene rmVigenteId/rmUsadoKg.`,
            );
          }
        }
      }
    }
  }

  return errores;
}

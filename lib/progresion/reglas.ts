// TASK-047 · R-13: detección de rendimiento inferior al esperado y
// propuestas de ajuste. Dominio puro — solo produce PropuestaAjuste[]; nunca
// aplica nada por sí mismo (AC-20).
import { AJUSTE_UMBRALES } from "@/lib/config/parametros";

export type TipoPropuestaAjuste =
  | "subir_carga"
  | "bajar_carga"
  | "deload"
  | "revisar_disponibilidad";

export type PropuestaAjuste = {
  tipo: TipoPropuestaAjuste;
  magnitudPct: number | null;
  justificacion: string;
  evidencia: Record<string, unknown>;
};

export type RegistroSesionEjercicio = {
  fecha: Date;
  repsLogradas: number;
  repsMinObjetivo: number;
  rirReportado: number | null;
  rirObjetivo: number;
};

export type EvaluacionRendimientoEjercicio = {
  ejercicioId: number;
  /** Ordenadas cronológicamente, la más reciente al final. */
  sesiones: RegistroSesionEjercicio[];
  e1rmActual: number | null;
  e1rmMejorDelBloque: number | null;
};

/**
 * R-13. Una sola sesión mala es ruido; dos consecutivas son señal — por eso
 * exige exactamente las últimas 2 sesiones cumpliendo la condición, nunca 1.
 */
export function evaluarRendimientoEjercicio(
  evaluacion: EvaluacionRendimientoEjercicio,
): PropuestaAjuste[] {
  const propuestas: PropuestaAjuste[] = [];
  const ultimasDos = evaluacion.sesiones.slice(-2);

  if (
    ultimasDos.length === 2 &&
    ultimasDos.every((s) => s.repsLogradas < s.repsMinObjetivo)
  ) {
    propuestas.push({
      tipo: "bajar_carga",
      magnitudPct: AJUSTE_UMBRALES.bajarCargaPct,
      justificacion:
        "No alcanzó el mínimo de repeticiones prescrito en las últimas 2 sesiones.",
      evidencia: { ejercicioId: evaluacion.ejercicioId, sesiones: ultimasDos },
    });
  }

  if (
    ultimasDos.length === 2 &&
    ultimasDos.every(
      (s) =>
        s.rirReportado !== null &&
        s.rirReportado - s.rirObjetivo >= AJUSTE_UMBRALES.subirCargaRirPorEncimaDelObjetivo,
    )
  ) {
    propuestas.push({
      tipo: "subir_carga",
      magnitudPct: (AJUSTE_UMBRALES.subirCargaMinPct + AJUSTE_UMBRALES.subirCargaMaxPct) / 2,
      justificacion:
        "El RIR reportado está sistemáticamente por encima del objetivo en las últimas 2 sesiones: hay margen para subir la carga.",
      evidencia: { ejercicioId: evaluacion.ejercicioId, sesiones: ultimasDos },
    });
  }

  if (
    evaluacion.e1rmActual !== null &&
    evaluacion.e1rmMejorDelBloque !== null &&
    evaluacion.e1rmMejorDelBloque > 0
  ) {
    const caidaPct =
      ((evaluacion.e1rmMejorDelBloque - evaluacion.e1rmActual) /
        evaluacion.e1rmMejorDelBloque) *
      100;

    if (caidaPct > AJUSTE_UMBRALES.deloadCaidaE1rmPct) {
      propuestas.push({
        tipo: "deload",
        magnitudPct: null,
        justificacion: `El e1RM cayó ${caidaPct.toFixed(1)}% respecto a la mejor marca del bloque.`,
        evidencia: {
          ejercicioId: evaluacion.ejercicioId,
          e1rmActual: evaluacion.e1rmActual,
          e1rmMejorDelBloque: evaluacion.e1rmMejorDelBloque,
          caidaPct,
        },
      });
    }
  }

  return propuestas;
}

/**
 * R-13: >=30% de sesiones omitidas en el microciclo -> revisar
 * disponibilidad, nunca bajar la carga (separa "no puede" de "no vino").
 */
export function evaluarDisponibilidad(
  sesionesPlanificadas: number,
  sesionesOmitidas: number,
): PropuestaAjuste | null {
  if (sesionesPlanificadas <= 0) {
    return null;
  }

  const pctOmitidas = (sesionesOmitidas / sesionesPlanificadas) * 100;

  if (pctOmitidas < AJUSTE_UMBRALES.disponibilidadSesionesOmitidasPct) {
    return null;
  }

  return {
    tipo: "revisar_disponibilidad",
    magnitudPct: null,
    justificacion: `${sesionesOmitidas} de ${sesionesPlanificadas} sesiones omitidas (${pctOmitidas.toFixed(0)}%) en el microciclo.`,
    evidencia: { sesionesPlanificadas, sesionesOmitidas, pctOmitidas },
  };
}

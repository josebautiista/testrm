// TASK-048 · R-10: deload programado (ya vive en lib/planificacion/estructura.ts
// vía asignarMicrociclos) y deload reactivo — se requieren >=2 de 4 criterios
// para no descargar ciegamente cuando el atleta está bien, ni tarde cuando
// no lo está.
import { DELOAD_REACTIVO_UMBRALES } from "@/lib/config/parametros";

export type CriterioDeloadReactivo =
  | "caida_e1rm"
  | "rir_bajo_objetivo"
  | "sesiones_omitidas"
  | "rpe_alto";

export type CriteriosDeloadReactivo = {
  /** % de caída del e1RM en dos sesiones consecutivas (positivo = cayó). */
  caidaE1rmPct: number | null;
  /** RIR reportado - RIR objetivo, promedio reciente (negativo = por debajo del objetivo). */
  diferenciaRirPromedio: number | null;
  sesionesOmitidasPorFatiga: number;
  /** RPE de sesión de las últimas sesiones, más reciente al final. */
  rpeSesionRecientes: number[];
};

export type ResultadoDeloadReactivo = {
  aplica: boolean;
  criteriosCumplidos: CriterioDeloadReactivo[];
};

export function evaluarDeloadReactivo(
  criterios: CriteriosDeloadReactivo,
): ResultadoDeloadReactivo {
  const cumplidos: CriterioDeloadReactivo[] = [];

  if (
    criterios.caidaE1rmPct !== null &&
    criterios.caidaE1rmPct > DELOAD_REACTIVO_UMBRALES.caidaE1rmPct
  ) {
    cumplidos.push("caida_e1rm");
  }

  if (
    criterios.diferenciaRirPromedio !== null &&
    criterios.diferenciaRirPromedio <= -DELOAD_REACTIVO_UMBRALES.diferenciaRirObjetivo
  ) {
    cumplidos.push("rir_bajo_objetivo");
  }

  if (criterios.sesionesOmitidasPorFatiga >= DELOAD_REACTIVO_UMBRALES.sesionesOmitidas) {
    cumplidos.push("sesiones_omitidas");
  }

  const ultimasTres = criterios.rpeSesionRecientes.slice(-3);
  if (
    ultimasTres.length === 3 &&
    ultimasTres.every((rpe) => rpe >= DELOAD_REACTIVO_UMBRALES.rpeSesionMinimo)
  ) {
    cumplidos.push("rpe_alto");
  }

  return {
    aplica: cumplidos.length >= DELOAD_REACTIVO_UMBRALES.criteriosMinimosRequeridos,
    criteriosCumplidos: cumplidos,
  };
}

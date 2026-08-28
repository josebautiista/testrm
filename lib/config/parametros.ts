// TASK-027 · Todas las constantes numéricas del motor de planificación en un
// solo sitio, con su justificación (§18 PLAN-MAESTRO.md pide un comentario
// por constante citando su origen). No disperso en componentes/lib.

export type ObjetivoBloque =
  | "fuerza_maxima"
  | "hipertrofia"
  | "resistencia_fuerza"
  | "potencia"
  | "acumulacion"
  | "realizacion"
  | "recuperacion";

export type ProgresionBloque =
  | "lineal_intensidad"
  | "lineal_volumen"
  | "ondulante"
  | "mantenimiento";

export type ZonaIntensidad = {
  intensidadMinPct: number;
  intensidadMaxPct: number;
  repsMin: number;
  repsMax: number;
  rirMin: number;
  rirMax: number;
};

/**
 * R-04. Alineado con la tabla ya presente en lib/training.ts (que refleja
 * ACSM 2009), ampliada con RIR — lo que permite que la carga siga siendo
 * correcta cuando el 1RM ha cambiado desde el último test (ADR-06).
 */
export const ZONAS_INTENSIDAD: Record<ObjetivoBloque, ZonaIntensidad> = {
  resistencia_fuerza: { intensidadMinPct: 50, intensidadMaxPct: 65, repsMin: 12, repsMax: 20, rirMin: 2, rirMax: 3 },
  hipertrofia: { intensidadMinPct: 65, intensidadMaxPct: 80, repsMin: 6, repsMax: 12, rirMin: 1, rirMax: 3 },
  acumulacion: { intensidadMinPct: 65, intensidadMaxPct: 80, repsMin: 6, repsMax: 12, rirMin: 1, rirMax: 3 },
  fuerza_maxima: { intensidadMinPct: 80, intensidadMaxPct: 92, repsMin: 3, repsMax: 6, rirMin: 1, rirMax: 2 },
  realizacion: { intensidadMinPct: 80, intensidadMaxPct: 92, repsMin: 3, repsMax: 6, rirMin: 1, rirMax: 2 },
  potencia: { intensidadMinPct: 85, intensidadMaxPct: 95, repsMin: 1, repsMax: 3, rirMin: 1, rirMax: 2 },
  recuperacion: { intensidadMinPct: 50, intensidadMaxPct: 65, repsMin: 5, repsMax: 8, rirMin: 4, rirMax: 5 },
};

export type RangoVolumen = { seriesMin: number; seriesMax: number };

/**
 * R-03. Series efectivas por grupo muscular y semana. El bloque empieza
 * cerca del extremo bajo y progresa hacia el alto (R-08, F-06).
 */
export const RANGOS_VOLUMEN: Record<ObjetivoBloque, RangoVolumen> = {
  recuperacion: { seriesMin: 4, seriesMax: 8 },
  resistencia_fuerza: { seriesMin: 8, seriesMax: 14 },
  hipertrofia: { seriesMin: 10, seriesMax: 20 },
  acumulacion: { seriesMin: 10, seriesMax: 20 },
  fuerza_maxima: { seriesMin: 6, seriesMax: 12 },
  realizacion: { seriesMin: 6, seriesMax: 12 },
  potencia: { seriesMin: 4, seriesMax: 10 },
};

/** R-08: progresión intra-mesociclo por tipo de bloque. */
export const PROGRESION_POR_OBJETIVO: Record<ObjetivoBloque, ProgresionBloque> = {
  fuerza_maxima: "lineal_intensidad",
  realizacion: "lineal_intensidad",
  potencia: "lineal_intensidad",
  hipertrofia: "lineal_volumen",
  acumulacion: "lineal_volumen",
  resistencia_fuerza: "ondulante",
  recuperacion: "mantenimiento",
};

/** R-08: incremento de %1RM por semana en bloques de fuerza (ola de intensidad). */
export const INCREMENTO_INTENSIDAD_SEMANAL_PCT = { min: 2.5, max: 5 };
/** R-08: incremento de series por patrón por semana en bloques de hipertrofia (ola de volumen). */
export const INCREMENTO_VOLUMEN_SEMANAL_SERIES = { min: 1, max: 2 };

/** R-10: deload programado. */
export const DELOAD = {
  /** Cada 4ª semana en bloques de acumulación. */
  frecuenciaSemanasEstandar: 4,
  /** Cada 3ª para atletas avanzados con alta intensidad. */
  frecuenciaSemanasAvanzado: 3,
  volumenFactorMin: 0.5, // -50%
  volumenFactorMax: 0.6, // -40%
  intensidadFactorMin: 0.9, // -10%
  intensidadFactorMax: 1, // sin cambio
};

/** R-10 reactivo: se requieren >= 2 de estos 4 criterios. */
export const DELOAD_REACTIVO_UMBRALES = {
  caidaE1rmPct: 5, // en dos sesiones consecutivas
  diferenciaRirObjetivo: 2, // por debajo del objetivo, sistemáticamente
  sesionesOmitidas: 2, // por fatiga
  rpeSesionMinimo: 9, // en tres sesiones seguidas
  criteriosMinimosRequeridos: 2,
};

/** R-02: frecuencia semanal por grupo muscular y división de sesiones por días/semana. */
export const FRECUENCIA = {
  seriesMinimaPorGrupoSemana: 2, // sesiones por grupo muscular objetivo
  diasParaCuerpoCompleto: 2, // diasPorSemana <= esto -> cuerpo completo
  diasParaTorsoPierna: 4, // diasPorSemana <= esto -> torso/pierna o cuerpo completo
  diasParaDivisionPatron: 5, // diasPorSemana >= esto -> división por patrón
};

/** R-13: reglas de rendimiento inferior al esperado -> AjustePropuesto. */
export const AJUSTE_UMBRALES = {
  bajarCargaPct: 5,
  bajarCargaSesionesConsecutivas: 2,
  subirCargaMinPct: 2.5,
  subirCargaMaxPct: 5,
  subirCargaRirPorEncimaDelObjetivo: 2,
  subirCargaSesiones: 2,
  deloadCaidaE1rmPct: 10,
  disponibilidadSesionesOmitidasPct: 30,
};

/** R-15: caducidad del RM — reexportado desde lib/rm/vigente.ts para un único punto de referencia. */
export {
  CADUCIDAD_SEMANAS_AVISO,
  CADUCIDAD_SEMANAS_CONFIANZA_BAJA,
} from "@/lib/rm/vigente";

/** F-04: redondeo hacia abajo al incremento cargable del ejercicio. */
export function redondearAIncremento(pesoTeorico: number, incrementoMinimoKg: number): number {
  if (!Number.isFinite(pesoTeorico) || pesoTeorico <= 0) {
    return 0;
  }
  const incremento = incrementoMinimoKg > 0 ? incrementoMinimoKg : 2.5;
  return Math.floor(pesoTeorico / incremento) * incremento;
}

/** R-16 invariante 5 / R-10: al menos una descarga cada N semanas consecutivas de carga. */
export const MAX_SEMANAS_SIN_DESCARGA = 6;

// Estimador primario de 1RM, banda de incertidumbre y nivel de confianza.
// Corrige D-02 (§0.2 PLAN-MAESTRO.md): nunca se usa max() entre fórmulas
// como estimador puntual. Ver F-01, F-02 y ADR-01/ADR-02/ADR-03.

import {
  calculateEpley,
  calculateRM,
  getMaxFormulaRM,
  getMinFormulaRM,
} from "@/lib/rm/formulas";

export type ConfianzaRM = "alta" | "media" | "baja";

export type EstimacionRM = {
  /** Estimación puntual (fórmula primaria: Epley). */
  valor: number;
  /** Banda de incertidumbre entre las 8 fórmulas (F-02). No es un intervalo estadístico. */
  min: number;
  max: number;
  confianza: ConfianzaRM;
  /** true si las repeticiones caen fuera de la ventana válida [1,10]. */
  fueraDeRango: boolean;
  /** true si la estimación no debe usarse para prescribir (r > 15, o r >= 30 bloqueado). */
  noUtilizable: boolean;
};

/** Bloqueo duro: evita las singularidades de Brzycki/Lander (D-04). */
export const REPETICIONES_BLOQUEO_DURO = 30;
/** Ventana válida de referencia (ADR-03). */
export const REPETICIONES_VENTANA_VALIDA = { min: 1, max: 10 } as const;
/** Por encima de este umbral, la estimación deja de ser utilizable para prescribir. */
export const REPETICIONES_LIMITE_UTILIZABLE = 15;

function resolverConfianza(
  reps: number,
  rirReportado?: number | null,
): ConfianzaRM {
  if (reps <= 5 && typeof rirReportado === "number" && rirReportado <= 1) {
    return "alta";
  }

  if (reps <= REPETICIONES_VENTANA_VALIDA.max) {
    return "media";
  }

  return "baja";
}

/**
 * Estima el 1RM a partir de una serie submáxima.
 * Nunca lanza: con entradas inválidas devuelve una estimación en cero.
 */
export function estimarRm(
  carga: number,
  repeticiones: number,
  opciones: { sexo?: string; rirReportado?: number | null } = {},
): EstimacionRM {
  if (
    !Number.isFinite(carga) ||
    !Number.isFinite(repeticiones) ||
    carga < 0 ||
    repeticiones <= 0
  ) {
    return {
      valor: 0,
      min: 0,
      max: 0,
      confianza: "baja",
      fueraDeRango: true,
      noUtilizable: true,
    };
  }

  // Bloqueo duro: por encima de este umbral las fórmulas de Brzycki/Lander
  // cruzan su singularidad y producen valores negativos (D-04).
  if (repeticiones >= REPETICIONES_BLOQUEO_DURO) {
    return {
      valor: 0,
      min: 0,
      max: 0,
      confianza: "baja",
      fueraDeRango: true,
      noUtilizable: true,
    };
  }

  const valor = calculateEpley(carga, repeticiones);
  const todas = calculateRM(carga, repeticiones, opciones.sexo);
  const min = getMinFormulaRM(todas);
  const max = getMaxFormulaRM(todas);

  const fueraDeRango =
    repeticiones < REPETICIONES_VENTANA_VALIDA.min ||
    repeticiones > REPETICIONES_VENTANA_VALIDA.max;
  const noUtilizable = repeticiones > REPETICIONES_LIMITE_UTILIZABLE;

  const confianza = fueraDeRango
    ? "baja"
    : resolverConfianza(repeticiones, opciones.rirReportado);

  return { valor, min, max, confianza, fueraDeRango, noUtilizable };
}

/**
 * e1RM con RIR (F-03): estima 1RM desde una serie de entrenamiento sin test
 * dedicado. Solo válido si repeticiones + RIR <= 10 y RIR <= 3.
 */
export function estimarE1rmConRir(
  carga: number,
  repeticiones: number,
  rir: number,
): { valor: number; valido: boolean } {
  if (
    !Number.isFinite(carga) ||
    !Number.isFinite(repeticiones) ||
    !Number.isFinite(rir) ||
    carga < 0 ||
    repeticiones <= 0 ||
    rir < 0
  ) {
    return { valor: 0, valido: false };
  }

  const valido = repeticiones + rir <= 10 && rir <= 3;
  const valor = calculateEpley(carga, repeticiones + rir);

  return { valor, valido };
}

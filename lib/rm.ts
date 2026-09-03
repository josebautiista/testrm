import { getPorcentajeMasa } from "@/helpers/calculations";
import {
  calculateBaechle,
  calculateBrzycki,
  calculateEpley,
  calculateLander,
  calculateLombardi,
  calculateMayhew,
  calculateOconnor,
  calculateRM,
  calculateWathen,
  roundToTwo,
  type RMResult,
  type SexoRM,
} from "@/lib/rm/formulas";

export type { RMResult, SexoRM };
export { calculateRM, roundToTwo };

export type StrengthIndexLabel =
  | "Bajo"
  | "Regular"
  | "Buena"
  | "Muy buena"
  | "Excelente";

export type StrengthIndexResult = {
  total: number;
  label: StrengthIndexLabel;
};

type SessionExercise = {
  id: number;
  porcentajeMasaHombre: number;
  porcentajeMasaMujer: number;
};

type SessionReps = {
  ejercicioId: number;
  repeticiones: number;
};

type SessionRMResult = {
  ejercicioId: number;
  repeticiones: number;
  carga: number;
  valor: number;
} & RMResult;

const REPETITION_VALUES = [5, 7, 9, 11, 13, 15, 17] as const;
const STRENGTH_REPETITION_LIMITS = [3, 5, 8, 10, 15, 24, Infinity] as const;

function ensureValidNumber(value: number) {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }

  return value;
}

export function calculateRepetitionValue(
  repeticiones: number,
  _ejercicioId?: number,
  _sexo?: SexoRM | string,
): number {
  void _ejercicioId;
  void _sexo;

  if (!Number.isFinite(repeticiones)) {
    return 0;
  }

  const reps = Math.abs(Math.floor(repeticiones));
  const valueIndex = STRENGTH_REPETITION_LIMITS.findIndex(
    (limit) => reps <= limit,
  );

  return valueIndex >= 0 ? REPETITION_VALUES[valueIndex] : 0;
}

/** F-12/TASK-053: valor máximo alcanzable por ejercicio (banda 24 o menos reps -> 17). */
const VALOR_MAXIMO_POR_EJERCICIO = Math.max(...REPETITION_VALUES);

/**
 * F-12 (corrige D-18): umbrales sobre una escala 0–100, no sobre la suma
 * cruda. Los umbrales originales (≤53/65/77/89 sobre un máximo implícito de
 * 6 ejercicios × 17 = 102) se preservan convertidos a porcentaje de ese
 * máximo, para no inventar una nueva calibración sin respaldo:
 * 53/102≈52%, 65/102≈64%, 77/102≈75%, 89/102≈87%.
 */
export function getStrengthIndexClassification(
  indiceNormalizado: number,
): StrengthIndexLabel {
  if (!Number.isFinite(indiceNormalizado)) {
    return "Bajo";
  }

  const valor = Math.abs(indiceNormalizado);

  if (valor <= 52) {
    return "Bajo";
  }

  if (valor <= 64) return "Regular";
  if (valor <= 75) return "Buena";
  if (valor <= 87) return "Muy buena";
  return "Excelente";
}

/**
 * F-12: índice = (Σ valores / (n_ejercicios × valor_máximo)) × 100. Antes
 * sumaba valores sin normalizar por el número de ejercicios evaluados, así
 * que con 4 ejercicios el máximo alcanzable (68) nunca llegaba a
 * "Excelente" (D-18). Referencia interna del proyecto, sin validación
 * externa (ver docs/DECISIONES.md ADR-19).
 */
export function calculateStrengthIndex(
  resultados: Array<{ ejercicioId: number; repeticiones: number }>,
  sexo: SexoRM | string = "masculino",
): StrengthIndexResult {
  const totalCrudo = resultados.reduce(
    (sum, resultado) =>
      sum +
      calculateRepetitionValue(
        resultado.repeticiones,
        resultado.ejercicioId,
        sexo,
      ),
    0,
  );

  const maximoPosible = resultados.length * VALOR_MAXIMO_POR_EJERCICIO;
  const indiceNormalizado = maximoPosible > 0 ? (totalCrudo / maximoPosible) * 100 : 0;

  return {
    total: roundToTwo(indiceNormalizado),
    label: getStrengthIndexClassification(indiceNormalizado),
  };
}

export function calculateRMForSession(
  masaCorporal: number,
  ejercicios: SessionExercise[],
  reps: SessionReps[],
  sexo: SexoRM | string = "masculino",
): SessionRMResult[] {
  const safeMasaCorporal = Number.isFinite(masaCorporal) ? masaCorporal : 0;

  const repsMap = new Map<number, number>();
  for (const repItem of reps) {
    const repeticiones = Number.isFinite(repItem.repeticiones)
      ? Math.max(0, repItem.repeticiones)
      : 0;
    repsMap.set(repItem.ejercicioId, repeticiones);
  }

  return ejercicios.map((ejercicio) => {
    const repeticiones = repsMap.get(ejercicio.id) ?? 0;
    const cargaRaw = safeMasaCorporal * getPorcentajeMasa({ sexo }, ejercicio);
    const carga = roundToTwo(ensureValidNumber(cargaRaw));
    const rm = calculateRM(carga, repeticiones, sexo);

    return {
      ejercicioId: ejercicio.id,
      repeticiones,
      carga,
      valor: calculateRepetitionValue(repeticiones, ejercicio.id, sexo),
      ...rm,
    };
  });
}

// Backward-compatible aliases for existing imports.
export const epley = calculateEpley;
export const brzycki = calculateBrzycki;
export const lombardi = calculateLombardi;
export const lander = calculateLander;
export const oconnor = calculateOconnor;
export const mayhew = calculateMayhew;
export const wathen = calculateWathen;
export const baechle = calculateBaechle;

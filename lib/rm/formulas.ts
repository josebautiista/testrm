// Las 8 fórmulas predictivas de 1RM, extraídas de lib/rm.ts (TASK-002).
//
// ADR-22 (docs/DECISIONES.md): la rama "femenino" reimplementaba los mismos
// coeficientes que la rama masculina bajo otro nombre (D-03) — no había
// ninguna diferenciación real por sexo. Se elimina esa duplicación y se deja
// un único conjunto de fórmulas hasta que exista una fuente científica que
// justifique coeficientes distintos por sexo.

export type RMResult = {
  epley: number;
  brzycki: number;
  lombardi: number;
  lander: number;
  oconnor: number;
  mayhew: number;
  wathen: number;
  baechle: number;
};

export type SexoRM = "masculino" | "femenino";

export const ZERO_RM_RESULT: RMResult = {
  epley: 0,
  brzycki: 0,
  lombardi: 0,
  lander: 0,
  oconnor: 0,
  mayhew: 0,
  wathen: 0,
  baechle: 0,
};

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toValidInputs(carga: number, reps: number) {
  if (!Number.isFinite(carga) || !Number.isFinite(reps)) {
    return null;
  }

  if (reps <= 0 || carga < 0) {
    return null;
  }

  return {
    carga,
    reps,
  };
}

function safeDivide(numerator: number, denominator: number) {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return 0;
  }

  return numerator / denominator;
}

function ensureValidNumber(value: number) {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }

  return value;
}

export function normalizeSexo(sexo?: string): SexoRM {
  if (typeof sexo !== "string") {
    return "masculino";
  }

  const normalized = sexo.trim().toLowerCase();
  return normalized === "femenino" ? "femenino" : "masculino";
}

export function calculateEpley(carga: number, reps: number): number {
  const input = toValidInputs(carga, reps);
  if (!input) {
    return 0;
  }

  const result = input.carga * (1 + 0.0333 * input.reps);
  return roundToTwo(ensureValidNumber(result));
}

export function calculateBrzycki(carga: number, reps: number): number {
  const input = toValidInputs(carga, reps);
  if (!input) {
    return 0;
  }

  const denominator = 1.0278 - 0.0278 * input.reps;
  const result = safeDivide(input.carga, denominator);
  return roundToTwo(ensureValidNumber(result));
}

export function calculateLombardi(carga: number, reps: number): number {
  const input = toValidInputs(carga, reps);
  if (!input) {
    return 0;
  }

  const result = input.carga * input.reps ** 0.1;
  return roundToTwo(ensureValidNumber(result));
}

export function calculateLander(carga: number, reps: number): number {
  const input = toValidInputs(carga, reps);
  if (!input) {
    return 0;
  }

  const denominator = 1.013 - 0.0267123 * input.reps;
  const result = safeDivide(input.carga, denominator);
  return roundToTwo(ensureValidNumber(result));
}

export function calculateOconnor(carga: number, reps: number): number {
  const input = toValidInputs(carga, reps);
  if (!input) {
    return 0;
  }

  const result = input.carga * (1 + 0.025 * input.reps);
  return roundToTwo(ensureValidNumber(result));
}

export function calculateMayhew(carga: number, reps: number): number {
  const input = toValidInputs(carga, reps);
  if (!input) {
    return 0;
  }

  const denominator = 52.2 + 41.9 * Math.exp(-0.055 * input.reps);
  const result = safeDivide(100 * input.carga, denominator);
  return roundToTwo(ensureValidNumber(result));
}

export function calculateWathen(carga: number, reps: number): number {
  const input = toValidInputs(carga, reps);
  if (!input) {
    return 0;
  }

  const denominator = 48.8 + 53.8 * Math.exp(-0.075 * input.reps);
  const result = safeDivide(100 * input.carga, denominator);
  return roundToTwo(ensureValidNumber(result));
}

export function calculateBaechle(carga: number, reps: number): number {
  const input = toValidInputs(carga, reps);
  if (!input) {
    return 0;
  }

  const result = input.carga * (1 + 0.033 * input.reps);
  return roundToTwo(ensureValidNumber(result));
}

export function calculateRM(
  carga: number,
  reps: number,
  sexo: SexoRM | string = "masculino",
): RMResult {
  void normalizeSexo(sexo); // sexo aceptado por compatibilidad de firma; ver ADR-22.

  if (
    !Number.isFinite(carga) ||
    !Number.isFinite(reps) ||
    reps <= 0 ||
    carga < 0
  ) {
    return { ...ZERO_RM_RESULT };
  }

  return {
    epley: calculateEpley(carga, reps),
    brzycki: calculateBrzycki(carga, reps),
    lombardi: calculateLombardi(carga, reps),
    lander: calculateLander(carga, reps),
    oconnor: calculateOconnor(carga, reps),
    mayhew: calculateMayhew(carga, reps),
    wathen: calculateWathen(carga, reps),
    baechle: calculateBaechle(carga, reps),
  };
}

export function getMaxFormulaRM(result: RMResult): number {
  return Math.max(
    result.epley,
    result.brzycki,
    result.lombardi,
    result.lander,
    result.oconnor,
    result.mayhew,
    result.wathen,
    result.baechle,
  );
}

export function getMinFormulaRM(result: RMResult): number {
  return Math.min(
    result.epley,
    result.brzycki,
    result.lombardi,
    result.lander,
    result.oconnor,
    result.mayhew,
    result.wathen,
    result.baechle,
  );
}

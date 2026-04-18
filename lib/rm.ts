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

type SessionExercise = {
  id: number;
  porcentajeMasa: number;
};

type SessionReps = {
  ejercicioId: number;
  repeticiones: number;
};

type SessionRMResult = {
  ejercicioId: number;
  repeticiones: number;
  carga: number;
} & RMResult;

const ZERO_RM_RESULT: RMResult = {
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

export function calculateRM(carga: number, reps: number): RMResult {
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

export function calculateRMForSession(
  masaCorporal: number,
  ejercicios: SessionExercise[],
  reps: SessionReps[],
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
    const cargaRaw = safeMasaCorporal * ejercicio.porcentajeMasa;
    const carga = roundToTwo(ensureValidNumber(cargaRaw));
    const rm = calculateRM(carga, repeticiones);

    return {
      ejercicioId: ejercicio.id,
      repeticiones,
      carga,
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

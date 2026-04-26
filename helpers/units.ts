export function normalizeHeightToMeters(value: number): number {
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }

  return value > 3 ? value / 100 : value;
}

export function normalizeWeightToKilograms(value: number): number {
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }

  return value > 150 ? value * 0.453592 : value;
}

export function normalizeCircumferenceToCentimeters(value: number): number {
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }

  return value < 10 ? value * 100 : value;
}

export function calculateInitialWeight(rm: number, bodyWeight: number) {
  const rel = rm / bodyWeight;

  if (rel <= 1) return rm * 0.3;
  if (rel < 3) return rm * 0.3 * rel;
  return rm * 0.666;
}

export function calculateKIES(rm: number, initial: number, series: number) {
  return (rm - initial) / (series - 1);
}

export function generateSeries(rm: number, bodyWeight: number, series = 8) {
  const initial = calculateInitialWeight(rm, bodyWeight);
  const kies = calculateKIES(rm, initial, series);

  return Array.from({ length: series }).map((_, i) => {
    return {
      serie: i + 1,
      peso: Math.round(initial + kies * i),
      reps: i < 5 ? 3 : i < 7 ? 2 : 1,
    };
  });
}

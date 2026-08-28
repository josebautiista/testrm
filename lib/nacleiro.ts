import { roundWeight } from "@/lib/training";

// ADR-18 (pendiente, docs/DECISIONES.md): el origen de calculateInitialWeight
// y de la fórmula KIES no está documentado con una fuente bibliográfica.
// Se conserva el comportamiento existente; falta que el entrenador aporte
// la referencia o la declare como convención propia del proyecto.
export function calculateInitialWeight(rm: number, bodyWeight: number) {
  if (!Number.isFinite(rm) || !Number.isFinite(bodyWeight) || bodyWeight <= 0) {
    return 0;
  }

  const rel = rm / bodyWeight;

  if (rel <= 1) return rm * 0.3;
  if (rel < 3) return rm * 0.3 * rel;
  return rm * 0.666;
}

/**
 * D-06: calculateKIES dividía por (series - 1) sin validar series > 1,
 * produciendo Infinity/NaN con series = 1. Ahora exige series >= 2.
 */
export function calculateKIES(rm: number, initial: number, series: number) {
  if (!Number.isInteger(series) || series < 2) {
    return 0;
  }

  if (!Number.isFinite(rm) || !Number.isFinite(initial)) {
    return 0;
  }

  return (rm - initial) / (series - 1);
}

/**
 * D-06: los pesos generados se redondean al incremento cargable (2.5 kg,
 * mismo criterio que lib/training.ts roundWeight) en vez de Math.round(),
 * que podía producir pesos no cargables en una barra/máquina de placas.
 * Exige series >= 2 (ver calculateKIES); con series <= 1 devuelve [].
 */
export function generateSeries(rm: number, bodyWeight: number, series = 8) {
  if (!Number.isInteger(series) || series < 2) {
    return [];
  }

  const initial = calculateInitialWeight(rm, bodyWeight);
  const kies = calculateKIES(rm, initial, series);

  return Array.from({ length: series }).map((_, i) => {
    return {
      serie: i + 1,
      peso: roundWeight(initial + kies * i),
      reps: i < 5 ? 3 : i < 7 ? 2 : 1,
    };
  });
}

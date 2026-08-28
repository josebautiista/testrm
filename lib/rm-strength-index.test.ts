import { describe, expect, it } from "vitest";

import { calculateStrengthIndex, getStrengthIndexClassification } from "./rm";

describe("calculateStrengthIndex (F-12, corrige D-18)", () => {
  it("la escala es comparable con 4 y con 6 ejercicios", () => {
    // Mismo desempeño relativo (todas las reps en la banda más alta),
    // distinto número de ejercicios evaluados.
    const resultados4 = [
      { ejercicioId: 1, repeticiones: 30 },
      { ejercicioId: 2, repeticiones: 30 },
      { ejercicioId: 3, repeticiones: 30 },
      { ejercicioId: 4, repeticiones: 30 },
    ];
    const resultados6 = [...resultados4,
      { ejercicioId: 5, repeticiones: 30 },
      { ejercicioId: 6, repeticiones: 30 },
    ];

    const indice4 = calculateStrengthIndex(resultados4);
    const indice6 = calculateStrengthIndex(resultados6);

    expect(indice4.total).toBe(indice6.total);
    expect(indice4.label).toBe(indice6.label);
  });

  it("con 4 ejercicios en la banda máxima, se puede llegar a Excelente (antes era imposible, D-18)", () => {
    const resultados = [
      { ejercicioId: 1, repeticiones: 30 },
      { ejercicioId: 2, repeticiones: 30 },
      { ejercicioId: 3, repeticiones: 30 },
      { ejercicioId: 4, repeticiones: 30 },
    ];
    const indice = calculateStrengthIndex(resultados);
    expect(indice.total).toBe(100);
    expect(indice.label).toBe("Excelente");
  });

  it("índice 0 clasifica como Bajo", () => {
    expect(getStrengthIndexClassification(0)).toBe("Bajo");
  });

  it("sin resultados no divide por cero", () => {
    const indice = calculateStrengthIndex([]);
    expect(indice.total).toBe(0);
    expect(Number.isFinite(indice.total)).toBe(true);
  });

  it("el índice nunca excede 100", () => {
    const resultados = Array.from({ length: 10 }, (_, i) => ({
      ejercicioId: i + 1,
      repeticiones: 1,
    }));
    expect(calculateStrengthIndex(resultados).total).toBeLessThanOrEqual(100);
  });
});

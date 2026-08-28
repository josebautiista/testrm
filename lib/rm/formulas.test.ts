import { describe, expect, it } from "vitest";

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
  getMaxFormulaRM,
  getMinFormulaRM,
  roundToTwo,
} from "./formulas";

const REPS = [1, 3, 5, 8, 10, 15, 20, 36, 37, 38, 40] as const;
const CARGA = 100;

describe("fórmulas individuales — caracterización con carga=100", () => {
  it.each(REPS)("calculateEpley(100, %i) nunca es negativo ni infinito", (reps) => {
    const value = calculateEpley(CARGA, reps);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  });

  it("calculateEpley coincide con la fórmula 1RM = carga * (1 + 0.0333 * r)", () => {
    expect(calculateEpley(100, 5)).toBeCloseTo(100 * (1 + 0.0333 * 5), 2);
    expect(calculateEpley(100, 1)).toBeCloseTo(100 * (1 + 0.0333 * 1), 2);
    expect(calculateEpley(100, 10)).toBeCloseTo(100 * (1 + 0.0333 * 10), 2);
  });

  it("calculateBrzycki: singularidad cerca de r=36.97 documentada, no debe producir Infinity", () => {
    for (const reps of [36, 37, 38, 40]) {
      const value = calculateBrzycki(CARGA, reps);
      expect(Number.isFinite(value)).toBe(true);
    }
    // Comportamiento actual (pre-existente, documentado por TASK-003):
    // por encima del cero de 1.0278 - 0.0278r (~r=36.97) el denominador se
    // vuelve negativo y por tanto Brzycki produce un resultado negativo.
    expect(calculateBrzycki(CARGA, 37)).toBeLessThan(0);
    expect(calculateBrzycki(CARGA, 40)).toBeLessThan(0);
    // En el cero exacto (denominador === 0) safeDivide devuelve 0.
    const zeroReps = 1.0278 / 0.0278;
    expect(calculateBrzycki(CARGA, zeroReps)).toBe(0);
  });

  it("calculateLander: singularidad cerca de r=37.92 documentada, no debe producir Infinity", () => {
    for (const reps of [36, 37, 38, 40]) {
      const value = calculateLander(CARGA, reps);
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(calculateLander(CARGA, 38)).toBeLessThan(0);
    expect(calculateLander(CARGA, 40)).toBeLessThan(0);
  });

  it.each(REPS)("calculateLombardi(100, %i) nunca es negativo ni infinito", (reps) => {
    const value = calculateLombardi(CARGA, reps);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  });

  it.each(REPS)("calculateOconnor(100, %i) nunca es negativo ni infinito", (reps) => {
    const value = calculateOconnor(CARGA, reps);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  });

  it.each(REPS)("calculateMayhew(100, %i) nunca es negativo ni infinito", (reps) => {
    const value = calculateMayhew(CARGA, reps);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  });

  it.each(REPS)("calculateWathen(100, %i) nunca es negativo ni infinito", (reps) => {
    const value = calculateWathen(CARGA, reps);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  });

  it.each(REPS)("calculateBaechle(100, %i) nunca es negativo ni infinito", (reps) => {
    const value = calculateBaechle(CARGA, reps);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  });

  it("entradas inválidas devuelven 0, no NaN ni Infinity", () => {
    for (const fn of [
      calculateEpley,
      calculateBrzycki,
      calculateLombardi,
      calculateLander,
      calculateOconnor,
      calculateMayhew,
      calculateWathen,
      calculateBaechle,
    ]) {
      expect(fn(0, 0)).toBe(0);
      expect(fn(-10, 5)).toBe(0);
      expect(fn(100, -5)).toBe(0);
      expect(fn(NaN, 5)).toBe(0);
      expect(fn(100, NaN)).toBe(0);
      expect(fn(Infinity, 5)).toBe(0);
      expect(fn(100, Infinity)).toBe(0);
    }
  });

  it("roundToTwo es idempotente", () => {
    const value = roundToTwo(123.456789);
    expect(roundToTwo(value)).toBe(value);
    expect(value).toBe(123.46);
  });
});

describe("calculateRM — conjunto de 8 fórmulas", () => {
  it("devuelve las 8 fórmulas para una entrada válida", () => {
    const result = calculateRM(100, 5);
    expect(Object.keys(result).sort()).toEqual(
      [
        "baechle",
        "brzycki",
        "epley",
        "lander",
        "lombardi",
        "mayhew",
        "oconnor",
        "wathen",
      ].sort(),
    );
  });

  it("reps<=0 o carga<0 devuelve el resultado cero", () => {
    const result = calculateRM(100, 0);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });

  it("D-03: 'masculino' y 'femenino' producen el mismo resultado (sin diferenciación real, ver ADR-22)", () => {
    const masculino = calculateRM(100, 5, "masculino");
    const femenino = calculateRM(100, 5, "femenino");
    expect(femenino).toEqual(masculino);
  });

  it("getMaxFormulaRM/getMinFormulaRM delimitan la banda de incertidumbre", () => {
    const result = calculateRM(100, 5);
    const max = getMaxFormulaRM(result);
    const min = getMinFormulaRM(result);
    expect(min).toBeLessThanOrEqual(max);
    for (const value of Object.values(result)) {
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    }
  });
});

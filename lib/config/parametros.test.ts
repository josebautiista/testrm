import { describe, expect, it } from "vitest";

import { redondearAIncremento } from "./parametros";

describe("redondearAIncremento (F-04)", () => {
  it.each([
    [101, 2.5, 100],
    [103.7, 2.5, 102.5],
    [107, 5, 105],
    [23, 20, 20],
    [19, 20, 0],
    [50, 1, 50],
    [50.9, 1, 50],
  ])("redondea %d con incremento %d hacia abajo a %d", (peso, incremento, esperado) => {
    expect(redondearAIncremento(peso, incremento)).toBeCloseTo(esperado, 5);
  });

  it("nunca redondea por encima del valor teórico", () => {
    for (let peso = 1; peso < 200; peso += 1.3) {
      for (const incremento of [1, 2.5, 5, 20]) {
        expect(redondearAIncremento(peso, incremento)).toBeLessThanOrEqual(peso);
      }
    }
  });

  it("siempre es múltiplo exacto del incremento", () => {
    for (let peso = 1; peso < 200; peso += 2.3) {
      const incremento = 2.5;
      const resultado = redondearAIncremento(peso, incremento);
      const cociente = resultado / incremento;
      expect(Math.abs(cociente - Math.round(cociente))).toBeLessThan(1e-9);
    }
  });

  it("peso <= 0 o incremento inválido no lanza", () => {
    expect(redondearAIncremento(0, 2.5)).toBe(0);
    expect(redondearAIncremento(-5, 2.5)).toBe(0);
    expect(redondearAIncremento(100, 0)).toBe(100); // fallback a 2.5 -> 100 es múltiplo
  });
});

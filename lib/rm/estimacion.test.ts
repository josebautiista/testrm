import { describe, expect, it } from "vitest";

import {
  estimarE1rmConRir,
  estimarRm,
  REPETICIONES_BLOQUEO_DURO,
} from "./estimacion";

describe("estimarRm", () => {
  it("rmMin <= valor <= rmMax siempre, para un rango amplio de reps", () => {
    for (const reps of [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 29]) {
      const { valor, min, max } = estimarRm(100, reps);
      expect(min).toBeLessThanOrEqual(valor);
      expect(valor).toBeLessThanOrEqual(max);
    }
  });

  it("r=40 (o cualquier r >= 30) nunca produce un valor negativo: bloqueo duro", () => {
    const estimacion = estimarRm(100, 40);
    expect(estimacion.valor).toBe(0);
    expect(estimacion.noUtilizable).toBe(true);
    expect(estimacion.fueraDeRango).toBe(true);
  });

  it(`r = ${REPETICIONES_BLOQUEO_DURO} está bloqueado`, () => {
    const estimacion = estimarRm(100, REPETICIONES_BLOQUEO_DURO);
    expect(estimacion.noUtilizable).toBe(true);
  });

  it("r=12 queda marcado fueraDeRango pero sigue siendo un valor no negativo", () => {
    const estimacion = estimarRm(100, 12);
    expect(estimacion.fueraDeRango).toBe(true);
    expect(estimacion.valor).toBeGreaterThanOrEqual(0);
  });

  it("r=5 con RIR<=1 da confianza alta", () => {
    const estimacion = estimarRm(100, 5, { rirReportado: 1 });
    expect(estimacion.confianza).toBe("alta");
  });

  it("r<=10 sin RIR alto da confianza media", () => {
    const estimacion = estimarRm(100, 8);
    expect(estimacion.confianza).toBe("media");
  });

  it("r>10 da confianza baja", () => {
    const estimacion = estimarRm(100, 12);
    expect(estimacion.confianza).toBe("baja");
  });

  it("entradas inválidas no lanzan y devuelven noUtilizable", () => {
    expect(estimarRm(-10, 5).noUtilizable).toBe(true);
    expect(estimarRm(100, 0).noUtilizable).toBe(true);
    expect(estimarRm(NaN, 5).noUtilizable).toBe(true);
  });
});

describe("estimarE1rmConRir (F-03)", () => {
  it("carga=100, r=5, RIR=2 equivale a carga=100, r=7, RIR=0", () => {
    const a = estimarE1rmConRir(100, 5, 2);
    const b = estimarE1rmConRir(100, 7, 0);
    expect(a.valor).toBeCloseTo(b.valor, 2);
    expect(a.valido).toBe(true);
    expect(b.valido).toBe(true);
  });

  it("rechaza cuando repeticiones + RIR > 10", () => {
    const estimacion = estimarE1rmConRir(100, 9, 2);
    expect(estimacion.valido).toBe(false);
  });

  it("rechaza cuando RIR > 3", () => {
    const estimacion = estimarE1rmConRir(100, 5, 4);
    expect(estimacion.valido).toBe(false);
  });
});

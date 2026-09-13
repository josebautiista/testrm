import { describe, expect, it } from "vitest";

import {
  esObjetivoBloque,
  esProgresionBloque,
  PATRONES_FUERZA,
  validarObjetivoBloque,
} from "./objetivo-bloque";

function base() {
  return {
    objetivoBloque: "fuerza_maxima",
    intensidadMinPct: 80,
    intensidadMaxPct: 92,
    repsMin: 3,
    repsMax: 6,
    rirObjetivo: 2,
    progresion: "lineal_intensidad",
    seriesSemanalesPorPatron: { sentadilla: 8, bisagra: 6 },
  };
}

describe("esObjetivoBloque / esProgresionBloque", () => {
  it("acepta los 7 objetivos de bloque de ZONAS_INTENSIDAD", () => {
    for (const objetivo of [
      "fuerza_maxima",
      "hipertrofia",
      "resistencia_fuerza",
      "potencia",
      "acumulacion",
      "realizacion",
      "recuperacion",
    ]) {
      expect(esObjetivoBloque(objetivo)).toBe(true);
    }
  });

  it("rechaza valores fuera del enum", () => {
    expect(esObjetivoBloque("tecnico")).toBe(false);
    expect(esObjetivoBloque(null)).toBe(false);
    expect(esObjetivoBloque(undefined)).toBe(false);
  });

  it("acepta las 4 progresiones válidas y rechaza el resto", () => {
    for (const progresion of [
      "lineal_intensidad",
      "lineal_volumen",
      "ondulante",
      "mantenimiento",
    ]) {
      expect(esProgresionBloque(progresion)).toBe(true);
    }
    expect(esProgresionBloque("ola")).toBe(false);
  });
});

describe("PATRONES_FUERZA", () => {
  it("excluye cardio (no lleva %1RM ni RIR)", () => {
    expect(PATRONES_FUERZA).not.toContain("cardio");
  });

  it("incluye los 8 patrones de fuerza del catálogo", () => {
    expect(PATRONES_FUERZA).toEqual([
      "sentadilla",
      "bisagra",
      "empuje_horizontal",
      "empuje_vertical",
      "traccion_horizontal",
      "traccion_vertical",
      "core",
      "accesorio",
    ]);
  });
});

describe("validarObjetivoBloque", () => {
  it("acepta un objetivo de bloque válido", () => {
    const resultado = validarObjetivoBloque(base());
    expect(resultado.ok).toBe(true);
  });

  it("rechaza un objetivoBloque fuera del enum", () => {
    const resultado = validarObjetivoBloque({
      ...base(),
      objetivoBloque: "no_existe",
    });
    expect(resultado.ok).toBe(false);
  });

  it("rechaza intensidadMinPct >= intensidadMaxPct", () => {
    const resultado = validarObjetivoBloque({
      ...base(),
      intensidadMinPct: 90,
      intensidadMaxPct: 85,
    });
    expect(resultado.ok).toBe(false);
  });

  it("rechaza intensidadMaxPct fuera de 1-100", () => {
    const resultado = validarObjetivoBloque({
      ...base(),
      intensidadMaxPct: 150,
    });
    expect(resultado.ok).toBe(false);
  });

  it("rechaza repsMin > repsMax", () => {
    const resultado = validarObjetivoBloque({
      ...base(),
      repsMin: 8,
      repsMax: 5,
    });
    expect(resultado.ok).toBe(false);
  });

  it("rechaza repsMin/repsMax no enteros", () => {
    const resultado = validarObjetivoBloque({
      ...base(),
      repsMin: 3.5,
    });
    expect(resultado.ok).toBe(false);
  });

  it("rechaza rirObjetivo fuera de 0-10", () => {
    const resultado = validarObjetivoBloque({ ...base(), rirObjetivo: 11 });
    expect(resultado.ok).toBe(false);
  });

  it("rechaza un progresion inválido", () => {
    const resultado = validarObjetivoBloque({
      ...base(),
      progresion: "ola_magica",
    });
    expect(resultado.ok).toBe(false);
  });

  it("rechaza series semanales negativas por patrón", () => {
    const resultado = validarObjetivoBloque({
      ...base(),
      seriesSemanalesPorPatron: { sentadilla: -1 },
    });
    expect(resultado.ok).toBe(false);
  });

  it("acepta seriesSemanalesPorPatron vacío (todos los patrones opcionales)", () => {
    const resultado = validarObjetivoBloque({
      ...base(),
      seriesSemanalesPorPatron: {},
    });
    expect(resultado.ok).toBe(true);
  });

  it("rechaza entrada que no es un objeto", () => {
    expect(validarObjetivoBloque(null).ok).toBe(false);
    expect(validarObjetivoBloque("texto").ok).toBe(false);
  });
});

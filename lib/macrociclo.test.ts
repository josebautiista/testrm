import { describe, expect, it } from "vitest";

import {
  COOPER_DISTANCIA_MINIMA_M,
  ETAPAS_POR_PERIODO,
  ETAPA_DESCRIPCION,
  ETAPA_LEGER_MAXIMA,
  MESOCICLO_DESCRIPCION,
  MESES_POR_TIPO_LABEL,
  MICROCICLO_DESCRIPCION,
  ORDEN_MESES,
  PASO_WIZARD,
  TIPOS_MICROCICLO,
  TOTAL_PASOS_WIZARD,
  VO2MAX_RANGO_PLAUSIBLE,
  calcularVo2maxLeger,
  esVo2maxPlausible,
  isTipoEtapa,
  isTipoMesociclo,
  isTipoMicrociclo,
  isTipoPeriodo,
  isMetodoVo2max,
} from "./macrociclo";
import { getVO2MaxClassification } from "@/helpers/calculations";

describe("PASO_WIZARD (ADR-42)", () => {
  const numeros = Object.values(PASO_WIZARD);

  it("los pasos son consecutivos desde 1, sin huecos ni repetidos", () => {
    const ordenados = [...numeros].sort((a, b) => a - b);
    expect(ordenados).toEqual(
      Array.from({ length: numeros.length }, (_, i) => i + 1),
    );
  });

  it("el total coincide con el número de pasos declarados", () => {
    expect(TOTAL_PASOS_WIZARD).toBe(numeros.length);
  });

  it("el orden refleja el flujo real del asistente", () => {
    // El perfil va antes que el RM porque decide la forma del plan; la
    // estructura va después de las evaluaciones porque se calcula con ellas.
    expect(PASO_WIZARD.objetivo).toBeLessThan(PASO_WIZARD.perfil);
    expect(PASO_WIZARD.perfil).toBeLessThan(PASO_WIZARD.rm);
    expect(PASO_WIZARD.vo2max).toBeLessThan(PASO_WIZARD.estructura);
    expect(PASO_WIZARD.estructura).toBeLessThan(PASO_WIZARD.semanas);
    expect(PASO_WIZARD.semanas).toBeLessThan(PASO_WIZARD.carga);
    expect(PASO_WIZARD.carga).toBeLessThan(PASO_WIZARD.revision);
    expect(PASO_WIZARD.revision).toBe(TOTAL_PASOS_WIZARD);
  });
});

describe("vocabulario del macrociclo", () => {
  it("los tres periodos del plan anual están reconocidos", () => {
    for (const periodo of ["preparatorio", "competitivo", "transitorio"]) {
      expect(isTipoPeriodo(periodo)).toBe(true);
      expect(ETAPAS_POR_PERIODO[periodo as never]).toBeDefined();
    }
  });

  it("cada etapa de cada periodo tiene descripción y es un tipo válido", () => {
    for (const etapas of Object.values(ETAPAS_POR_PERIODO)) {
      for (const etapa of etapas) {
        expect(isTipoEtapa(etapa)).toBe(true);
        expect(ETAPA_DESCRIPCION[etapa].length).toBeGreaterThan(20);
      }
    }
  });

  it("cada mesociclo tiene etiqueta y descripción", () => {
    for (const tipo of ORDEN_MESES) {
      expect(isTipoMesociclo(tipo)).toBe(true);
      expect(MESES_POR_TIPO_LABEL[tipo]).toBeTruthy();
      expect(MESOCICLO_DESCRIPCION[tipo].length).toBeGreaterThan(20);
    }
  });

  it("cada tipo de microciclo tiene descripción, incluido el taper", () => {
    for (const { value } of TIPOS_MICROCICLO) {
      expect(isTipoMicrociclo(value)).toBe(true);
      expect(MICROCICLO_DESCRIPCION[value].length).toBeGreaterThan(20);
    }
    expect(TIPOS_MICROCICLO.map((t) => t.value)).toContain("taper");
  });
});

describe("VO2max: validación de plausibilidad", () => {
  it("marca como implausible un valor negativo o extremo", () => {
    expect(esVo2maxPlausible(-5)).toBe(false);
    expect(esVo2maxPlausible(0)).toBe(false);
    expect(esVo2maxPlausible(150)).toBe(false);
    expect(esVo2maxPlausible(NaN)).toBe(false);
  });

  it("acepta valores dentro del rango fisiológico general", () => {
    expect(esVo2maxPlausible(VO2MAX_RANGO_PLAUSIBLE.min)).toBe(true);
    expect(esVo2maxPlausible(VO2MAX_RANGO_PLAUSIBLE.max)).toBe(true);
    expect(esVo2maxPlausible(45)).toBe(true);
  });

  it("Cooper: la distancia mínima es exactamente donde la fórmula cruza a cero", () => {
    const valorEnElLimite = (COOPER_DISTANCIA_MINIMA_M - 504.9) / 44.73;
    expect(valorEnElLimite).toBeCloseTo(0, 5);
  });

  it("Léger: la etapa máxima documentada coincide con el protocolo estándar", () => {
    expect(ETAPA_LEGER_MAXIMA).toBe(21);
    expect(esVo2maxPlausible(calcularVo2maxLeger(ETAPA_LEGER_MAXIMA))).toBe(
      true,
    );
  });
});

describe("getVO2MaxClassification", () => {
  it("sin edad o sexo reconocible, no adivina una categoría", () => {
    expect(getVO2MaxClassification(45).label).toBe("Sin datos");
    expect(getVO2MaxClassification(45, 30, "desconocido").label).toBe(
      "Sin datos",
    );
  });

  it("clasifica a un hombre de 30 años dentro de las categorías esperadas", () => {
    expect(getVO2MaxClassification(20, 30, "masculino").label).toBe(
      "Muy pobre",
    );
    expect(getVO2MaxClassification(41, 30, "masculino").label).toBe(
      "Promedio",
    );
    expect(getVO2MaxClassification(60, 30, "masculino").label).toBe(
      "Excelente",
    );
  });

  it("las mismas categorías existen para mujeres con umbrales propios", () => {
    expect(getVO2MaxClassification(55, 30, "femenino").label).toBe(
      "Excelente",
    );
    expect(getVO2MaxClassification(20, 30, "femenino").label).toBe(
      "Muy pobre",
    );
  });

  it("acepta las variantes cortas de sexo usadas en el resto del código", () => {
    expect(getVO2MaxClassification(50, 30, "m").label).not.toBe("Sin datos");
    expect(getVO2MaxClassification(50, 30, "f").label).not.toBe("Sin datos");
  });
});

describe("VO2max: método directo (valor ya conocido)", () => {
  it("se reconoce como método válido junto a cooper y léger", () => {
    expect(isMetodoVo2max("directo")).toBe(true);
    expect(isMetodoVo2max("cooper")).toBe(true);
    expect(isMetodoVo2max("leger")).toBe(true);
    expect(isMetodoVo2max("otro")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  ETAPAS_POR_PERIODO,
  ETAPA_DESCRIPCION,
  MESOCICLO_DESCRIPCION,
  MESES_POR_TIPO_LABEL,
  MICROCICLO_DESCRIPCION,
  ORDEN_MESES,
  PASO_WIZARD,
  TIPOS_MICROCICLO,
  TOTAL_PASOS_WIZARD,
  isTipoEtapa,
  isTipoMesociclo,
  isTipoMicrociclo,
  isTipoPeriodo,
} from "./macrociclo";

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

import { describe, expect, it } from "vitest";

import {
  DistribucionSemanasError,
  asignarMicrociclos,
  distribuirSemanasPorMayorResto,
  type SemanaParaMicrociclo,
} from "./estructura";
import { MAX_SEMANAS_SIN_DESCARGA } from "@/lib/config/parametros";

function sumaSemanas(resultado: { semanas: number }[]) {
  return resultado.reduce((sum, item) => sum + item.semanas, 0);
}

describe("distribuirSemanasPorMayorResto (F-08)", () => {
  it("4 semanas / 8 mesociclos: rechaza con error explícito (E-06)", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      tipo: `m${i}`,
      porcentaje: 12.5,
    }));

    expect(() => distribuirSemanasPorMayorResto(4, items)).toThrow(
      DistribucionSemanasError,
    );
  });

  it("52 semanas / 2 bloques: la suma siempre es 52", () => {
    const items = [
      { tipo: "preparatorio", porcentaje: 70 },
      { tipo: "competitivo", porcentaje: 30 },
    ];
    const resultado = distribuirSemanasPorMayorResto(52, items);
    expect(sumaSemanas(resultado)).toBe(52);
    expect(resultado.every((r) => r.semanas >= 1)).toBe(true);
  });

  it("porcentajes que no suman 100 igual reparten correctamente por proporción", () => {
    const items = [
      { tipo: "a", porcentaje: 40 },
      { tipo: "b", porcentaje: 40 },
    ];
    const resultado = distribuirSemanasPorMayorResto(10, items);
    expect(sumaSemanas(resultado)).toBe(10);
    expect(resultado[0].semanas).toBe(resultado[1].semanas);
  });

  it("un solo bloque al 100% recibe todas las semanas", () => {
    const resultado = distribuirSemanasPorMayorResto(16, [
      { tipo: "unico", porcentaje: 100 },
    ]);
    expect(resultado).toEqual([{ tipo: "unico", semanas: 16 }]);
  });

  it("totalSemanas = 0 devuelve todo en cero sin lanzar", () => {
    const resultado = distribuirSemanasPorMayorResto(0, [
      { tipo: "a", porcentaje: 50 },
      { tipo: "b", porcentaje: 50 },
    ]);
    expect(sumaSemanas(resultado)).toBe(0);
  });

  it("ítems con porcentaje 0 reciben 0 semanas y no cuentan para el mínimo", () => {
    const resultado = distribuirSemanasPorMayorResto(3, [
      { tipo: "a", porcentaje: 100 },
      { tipo: "b", porcentaje: 0 },
    ]);
    expect(resultado.find((r) => r.tipo === "b")?.semanas).toBe(0);
    expect(sumaSemanas(resultado)).toBe(3);
  });

  it("caso sesgado 90/5/5 con solo 4 semanas: cada bloque activo recibe al menos 1", () => {
    const resultado = distribuirSemanasPorMayorResto(4, [
      { tipo: "a", porcentaje: 90 },
      { tipo: "b", porcentaje: 5 },
      { tipo: "c", porcentaje: 5 },
    ]);
    expect(sumaSemanas(resultado)).toBe(4);
    expect(resultado.every((r) => r.semanas >= 1)).toBe(true);
  });

  it("property-based: Σ semanas = totalSemanas para 200 combinaciones aleatorias", () => {
    let seed = 42;
    function random() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }

    for (let trial = 0; trial < 200; trial += 1) {
      const numItems = 1 + Math.floor(random() * 6);
      const items = Array.from({ length: numItems }, (_, i) => ({
        tipo: `item${i}`,
        porcentaje: Math.floor(random() * 100),
      }));
      const activos = items.filter((i) => i.porcentaje > 0);
      if (activos.length === 0) continue;

      const totalSemanas = activos.length + Math.floor(random() * 50);

      const resultado = distribuirSemanasPorMayorResto(totalSemanas, items);
      expect(sumaSemanas(resultado)).toBe(totalSemanas);
      for (const item of resultado) {
        const original = items.find((i) => i.tipo === item.tipo);
        if (original && original.porcentaje > 0) {
          expect(item.semanas).toBeGreaterThanOrEqual(1);
        } else {
          expect(item.semanas).toBe(0);
        }
      }
    }
  });
});

describe("asignarMicrociclos (TASK-029, R-10, R-16 #5 y #10)", () => {
  function semanasDeMesociclo(
    mesocicloTipo: SemanaParaMicrociclo["mesocicloTipo"],
    desde: number,
    cantidad: number,
  ): SemanaParaMicrociclo[] {
    return Array.from({ length: cantidad }, (_, i) => ({
      numeroSemana: desde + i,
      mesocicloTipo,
    }));
  }

  it("nunca hay dos semanas de choque consecutivas", () => {
    const semanas = semanasDeMesociclo("choque", 1, 6);
    const resultado = asignarMicrociclos(semanas);

    for (let i = 1; i < resultado.length; i += 1) {
      const actual = resultado[i].tipoMicrociclo;
      const anterior = resultado[i - 1].tipoMicrociclo;
      expect(actual === "choque" && anterior === "choque").toBe(false);
    }
  });

  it("nunca pasan más de MAX_SEMANAS_SIN_DESCARGA semanas sin una descarga", () => {
    const semanas = [
      ...semanasDeMesociclo("entrante", 1, 3),
      ...semanasDeMesociclo("desarrollador", 4, 6),
      ...semanasDeMesociclo("desarrollador_especifico", 10, 6),
      ...semanasDeMesociclo("estabilizador", 16, 4),
    ];
    const resultado = asignarMicrociclos(semanas);

    let semanasSinDescarga = 0;
    for (const semana of resultado) {
      if (semana.esDeload) {
        semanasSinDescarga = 0;
      } else {
        semanasSinDescarga += 1;
      }
      expect(semanasSinDescarga).toBeLessThanOrEqual(MAX_SEMANAS_SIN_DESCARGA);
    }
  });

  it("un mesociclo de 16 semanas típico produce al menos una descarga", () => {
    const semanas = [
      ...semanasDeMesociclo("entrante", 1, 2),
      ...semanasDeMesociclo("desarrollador", 3, 3),
      ...semanasDeMesociclo("desarrollador_especifico", 6, 3),
      ...semanasDeMesociclo("estabilizador", 9, 2),
      ...semanasDeMesociclo("precompetitivo", 11, 3),
      ...semanasDeMesociclo("choque", 14, 2),
      ...semanasDeMesociclo("competencia", 16, 1),
    ];
    const resultado = asignarMicrociclos(semanas);
    expect(resultado).toHaveLength(16);
    expect(resultado.some((s) => s.esDeload)).toBe(true);
  });

  it("respeta una frecuencia de deload personalizada (atleta avanzado, cada 3)", () => {
    const semanas = semanasDeMesociclo("desarrollador", 1, 9);
    const resultado = asignarMicrociclos(semanas, 3);
    const deloads = resultado.filter((s) => s.esDeload).map((s) => s.numeroSemana);
    expect(deloads).toEqual([3, 6, 9]);
  });
});

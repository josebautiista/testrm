import { describe, expect, it } from "vitest";

import {
  FASE_POR_OBJETIVO_BLOQUE,
  resolverFaseActiva,
  resolverObjetivoBloque,
  type MesocicloParaFase,
} from "./fase";
import { ZONAS_INTENSIDAD } from "@/lib/config/parametros";

function mesociclo(
  base: Partial<MesocicloParaFase> & Pick<MesocicloParaFase, "id" | "orden">,
): MesocicloParaFase {
  return {
    tipo: "desarrollador",
    objetivoBloque: null,
    fechaInicio: new Date("2026-01-01"),
    fechaFin: new Date("2026-01-31"),
    ...base,
  };
}

describe("resolverObjetivoBloque", () => {
  it("usa la columna objetivoBloque cuando existe", () => {
    const objetivo = resolverObjetivoBloque({
      tipo: "desarrollador",
      objetivoBloque: "fuerza_maxima",
    });

    expect(objetivo).toBe("fuerza_maxima");
  });

  it("cae al tipo de mesociclo en macrociclos antiguos sin la columna", () => {
    expect(
      resolverObjetivoBloque({ tipo: "estabilizador", objetivoBloque: null }),
    ).toBe("fuerza_maxima");
    expect(
      resolverObjetivoBloque({ tipo: "entrante", objetivoBloque: null }),
    ).toBe("resistencia_fuerza");
  });

  it("un valor desconocido no se inventa: devuelve null", () => {
    expect(
      resolverObjetivoBloque({ tipo: "inventado", objetivoBloque: "raro" }),
    ).toBeNull();
  });
});

describe("resolverFaseActiva (ADR-36)", () => {
  const mesociclos: MesocicloParaFase[] = [
    mesociclo({
      id: 1,
      orden: 1,
      tipo: "entrante",
      objetivoBloque: "resistencia_fuerza",
      fechaInicio: new Date("2026-01-01"),
      fechaFin: new Date("2026-01-31"),
    }),
    mesociclo({
      id: 2,
      orden: 2,
      tipo: "desarrollador",
      objetivoBloque: "hipertrofia",
      fechaInicio: new Date("2026-02-01"),
      fechaFin: new Date("2026-02-28"),
    }),
    mesociclo({
      id: 3,
      orden: 3,
      tipo: "estabilizador",
      objetivoBloque: "fuerza_maxima",
      fechaInicio: new Date("2026-03-01"),
      fechaFin: new Date("2026-03-31"),
    }),
  ];

  it("devuelve el bloque cuyo rango contiene la fecha", () => {
    const activa = resolverFaseActiva(mesociclos, new Date(2026, 1, 15));

    expect(activa?.mesocicloId).toBe(2);
    expect(activa?.fase).toBe("hipertrofia");
    expect(activa?.posicion).toBe(2);
    expect(activa?.total).toBe(3);
  });

  it("un bloque de fuerza máxima ya no reporta 'resistencia'", () => {
    const activa = resolverFaseActiva(mesociclos, new Date(2026, 2, 10));
    expect(activa?.fase).toBe("fuerza");
  });

  it("los extremos del rango cuentan como dentro del bloque", () => {
    expect(resolverFaseActiva(mesociclos, new Date(2026, 1, 1))?.mesocicloId).toBe(2);
    expect(resolverFaseActiva(mesociclos, new Date(2026, 1, 28))?.mesocicloId).toBe(2);
  });

  it("la hora del día no altera el bloque resuelto", () => {
    const temprano = resolverFaseActiva(
      mesociclos,
      new Date(2026, 1, 28, 0, 30),
    );
    const tarde = resolverFaseActiva(
      mesociclos,
      new Date(2026, 1, 28, 23, 45),
    );

    expect(temprano?.mesocicloId).toBe(2);
    expect(tarde?.mesocicloId).toBe(2);
  });

  it("fuera del macrociclo no hay fase: null, no un valor por defecto", () => {
    expect(resolverFaseActiva(mesociclos, new Date(2025, 11, 31))).toBeNull();
    expect(resolverFaseActiva(mesociclos, new Date(2026, 3, 1))).toBeNull();
  });

  it("sin mesociclos (o entrada inválida) devuelve null sin lanzar", () => {
    expect(resolverFaseActiva([], new Date())).toBeNull();
    expect(
      resolverFaseActiva(undefined as unknown as MesocicloParaFase[]),
    ).toBeNull();
  });

  it("calcula los días que faltan para cerrar el bloque", () => {
    const activa = resolverFaseActiva(mesociclos, new Date(2026, 1, 20));
    expect(activa?.diasRestantes).toBe(8);

    const ultimoDia = resolverFaseActiva(mesociclos, new Date(2026, 1, 28));
    expect(ultimoDia?.diasRestantes).toBe(0);
  });

  it("resuelve por `orden`, no por la posición en el array", () => {
    const desordenados = [mesociclos[2], mesociclos[0], mesociclos[1]];
    const activa = resolverFaseActiva(desordenados, new Date(2026, 2, 10));

    expect(activa?.posicion).toBe(3);
    expect(activa?.mesocicloId).toBe(3);
  });
});

describe("coherencia del mapeo objetivo → fase", () => {
  it("cada objetivo de bloque del motor tiene una fase asignada", () => {
    for (const objetivo of Object.keys(ZONAS_INTENSIDAD)) {
      expect(FASE_POR_OBJETIVO_BLOQUE).toHaveProperty(objetivo);
    }
  });

  it("los bloques de fase 'fuerza' son los de mayor intensidad relativa", () => {
    for (const [objetivo, fase] of Object.entries(FASE_POR_OBJETIVO_BLOQUE)) {
      const zona = ZONAS_INTENSIDAD[objetivo as keyof typeof ZONAS_INTENSIDAD];

      if (fase === "fuerza") {
        expect(zona.intensidadMinPct).toBeGreaterThanOrEqual(80);
      }
      if (fase === "resistencia") {
        expect(zona.intensidadMaxPct).toBeLessThanOrEqual(65);
      }
    }
  });
});

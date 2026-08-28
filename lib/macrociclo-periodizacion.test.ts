import { describe, expect, it } from "vitest";

import { calcularPeriodizacion, contarSemanas } from "./macrociclo-periodizacion";
import { construirEstructura, type PerfilDeportivo } from "./planificacion/perfil";

const PERFIL: PerfilDeportivo = {
  capacidad: "mixto_intermitente",
  calendario: "pico_unico",
  nivel: "intermediate",
};

function planificar(
  desde: string,
  hasta: string,
  perfil: PerfilDeportivo = PERFIL,
  competencias: Parameters<typeof calcularPeriodizacion>[0]["competencias"] = [],
) {
  const fechaInicio = new Date(`${desde}T00:00:00`);
  const fechaFin = new Date(`${hasta}T00:00:00`);
  const totalSemanas = contarSemanas(fechaInicio, fechaFin);

  return calcularPeriodizacion({
    fechaInicio,
    fechaFin,
    estructura: construirEstructura(perfil, totalSemanas),
    competencias,
  });
}

describe("calcularPeriodizacion — R-16 #2: ninguna fecha excede fechaFin", () => {
  // Rangos elegidos para cubrir una última semana calendario parcial (el
  // total de días no es múltiplo exacto de 7), que era donde el invariante
  // se rompía antes.
  const rangos: Array<[string, string]> = [
    ["2026-01-05", "2026-06-30"],
    ["2026-01-05", "2026-07-01"],
    ["2026-01-05", "2026-07-02"],
    ["2026-03-02", "2026-09-15"],
    ["2026-01-05", "2026-12-31"],
  ];

  for (const [desde, hasta] of rangos) {
    it(`${desde} → ${hasta}: todo cae dentro del rango`, () => {
      const resultado = planificar(desde, hasta);
      const limite = new Date(`${hasta}T00:00:00`);

      expect(resultado.errores).toEqual([]);

      for (const periodo of resultado.periodos) {
        expect(periodo.fechaFin.getTime()).toBeLessThanOrEqual(limite.getTime());
        for (const etapa of periodo.etapas) {
          expect(etapa.fechaFin.getTime()).toBeLessThanOrEqual(limite.getTime());
        }
      }

      for (const mesociclo of resultado.mesociclos) {
        expect(mesociclo.fechaFin.getTime()).toBeLessThanOrEqual(limite.getTime());
      }

      for (const semana of resultado.semanas) {
        expect(semana.fechaFin.getTime()).toBeLessThanOrEqual(limite.getTime());
      }
    });
  }
});

describe("calcularPeriodizacion — cobertura y continuidad", () => {
  it("los mesociclos cubren todas las semanas sin huecos ni solapes", () => {
    const resultado = planificar("2026-01-05", "2026-10-04");
    const cubiertas = resultado.mesociclos.reduce(
      (total, mesociclo) => total + mesociclo.semanas.length,
      0,
    );

    expect(cubiertas).toBe(resultado.totalSemanas);
  });

  it("cada mesociclo empieza justo después del anterior", () => {
    const resultado = planificar("2026-01-05", "2026-10-04");

    for (let i = 1; i < resultado.mesociclos.length; i += 1) {
      const anterior = resultado.mesociclos[i - 1];
      const actual = resultado.mesociclos[i];
      const diferenciaDias =
        (actual.fechaInicio.getTime() - anterior.fechaFin.getTime()) /
        (24 * 60 * 60 * 1000);

      expect(diferenciaDias).toBeCloseTo(1, 5);
    }
  });

  it("los periodos empiezan y terminan con el macrociclo", () => {
    const resultado = planificar("2026-01-05", "2026-10-04");
    const primero = resultado.periodos[0];
    const ultimo = resultado.periodos[resultado.periodos.length - 1];

    expect(primero.fechaInicio.getTime()).toBe(resultado.fechaInicio.getTime());
    expect(ultimo.fechaFin.getTime()).toBe(
      resultado.semanas[resultado.semanas.length - 1].fechaFin.getTime(),
    );
  });

  it("ADR-37: el macrociclo termina en un periodo transitorio", () => {
    const resultado = planificar("2026-01-05", "2026-10-04");
    const ultimo = resultado.periodos[resultado.periodos.length - 1];

    expect(ultimo.tipo).toBe("transitorio");
  });
});

describe("calcularPeriodizacion — taper y evaluación (ADR-38)", () => {
  it("coloca taper antes de la competencia declarada", () => {
    const resultado = planificar("2026-01-05", "2026-10-04", PERFIL, [
      {
        fecha: new Date("2026-09-15T00:00:00"),
        importancia: "principal",
        nombre: "Nacional",
      },
    ]);

    const tapers = resultado.semanas.filter(
      (semana) => semana.tipoMicrociclo === "taper",
    );

    expect(tapers.length).toBeGreaterThan(0);
  });

  it("la primera y la última semana son de evaluación", () => {
    const resultado = planificar("2026-01-05", "2026-10-04");

    expect(resultado.semanas[0].tipoMicrociclo).toBe("evaluacion");
    expect(
      resultado.semanas[resultado.semanas.length - 1].tipoMicrociclo,
    ).toBe("evaluacion");
  });

  it("cada semana lleva la explicación de por qué es de ese tipo", () => {
    const resultado = planificar("2026-01-05", "2026-10-04");

    for (const semana of resultado.semanas) {
      expect(semana.notas).toBeTruthy();
    }
  });
});

describe("calcularPeriodizacion — errores", () => {
  it("una estructura con errores no produce plan", () => {
    const resultado = planificar("2026-01-05", "2026-01-18");

    if (resultado.errores.length > 0) {
      expect(resultado.mesociclos).toEqual([]);
    }
  });

  it("rechaza una estructura calculada para otra duración", () => {
    const fechaInicio = new Date("2026-01-05T00:00:00");
    const fechaFin = new Date("2026-10-04T00:00:00");

    const resultado = calcularPeriodizacion({
      fechaInicio,
      fechaFin,
      estructura: construirEstructura(PERFIL, 12),
    });

    expect(resultado.errores.length).toBeGreaterThan(0);
    expect(resultado.errores[0]).toContain("Vuelve a generar");
  });
});

describe("contarSemanas", () => {
  it("cuenta la semana parcial final como una semana más", () => {
    expect(contarSemanas(new Date("2026-01-05T00:00:00"), new Date("2026-01-11T00:00:00"))).toBe(1);
    expect(contarSemanas(new Date("2026-01-05T00:00:00"), new Date("2026-01-12T00:00:00"))).toBe(2);
  });
});

import { describe, expect, it } from "vitest";

import { calcularPeriodizacion } from "./macrociclo-periodizacion";

const PERIODOS = [
  { tipo: "preparatorio" as const, porcentaje: 70 },
  { tipo: "competitivo" as const, porcentaje: 30 },
];
const ETAPAS = {
  preparatorio: [
    { tipo: "general" as const, porcentaje: 50 },
    { tipo: "especifica" as const, porcentaje: 50 },
  ],
  competitivo: [
    { tipo: "precompetitiva" as const, porcentaje: 50 },
    { tipo: "competitiva" as const, porcentaje: 50 },
  ],
};
const MESOCICLOS = [
  { tipo: "entrante" as const, porcentaje: 20 },
  { tipo: "desarrollador" as const, porcentaje: 30 },
  { tipo: "estabilizador" as const, porcentaje: 30 },
  { tipo: "competencia" as const, porcentaje: 20 },
];

describe("calcularPeriodizacion — ninguna fecha excede fechaFin (R-16 #2), incluso con semana final parcial", () => {
  it.each([
    // días de duración deliberadamente NO múltiplos de 7
    30, 45, 60, 75, 100, 111, 113, 200,
  ])("con un rango de %i días, ningún periodo/etapa/mesociclo excede fechaFin", (dias) => {
    const fechaInicio = new Date("2026-01-05T00:00:00");
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + dias - 1);

    const resultado = calcularPeriodizacion({
      fechaInicio,
      fechaFin,
      periodos: PERIODOS,
      etapasPorPeriodo: ETAPAS,
      mesociclos: MESOCICLOS,
    });

    expect(resultado.errores).toEqual([]);

    for (const periodo of resultado.periodos) {
      expect(periodo.fechaFin.getTime()).toBeLessThanOrEqual(resultado.fechaFin.getTime());
      for (const etapa of periodo.etapas) {
        expect(etapa.fechaFin.getTime()).toBeLessThanOrEqual(resultado.fechaFin.getTime());
      }
    }
    for (const mesociclo of resultado.mesociclos) {
      expect(mesociclo.fechaFin.getTime()).toBeLessThanOrEqual(resultado.fechaFin.getTime());
    }

    // El último bloque de cada nivel debe terminar exactamente en fechaFin
    // (no antes: no deben perderse días sueltos al final del rango).
    const ultimoPeriodo = resultado.periodos[resultado.periodos.length - 1];
    expect(ultimoPeriodo.fechaFin.getTime()).toBe(resultado.fechaFin.getTime());
    const ultimoMesociclo = resultado.mesociclos[resultado.mesociclos.length - 1];
    expect(ultimoMesociclo.fechaFin.getTime()).toBe(resultado.fechaFin.getTime());
  });
});

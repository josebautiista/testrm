import { describe, expect, it } from "vitest";

import { evaluarDisponibilidad, evaluarRendimientoEjercicio } from "./reglas";

function sesion(overrides: Partial<Parameters<typeof evaluarRendimientoEjercicio>[0]["sesiones"][number]> = {}) {
  return {
    fecha: new Date("2026-01-01"),
    repsLogradas: 8,
    repsMinObjetivo: 6,
    rirReportado: 2,
    rirObjetivo: 2,
    ...overrides,
  };
}

describe("evaluarRendimientoEjercicio (R-13)", () => {
  it("una sola sesión mala no dispara ningún ajuste", () => {
    const propuestas = evaluarRendimientoEjercicio({
      ejercicioId: 1,
      sesiones: [sesion({ repsLogradas: 3, repsMinObjetivo: 6 })],
      e1rmActual: null,
      e1rmMejorDelBloque: null,
    });
    expect(propuestas).toEqual([]);
  });

  it("dos sesiones consecutivas sin alcanzar repsMin -> bajar carga", () => {
    const propuestas = evaluarRendimientoEjercicio({
      ejercicioId: 1,
      sesiones: [
        sesion({ repsLogradas: 3, repsMinObjetivo: 6 }),
        sesion({ repsLogradas: 4, repsMinObjetivo: 6 }),
      ],
      e1rmActual: null,
      e1rmMejorDelBloque: null,
    });
    expect(propuestas.some((p) => p.tipo === "bajar_carga")).toBe(true);
  });

  it("una sesión buena entre dos malas no cuenta como 2 consecutivas", () => {
    const propuestas = evaluarRendimientoEjercicio({
      ejercicioId: 1,
      sesiones: [
        sesion({ repsLogradas: 3, repsMinObjetivo: 6 }),
        sesion({ repsLogradas: 8, repsMinObjetivo: 6 }),
      ],
      e1rmActual: null,
      e1rmMejorDelBloque: null,
    });
    expect(propuestas.some((p) => p.tipo === "bajar_carga")).toBe(false);
  });

  it("RIR >=2 por encima del objetivo en 2 sesiones -> subir carga", () => {
    const propuestas = evaluarRendimientoEjercicio({
      ejercicioId: 1,
      sesiones: [
        sesion({ rirReportado: 4, rirObjetivo: 2 }),
        sesion({ rirReportado: 5, rirObjetivo: 2 }),
      ],
      e1rmActual: null,
      e1rmMejorDelBloque: null,
    });
    expect(propuestas.some((p) => p.tipo === "subir_carga")).toBe(true);
  });

  it("caída de e1RM > 10% respecto a la mejor marca del bloque -> deload", () => {
    const propuestas = evaluarRendimientoEjercicio({
      ejercicioId: 1,
      sesiones: [],
      e1rmActual: 85,
      e1rmMejorDelBloque: 100,
    });
    expect(propuestas.some((p) => p.tipo === "deload")).toBe(true);
  });

  it("caída de e1RM <= 10% no dispara deload", () => {
    const propuestas = evaluarRendimientoEjercicio({
      ejercicioId: 1,
      sesiones: [],
      e1rmActual: 91,
      e1rmMejorDelBloque: 100,
    });
    expect(propuestas.some((p) => p.tipo === "deload")).toBe(false);
  });
});

describe("evaluarDisponibilidad (R-13)", () => {
  it(">=30% de sesiones omitidas propone revisar disponibilidad, no bajar carga", () => {
    const propuesta = evaluarDisponibilidad(10, 3);
    expect(propuesta?.tipo).toBe("revisar_disponibilidad");
  });

  it("menos del 30% omitidas no propone nada", () => {
    expect(evaluarDisponibilidad(10, 2)).toBeNull();
  });

  it("sin sesiones planificadas no propone nada (evita división por cero)", () => {
    expect(evaluarDisponibilidad(0, 0)).toBeNull();
  });
});

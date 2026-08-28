import { describe, expect, it } from "vitest";

import {
  construirIntentosExtra,
  MAX_INTENTOS_EXTRA,
  PASOS_CASAS,
  PASOS_NACLERIO,
  repeticionesDelMejorIntento,
  resolverRmMedido,
  type PasoEjecutado,
  type PasoProtocolo,
} from "./protocolo";

function ejecutado(
  base: Partial<PasoEjecutado> & Pick<PasoEjecutado, "numero">,
): PasoEjecutado {
  return {
    nombre: `Paso ${base.numero}`,
    fase: "maxima",
    porcentaje: 1,
    reps: 1,
    descansoSeg: 300,
    indicacion: "",
    pesoObjetivo: 100,
    pesoObjetivoMax: 100,
    pesoObjetivoLabel: "100",
    pesoReal: 0,
    repsReales: 0,
    completado: false,
    omniRes: null,
    ...base,
  };
}

describe("resolverRmMedido (D-05 / ADR-30)", () => {
  it("sin ningún paso completado, el RM medido es 0", () => {
    const rm = resolverRmMedido([
      ejecutado({ numero: 1, pesoObjetivo: 100, pesoReal: 0 }),
      ejecutado({ numero: 2, pesoObjetivo: 110, pesoReal: 0 }),
    ]);

    expect(rm.valorKg).toBe(0);
    expect(rm.pasoNumero).toBeNull();
  });

  it("un peso objetivo alto nunca se convierte en RM si no se levantó", () => {
    const rm = resolverRmMedido([
      ejecutado({
        numero: 1,
        pesoObjetivo: 200,
        pesoObjetivoMax: 200,
        pesoReal: 0,
        repsReales: 1,
        completado: false,
      }),
    ]);

    expect(rm.valorKg).toBe(0);
  });

  it("un intento registrado pero no completado (fallado) no cuenta", () => {
    const rm = resolverRmMedido([
      ejecutado({ numero: 1, pesoReal: 100, repsReales: 1, completado: true }),
      ejecutado({ numero: 2, pesoReal: 110, repsReales: 0, completado: false }),
    ]);

    expect(rm.valorKg).toBe(100);
    expect(rm.pasoNumero).toBe(1);
  });

  it("toma el peso real más alto entre los completados, no el último", () => {
    const rm = resolverRmMedido([
      ejecutado({ numero: 1, pesoReal: 90, repsReales: 1, completado: true }),
      ejecutado({ numero: 2, pesoReal: 105, repsReales: 1, completado: true }),
      ejecutado({ numero: 3, pesoReal: 100, repsReales: 1, completado: true }),
    ]);

    expect(rm.valorKg).toBe(105);
    expect(rm.pasoNumero).toBe(2);
  });

  it("marca cuando se superan los intentos máximos que la NSCA considera válidos", () => {
    const pasos = Array.from({ length: 8 }).map((_, indice) =>
      ejecutado({
        numero: indice + 1,
        fase: "maxima",
        pesoReal: 100 + indice,
        repsReales: 1,
        completado: true,
      }),
    );

    const rm = resolverRmMedido(pasos);
    expect(rm.intentosMaximos).toBe(8);
    expect(rm.excedeIntentosRecomendados).toBe(true);
  });

  it("no cuenta como intento máximo un paso de calentamiento", () => {
    const rm = resolverRmMedido([
      ejecutado({
        numero: 1,
        fase: "calentamiento",
        pesoReal: 40,
        repsReales: 8,
        completado: true,
      }),
      ejecutado({ numero: 2, pesoReal: 100, repsReales: 1, completado: true }),
    ]);

    expect(rm.intentosMaximos).toBe(1);
    expect(rm.excedeIntentosRecomendados).toBe(false);
  });

  it("entradas vacías o inválidas no lanzan", () => {
    expect(resolverRmMedido([]).valorKg).toBe(0);
    expect(
      resolverRmMedido(undefined as unknown as PasoEjecutado[]).valorKg,
    ).toBe(0);
  });
});

describe("repeticionesDelMejorIntento", () => {
  it("devuelve las repeticiones del intento válido más pesado", () => {
    const reps = repeticionesDelMejorIntento([
      ejecutado({ numero: 1, pesoReal: 90, repsReales: 3, completado: true }),
      ejecutado({ numero: 2, pesoReal: 110, repsReales: 2, completado: true }),
    ]);

    expect(reps).toBe(2);
  });

  it("devuelve 0 si no hay intentos válidos", () => {
    expect(repeticionesDelMejorIntento([])).toBe(0);
  });
});

describe("construirIntentosExtra (ADR-32)", () => {
  it("sube por el incremento real del equipo, no por un porcentaje compuesto", () => {
    const extras = construirIntentosExtra(100, 2.5);

    expect(extras).toHaveLength(MAX_INTENTOS_EXTRA);
    expect(extras[0].porcentaje * 100).toBeCloseTo(102.5, 5);
    expect(extras[1].porcentaje * 100).toBeCloseTo(105, 5);
  });

  it("nunca genera más de MAX_INTENTOS_EXTRA", () => {
    expect(construirIntentosExtra(100, 2.5, 10)).toHaveLength(
      MAX_INTENTOS_EXTRA,
    );
  });

  it("sin un peso base válido no genera intentos", () => {
    expect(construirIntentosExtra(0, 2.5)).toEqual([]);
    expect(construirIntentosExtra(NaN, 2.5)).toEqual([]);
  });
});

describe("definición de los protocolos", () => {
  it("Naclerio respeta el rango 8±2 series y las 2–3 repeticiones del original", () => {
    expect(PASOS_NACLERIO).toHaveLength(8);

    for (const paso of PASOS_NACLERIO) {
      expect(paso.reps).toBeGreaterThanOrEqual(1);
      expect(paso.reps).toBeLessThanOrEqual(3);
      expect(paso.descansoSeg).toBeGreaterThanOrEqual(120);
      expect(paso.descansoSeg).toBeLessThanOrEqual(300);
    }
  });

  it("Naclerio cubre las cuatro franjas de carga del protocolo publicado", () => {
    const porcentajes = PASOS_NACLERIO.map((paso) => paso.porcentaje);

    expect(porcentajes.filter((p) => p >= 0.35 && p <= 0.5)).toHaveLength(2);
    expect(porcentajes.filter((p) => p >= 0.55 && p <= 0.65)).toHaveLength(2);
    expect(porcentajes.filter((p) => p >= 0.7 && p <= 0.8)).toHaveLength(2);
    expect(porcentajes.filter((p) => p >= 0.85 && p <= 1)).toHaveLength(2);
  });

  it("ningún protocolo propone de partida una carga por encima del RM de referencia + 5 %", () => {
    const todos: PasoProtocolo[] = [...PASOS_CASAS, ...PASOS_NACLERIO];

    for (const paso of todos) {
      expect(paso.porcentaje).toBeLessThanOrEqual(1.05);
    }
  });

  it("los pasos están numerados de forma creciente y sin huecos", () => {
    for (const protocolo of [PASOS_CASAS, PASOS_NACLERIO]) {
      protocolo.forEach((paso, indice) => {
        expect(paso.numero).toBe(indice + 1);
      });
    }
  });
});

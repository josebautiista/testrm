import { describe, expect, it } from "vitest";

import {
  CAMBIO_MINIMO_DETECTABLE,
  compararConRmVigente,
  estimarE1rmConRir,
  estimarRm,
  ordenarParaEvaluacion,
  REPETICIONES_BLOQUEO_DURO,
  resolverTren,
  sugerirAjusteCarga,
} from "./estimacion";

describe("estimarRm", () => {
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

describe("estimarRm con RIR (ADR-27)", () => {
  it("el RIR reportado corrige al alza la estimación puntual", () => {
    const alFallo = estimarRm(100, 8);
    const con3EnReserva = estimarRm(100, 8, { rirReportado: 3 });

    expect(con3EnReserva.valor).toBeGreaterThan(alFallo.valor);
    expect(con3EnReserva.repeticionesEfectivas).toBe(11);
  });

  it("8 reps con 3 RIR equivale exactamente a 11 reps al fallo", () => {
    const a = estimarRm(100, 8, { rirReportado: 3 });
    const b = estimarRm(100, 11);

    expect(a.valor).toBeCloseTo(b.valor, 2);
  });

  it("las repeticiones efectivas deciden fueraDeRango, no las reportadas", () => {
    const estimacion = estimarRm(100, 8, { rirReportado: 4 });
    expect(estimacion.repeticionesEfectivas).toBe(12);
    expect(estimacion.fueraDeRango).toBe(true);
  });

  it("un RIR negativo o no numérico se ignora en vez de romper la estimación", () => {
    expect(estimarRm(100, 5, { rirReportado: -3 }).repeticionesEfectivas).toBe(5);
    expect(
      estimarRm(100, 5, { rirReportado: NaN }).repeticionesEfectivas,
    ).toBe(5);
  });
});

describe("sugerirAjusteCarga (ADR-28)", () => {
  it("un intento dentro de la ventana 3–8 no pide cambio de carga", () => {
    const ajuste = sugerirAjusteCarga(100, 5);
    expect(ajuste.accion).toBe("ninguno");
    expect(ajuste.deltaKg).toBe(0);
  });

  it("demasiadas repeticiones piden subir carga", () => {
    const ajuste = sugerirAjusteCarga(100, 15, { tren: "superior" });
    expect(ajuste.accion).toBe("subir");
    expect(ajuste.cargaSugerida).toBeGreaterThan(100);
  });

  it("muy pocas repeticiones piden bajar carga", () => {
    const ajuste = sugerirAjusteCarga(100, 1, { tren: "superior" });
    expect(ajuste.accion).toBe("bajar");
    expect(ajuste.cargaSugerida).toBeLessThan(100);
  });

  it("el salto nunca excede la banda NSCA del tren correspondiente", () => {
    const superior = sugerirAjusteCarga(100, 25, { tren: "superior" });
    const inferior = sugerirAjusteCarga(100, 25, { tren: "inferior" });

    expect(superior.cargaSugerida).toBeLessThanOrEqual(110);
    expect(superior.cargaSugerida).toBeGreaterThanOrEqual(105);
    expect(inferior.cargaSugerida).toBeLessThanOrEqual(120);
    expect(inferior.cargaSugerida).toBeGreaterThanOrEqual(110);
  });

  it("la carga sugerida se redondea al incremento cargable del equipo", () => {
    const ajuste = sugerirAjusteCarga(100, 12, { incrementoMinimoKg: 5 });
    expect(ajuste.cargaSugerida % 5).toBe(0);
  });

  it("el RIR cuenta al decidir si el intento sirve", () => {
    // 6 reps parecen válidas, pero con 4 en reserva son 10 efectivas.
    const ajuste = sugerirAjusteCarga(100, 6, { rirReportado: 4 });
    expect(ajuste.accion).toBe("subir");
  });

  it("entradas inválidas devuelven sin_datos en vez de lanzar", () => {
    expect(sugerirAjusteCarga(0, 5).accion).toBe("sin_datos");
    expect(sugerirAjusteCarga(100, 0).accion).toBe("sin_datos");
    expect(sugerirAjusteCarga(NaN, NaN).accion).toBe("sin_datos");
  });
});

describe("resolverTren", () => {
  it("sentadilla y bisagra son tren inferior", () => {
    expect(resolverTren("sentadilla")).toBe("inferior");
    expect(resolverTren("bisagra")).toBe("inferior");
  });

  it("cualquier otro patrón (o ninguno) cae en tren superior", () => {
    expect(resolverTren("empuje_horizontal")).toBe("superior");
    expect(resolverTren(null)).toBe("superior");
    expect(resolverTren(undefined)).toBe("superior");
  });
});

describe("compararConRmVigente (ADR-29)", () => {
  it("un cambio por debajo del error de medición se marca como ruido", () => {
    const comparacion = compararConRmVigente(103, 100);
    expect(comparacion?.esCambioReal).toBe(false);
    expect(comparacion?.direccion).toBe("sube");
  });

  it("un cambio por encima del cambio mínimo detectable es señal real", () => {
    const comparacion = compararConRmVigente(120, 100);
    expect(comparacion?.esCambioReal).toBe(true);
  });

  it("detecta también una bajada real", () => {
    const comparacion = compararConRmVigente(80, 100);
    expect(comparacion?.direccion).toBe("baja");
    expect(comparacion?.esCambioReal).toBe(true);
  });

  it("sin RM vigente previo no hay comparación", () => {
    expect(compararConRmVigente(100, null)).toBeNull();
    expect(compararConRmVigente(100, 0)).toBeNull();
  });

  it("el umbral está en torno al 11,6 % (CV 4,2 % de Grgic 2020)", () => {
    expect(CAMBIO_MINIMO_DETECTABLE).toBeGreaterThan(0.11);
    expect(CAMBIO_MINIMO_DETECTABLE).toBeLessThan(0.125);
  });
});

describe("ordenarParaEvaluacion (ADR-34)", () => {
  it("evalúa primero los multiarticulares de más masa muscular", () => {
    const orden = ordenarParaEvaluacion([
      { id: 3, patron: "accesorio" },
      { id: 1, patron: "sentadilla" },
      { id: 2, patron: "empuje_horizontal" },
    ]).map((e) => e.id);

    expect(orden).toEqual([1, 2, 3]);
  });

  it("manda los ejercicios de tiempo al final aunque su patrón ordene antes", () => {
    const orden = ordenarParaEvaluacion([
      { id: 1, patron: "sentadilla", esDeTiempo: true },
      { id: 2, patron: "accesorio", esDeTiempo: false },
    ]).map((e) => e.id);

    expect(orden).toEqual([2, 1]);
  });

  it("un patrón desconocido no rompe el orden ni pierde ejercicios", () => {
    const resultado = ordenarParaEvaluacion([
      { id: 1, patron: "inventado" },
      { id: 2, patron: null },
      { id: 3, patron: "sentadilla" },
    ]);

    expect(resultado).toHaveLength(3);
    expect(resultado[0].id).toBe(3);
  });

  it("no muta el array original", () => {
    const original = [
      { id: 2, patron: "accesorio" },
      { id: 1, patron: "sentadilla" },
    ];
    ordenarParaEvaluacion(original);
    expect(original[0].id).toBe(2);
  });
});

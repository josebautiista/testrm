import { describe, expect, it } from "vitest";

import { ZONAS_INTENSIDAD, RANGOS_VOLUMEN } from "@/lib/config/parametros";
import {
  calcularIntensidadObjetivoPct,
  calcularPrescripcion,
  calcularSeriesObjetivo,
  generarSesionesSemana,
  seleccionarEjerciciosPorPatron,
} from "./prescripcion";
import type { EjercicioCatalogo, RmVigenteContexto } from "./tipos";

function ejercicio(overrides: Partial<EjercicioCatalogo>): EjercicioCatalogo {
  return {
    id: 1,
    nombre: "Ejercicio",
    patron: "empuje_horizontal",
    musculoPrimario: "pectoral",
    equipamiento: "maquina",
    incrementoMinimoKg: 2.5,
    admitePorcentajeRm: true,
    esDeTiempo: false,
    esUnilateral: false,
    activo: true,
    enBateriaEvaluacion: true,
    ...overrides,
  };
}

function rmVigente(overrides: Partial<RmVigenteContexto>): RmVigenteContexto {
  return {
    rmVigenteId: 1,
    ejercicioId: 1,
    valorKg: 100,
    confianza: "alta",
    validoDesde: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("R-08: nunca sube volumen e intensidad la misma semana", () => {
  const zona = ZONAS_INTENSIDAD.fuerza_maxima;
  const rango = RANGOS_VOLUMEN.fuerza_maxima;

  it("lineal_intensidad: la intensidad sube con la semana, las series se mantienen fijas", () => {
    const intensidadSemana1 = calcularIntensidadObjetivoPct(zona, "lineal_intensidad", 1, 3);
    const intensidadSemana3 = calcularIntensidadObjetivoPct(zona, "lineal_intensidad", 3, 3);
    expect(intensidadSemana3).toBeGreaterThan(intensidadSemana1);

    const seriesSemana1 = calcularSeriesObjetivo(rango, "lineal_intensidad", 1, 3);
    const seriesSemana3 = calcularSeriesObjetivo(rango, "lineal_intensidad", 3, 3);
    expect(seriesSemana3).toBe(seriesSemana1);
  });

  it("lineal_volumen: las series suben con la semana, la intensidad se mantiene fija", () => {
    const zonaHipertrofia = ZONAS_INTENSIDAD.hipertrofia;
    const rangoHipertrofia = RANGOS_VOLUMEN.hipertrofia;

    const seriesSemana1 = calcularSeriesObjetivo(rangoHipertrofia, "lineal_volumen", 1, 4);
    const seriesSemana4 = calcularSeriesObjetivo(rangoHipertrofia, "lineal_volumen", 4, 4);
    expect(seriesSemana4).toBeGreaterThan(seriesSemana1);

    const intensidadSemana1 = calcularIntensidadObjetivoPct(zonaHipertrofia, "lineal_volumen", 1, 4);
    const intensidadSemana4 = calcularIntensidadObjetivoPct(zonaHipertrofia, "lineal_volumen", 4, 4);
    expect(intensidadSemana4).toBe(intensidadSemana1);
  });
});

describe("calcularPrescripcion", () => {
  const base = {
    ejercicio: ejercicio({ id: 1, incrementoMinimoKg: 2.5 }),
    orden: 1,
    objetivoBloque: "fuerza_maxima" as const,
    progresion: "lineal_intensidad" as const,
    indiceSemanaEnBloque: 2,
    totalSemanasBloque: 3,
    esDeload: false,
    factorVolumenDeload: 0.5,
    factorIntensidadDeload: 1,
  };

  it("R-05: la carga es RM_vigente x %objetivo redondeado hacia abajo, con linaje", () => {
    const prescripcion = calcularPrescripcion({
      ...base,
      rmVigente: rmVigente({ valorKg: 101, rmVigenteId: 42 }),
    });

    expect(prescripcion.rmUsadoKg).toBe(101);
    expect(prescripcion.rmVigenteId).toBe(42);
    expect(prescripcion.formulaRm).toBe("epley");
    expect(prescripcion.cargaKg).not.toBeNull();
    // F-04: múltiplo exacto del incremento, nunca por encima del teórico.
    const teorico = (101 * (prescripcion.porcentajeRm ?? 0)) / 100;
    expect(prescripcion.cargaKg!).toBeLessThanOrEqual(teorico + 1e-9);
    expect((prescripcion.cargaKg! / 2.5) % 1).toBeCloseTo(0, 9);
  });

  it("R-06: sin RM vigente, se prescribe por reps y RIR, sin carga (nunca se extrapola de otro ejercicio)", () => {
    const prescripcion = calcularPrescripcion({ ...base, rmVigente: undefined });

    expect(prescripcion.cargaKg).toBeNull();
    expect(prescripcion.rmUsadoKg).toBeNull();
    expect(prescripcion.rmVigenteId).toBeNull();
    expect(prescripcion.repeticionesObjetivo).toBeGreaterThan(0);
    expect(prescripcion.rirObjetivo).toBeGreaterThanOrEqual(0);
  });

  it("esDeTiempo nunca genera carga aunque haya RM vigente", () => {
    const prescripcion = calcularPrescripcion({
      ...base,
      ejercicio: ejercicio({ esDeTiempo: true, admitePorcentajeRm: false }),
      rmVigente: rmVigente({}),
    });
    expect(prescripcion.cargaKg).toBeNull();
  });

  it("deload reduce series e intensidad respecto a la semana equivalente sin deload", () => {
    const normal = calcularPrescripcion({ ...base, esDeload: false, rmVigente: rmVigente({}) });
    const deload = calcularPrescripcion({ ...base, esDeload: true, rmVigente: rmVigente({}) });

    expect(deload.series).toBeLessThanOrEqual(normal.series);
    expect(deload.cargaKg!).toBeLessThanOrEqual(normal.cargaKg!);
  });

  it("R-16 #6: nunca porcentajeRm > 100", () => {
    // RM vigente muy bajo respecto a la zona no debería importar; el % es
    // siempre el de la zona objetivo (<=95 en el peor caso: potencia).
    for (const objetivoBloque of ["fuerza_maxima", "potencia", "hipertrofia", "resistencia_fuerza", "recuperacion"] as const) {
      const prescripcion = calcularPrescripcion({
        ...base,
        objetivoBloque,
        rmVigente: rmVigente({}),
      });
      expect(prescripcion.porcentajeRm ?? 0).toBeLessThanOrEqual(100);
    }
  });
});

describe("seleccionarEjerciciosPorPatron (R-01)", () => {
  it("prioriza el ejercicio con RM vigente de mayor confianza dentro del mismo patrón", () => {
    const catalogo = [
      ejercicio({ id: 1, patron: "empuje_horizontal", equipamiento: "maquina" }),
      ejercicio({ id: 2, patron: "empuje_horizontal", equipamiento: "barra" }),
    ];
    const rmVigentes = [
      rmVigente({ ejercicioId: 1, confianza: "baja" }),
      rmVigente({ ejercicioId: 2, confianza: "alta" }),
    ];

    const seleccion = seleccionarEjerciciosPorPatron(catalogo, [], rmVigentes);
    expect(seleccion).toHaveLength(1);
    expect(seleccion[0].id).toBe(2);
  });

  it("filtra por equipamiento disponible, salvo peso corporal", () => {
    const catalogo = [
      ejercicio({ id: 1, patron: "empuje_horizontal", equipamiento: "barra" }),
      ejercicio({ id: 2, patron: "core", equipamiento: "peso_corporal" }),
    ];

    const seleccion = seleccionarEjerciciosPorPatron(catalogo, ["maquina"], []);
    expect(seleccion.map((e) => e.id)).toEqual([2]);
  });

  it("nunca incluye el patrón cardio", () => {
    const catalogo = [ejercicio({ id: 1, patron: "cardio" })];
    expect(seleccionarEjerciciosPorPatron(catalogo, [], [])).toHaveLength(0);
  });
});

describe("generarSesionesSemana (R-02, R-14)", () => {
  it("con <=2 días/semana, todas las sesiones son de cuerpo completo (mismos ejercicios)", () => {
    const catalogo = [
      ejercicio({ id: 1, patron: "empuje_horizontal" }),
      ejercicio({ id: 2, patron: "sentadilla" }),
    ];

    const sesiones = generarSesionesSemana({
      ejerciciosSeleccionados: catalogo,
      disponibilidad: { diasPorSemana: 2, minutosPorSesion: 60, equipamiento: [] },
      objetivoBloque: "hipertrofia",
      progresion: "lineal_volumen",
      indiceSemanaEnBloque: 1,
      totalSemanasBloque: 4,
      esDeload: false,
      factorVolumenDeload: 0.5,
      factorIntensidadDeload: 1,
      rmVigentes: [],
    });

    expect(sesiones).toHaveLength(2);
    expect(sesiones[0].prescripciones.map((p) => p.ejercicioId)).toEqual(
      sesiones[1].prescripciones.map((p) => p.ejercicioId),
    );
  });

  it("R-14: recorta el trabajo accesorio antes que el principal cuando no cabe en el tiempo", () => {
    const catalogo = [
      ejercicio({ id: 1, patron: "sentadilla" }),
      ejercicio({ id: 2, patron: "accesorio" }),
      ejercicio({ id: 3, patron: "core" }),
    ];

    const sesiones = generarSesionesSemana({
      ejerciciosSeleccionados: catalogo,
      disponibilidad: { diasPorSemana: 1, minutosPorSesion: 20, equipamiento: [] },
      objetivoBloque: "hipertrofia",
      progresion: "lineal_volumen",
      indiceSemanaEnBloque: 4,
      totalSemanasBloque: 4,
      esDeload: false,
      factorVolumenDeload: 0.5,
      factorIntensidadDeload: 1,
      rmVigentes: [],
    });

    const principal = sesiones[0].prescripciones.find((p) => p.ejercicioId === 1)!;
    const accesorio = sesiones[0].prescripciones.find((p) => p.ejercicioId === 2)!;
    // El accesorio se recorta primero: si ambos empezaron con el mismo
    // volumen objetivo, el principal debe conservar más (o igual) series.
    expect(principal.series).toBeGreaterThanOrEqual(accesorio.series);
  });
});

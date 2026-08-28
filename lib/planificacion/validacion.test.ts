import { describe, expect, it } from "vitest";

import { validarPlan } from "./validacion";
import type {
  EjercicioCatalogo,
  MesocicloPropuesto,
  PeriodoPropuesto,
  PrescripcionPropuesta,
  PropuestaPlan,
  SemanaPropuesta,
} from "./tipos";

const CATALOGO: EjercicioCatalogo[] = [
  {
    id: 1,
    nombre: "Press de pecho",
    patron: "empuje_horizontal",
    musculoPrimario: "pectoral",
    equipamiento: "maquina",
    incrementoMinimoKg: 2.5,
    admitePorcentajeRm: true,
    esDeTiempo: false,
    esUnilateral: false,
    activo: true,
    enBateriaEvaluacion: true,
  },
];

function fecha(diaISO: string): Date {
  return new Date(`${diaISO}T00:00:00`);
}

function prescripcion(overrides: Partial<PrescripcionPropuesta> = {}): PrescripcionPropuesta {
  return {
    ejercicioId: 1,
    orden: 1,
    series: 3,
    repeticionesObjetivo: 8,
    repsMin: 6,
    repsMax: 12,
    porcentajeRm: 70,
    rirObjetivo: 2,
    cargaKg: 70,
    rmUsadoKg: 100,
    rmVigenteId: 1,
    formulaRm: "epley",
    descansoSeg: 90,
    tonelaje: 3 * 8 * 70,
    origen: "generado",
    ...overrides,
  };
}

function semana(numeroSemana: number, overrides: Partial<SemanaPropuesta> = {}): SemanaPropuesta {
  const inicio = fecha(`2026-0${Math.floor((numeroSemana - 1) / 4) + 1}-${String(((numeroSemana - 1) % 4) * 7 + 1).padStart(2, "0")}`);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);

  return {
    numeroSemana,
    mesocicloOrden: 1,
    mesCalendario: inicio.getMonth() + 1,
    fechaInicio: inicio,
    fechaFin: fin,
    tipoMicrociclo: "corriente",
    esDeload: false,
    factorVolumen: 1,
    factorIntensidad: 1,
    sesiones: [
      {
        orden: 1,
        enfoque: "hipertrofia",
        duracionEstimadaMin: 60,
        prescripciones: [prescripcion()],
      },
    ],
    ...overrides,
  };
}

function planValido(): PropuestaPlan {
  const semanas = [semana(1), semana(2), semana(3), semana(4)];
  const fechaInicio = semanas[0].fechaInicio;
  const fechaFin = semanas[3].fechaFin;

  const periodo: PeriodoPropuesto = {
    tipo: "preparatorio",
    porcentaje: 100,
    fechaInicio,
    fechaFin,
    orden: 1,
    etapas: [
      { tipo: "general", porcentaje: 100, fechaInicio, fechaFin, orden: 1 },
    ],
  };

  const mesociclo: MesocicloPropuesto = {
    tipo: "entrante",
    porcentaje: 100,
    fechaInicio,
    fechaFin,
    orden: 1,
    objetivoBloque: "hipertrofia",
    progresion: "lineal_volumen",
    intensidadMinPct: 65,
    intensidadMaxPct: 80,
    repsMin: 6,
    repsMax: 12,
    rirObjetivo: 2,
    seriesSemanalesPorPatron: {},
  };

  return {
    fechaInicio,
    fechaFin,
    totalSemanas: 4,
    periodos: [periodo],
    mesociclos: [mesociclo],
    semanas,
    avisos: [],
    errores: [],
  };
}

describe("validarPlan (R-16) — plan base válido", () => {
  it("no reporta errores", () => {
    expect(validarPlan(planValido(), CATALOGO)).toEqual([]);
  });
});

describe("validarPlan — un test por invariante violado", () => {
  it("#1 la suma de semanas de periodos no coincide con el total", () => {
    const plan = planValido();
    plan.periodos[0].fechaFin = fecha("2026-01-14"); // recorta el periodo a 2 semanas
    const errores = validarPlan(plan, CATALOGO);
    expect(errores.some((e) => e.startsWith("#1"))).toBe(true);
  });

  it("#2 una fecha de bloque excede fechaFin", () => {
    const plan = planValido();
    const excedida = new Date(plan.fechaFin);
    excedida.setDate(excedida.getDate() + 7);
    plan.mesociclos[0].fechaFin = excedida;
    const errores = validarPlan(plan, CATALOGO);
    expect(errores.some((e) => e.startsWith("#2"))).toBe(true);
  });

  it("#3 una semana no pertenece a ningún mesociclo válido", () => {
    const plan = planValido();
    plan.semanas[2].mesocicloOrden = 99;
    const errores = validarPlan(plan, CATALOGO);
    expect(errores.some((e) => e.startsWith("#3"))).toBe(true);
  });

  it("#4 una semana queda huérfana", () => {
    const plan = planValido();
    plan.semanas.splice(2, 1); // elimina la semana 3
    const errores = validarPlan(plan, CATALOGO);
    expect(errores.some((e) => e.startsWith("#4"))).toBe(true);
  });

  it("#5 más de 6 semanas consecutivas sin descarga", () => {
    const plan = planValido();
    plan.semanas = Array.from({ length: 8 }, (_, i) => semana(i + 1));
    plan.totalSemanas = 8;
    plan.mesociclos[0].fechaFin = plan.semanas[7].fechaFin;
    plan.fechaFin = plan.semanas[7].fechaFin;
    plan.periodos[0].fechaFin = plan.semanas[7].fechaFin;
    plan.periodos[0].etapas[0].fechaFin = plan.semanas[7].fechaFin;
    const errores = validarPlan(plan, CATALOGO);
    expect(errores.some((e) => e.startsWith("#5"))).toBe(true);
  });

  it("#6 una prescripción tiene porcentajeRm > 100", () => {
    const plan = planValido();
    plan.semanas[0].sesiones[0].prescripciones[0].porcentajeRm = 120;
    const errores = validarPlan(plan, CATALOGO);
    expect(errores.some((e) => e.startsWith("#6"))).toBe(true);
  });

  it("#7 una carga no es múltiplo del incremento del ejercicio", () => {
    const plan = planValido();
    plan.semanas[0].sesiones[0].prescripciones[0].cargaKg = 71.3;
    const errores = validarPlan(plan, CATALOGO);
    expect(errores.some((e) => e.startsWith("#7"))).toBe(true);
  });

  it("#8 una sesión excede su presupuesto de minutos en más de un 20%", () => {
    const plan = planValido();
    plan.semanas[0].sesiones[0].duracionEstimadaMin = 5; // muy por debajo de lo necesario
    plan.semanas[0].sesiones[0].prescripciones[0].series = 20;
    const errores = validarPlan(plan, CATALOGO);
    expect(errores.some((e) => e.startsWith("#8"))).toBe(true);
  });

  it("#9 una prescripción con carga no tiene rmVigenteId/rmUsadoKg", () => {
    const plan = planValido();
    plan.semanas[0].sesiones[0].prescripciones[0].rmVigenteId = null;
    const errores = validarPlan(plan, CATALOGO);
    expect(errores.some((e) => e.startsWith("#9"))).toBe(true);
  });

  it("#10 dos semanas de choque consecutivas", () => {
    const plan = planValido();
    plan.semanas[0].tipoMicrociclo = "choque";
    plan.semanas[1].tipoMicrociclo = "choque";
    const errores = validarPlan(plan, CATALOGO);
    expect(errores.some((e) => e.startsWith("#10"))).toBe(true);
  });
});

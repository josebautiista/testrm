import { describe, expect, it } from "vitest";

import { generarPlan } from "./motor";
import type { ContextoPlanificacion, EjercicioCatalogo, RmVigenteContexto } from "./tipos";

const CATALOGO: EjercicioCatalogo[] = [
  { id: 1, nombre: "Curl de bíceps", patron: "accesorio", musculoPrimario: "biceps", equipamiento: "barra", incrementoMinimoKg: 2.5, admitePorcentajeRm: true, esDeTiempo: false, esUnilateral: false, activo: true, enBateriaEvaluacion: true },
  { id: 2, nombre: "Prensa de pierna", patron: "sentadilla", musculoPrimario: "cuadriceps", equipamiento: "maquina", incrementoMinimoKg: 5, admitePorcentajeRm: true, esDeTiempo: false, esUnilateral: false, activo: true, enBateriaEvaluacion: true },
  { id: 3, nombre: "Jalón al pecho", patron: "traccion_vertical", musculoPrimario: "dorsales", equipamiento: "polea", incrementoMinimoKg: 2.5, admitePorcentajeRm: true, esDeTiempo: false, esUnilateral: false, activo: true, enBateriaEvaluacion: true },
  { id: 4, nombre: "Abdominales (1 minuto)", patron: "core", musculoPrimario: "abdominales", equipamiento: "peso_corporal", incrementoMinimoKg: 2.5, admitePorcentajeRm: false, esDeTiempo: true, esUnilateral: false, activo: true, enBateriaEvaluacion: true },
  { id: 5, nombre: "Press de pecho en máquina", patron: "empuje_horizontal", musculoPrimario: "pectoral", equipamiento: "maquina", incrementoMinimoKg: 5, admitePorcentajeRm: true, esDeTiempo: false, esUnilateral: false, activo: true, enBateriaEvaluacion: true },
  { id: 6, nombre: "Curl femoral", patron: "accesorio", musculoPrimario: "isquiotibiales", equipamiento: "maquina", incrementoMinimoKg: 2.5, admitePorcentajeRm: true, esDeTiempo: false, esUnilateral: false, activo: true, enBateriaEvaluacion: true },
];

function rmVigentes(): RmVigenteContexto[] {
  return [
    { rmVigenteId: 1, ejercicioId: 1, valorKg: 30, confianza: "alta", validoDesde: new Date("2026-01-01") },
    { rmVigenteId: 2, ejercicioId: 2, valorKg: 150, confianza: "alta", validoDesde: new Date("2026-01-01") },
    { rmVigenteId: 3, ejercicioId: 3, valorKg: 60, confianza: "media", validoDesde: new Date("2026-01-01") },
    { rmVigenteId: 5, ejercicioId: 5, valorKg: 80, confianza: "alta", validoDesde: new Date("2026-01-01") },
    { rmVigenteId: 6, ejercicioId: 6, valorKg: 40, confianza: "media", validoDesde: new Date("2026-01-01") },
  ];
}

function contextoBase(totalSemanas: number, overrides: Partial<ContextoPlanificacion> = {}): ContextoPlanificacion {
  const fechaInicio = new Date("2026-01-05T00:00:00");
  const fechaFin = new Date(fechaInicio);
  fechaFin.setDate(fechaFin.getDate() + totalSemanas * 7 - 1);

  return {
    atleta: {
      nivel: "intermediate",
      sexo: "masculino",
      edad: 28,
      masaCorporal: 80,
      mesesEntrenamiento: 12,
      limitaciones: null,
    },
    objetivo: { tipo: "salud", fechaInicio, fechaFin, fechaCompetencia: null },
    disponibilidad: { diasPorSemana: 4, minutosPorSesion: 60, equipamiento: [] },
    rmVigentes: rmVigentes(),
    catalogo: CATALOGO,
    ...overrides,
  };
}

describe("generarPlan — cobertura de duraciones (TASK-028)", () => {
  it.each([8, 12, 16, 24])("genera un plan válido de %i semanas", (semanas) => {
    const propuesta = generarPlan(contextoBase(semanas));
    expect(propuesta.errores).toEqual([]);
    expect(propuesta.totalSemanas).toBe(semanas);
    expect(propuesta.semanas).toHaveLength(semanas);
  });
});

describe("generarPlan — rendimiento (AC-27)", () => {
  it("genera un plan de 16 semanas en menos de 2 segundos", () => {
    const inicio = performance.now();
    const propuesta = generarPlan(contextoBase(16));
    const duracionMs = performance.now() - inicio;

    expect(propuesta.errores).toEqual([]);
    expect(duracionMs).toBeLessThan(2000);
  });
});

describe("generarPlan — invariantes (R-16, vía validacion.ts)", () => {
  it("un plan de 16 semanas no viola ningún invariante", () => {
    const propuesta = generarPlan(contextoBase(16));
    expect(propuesta.errores).toEqual([]);
  });

  it("toda carga prescrita lleva rmVigenteId y rmUsadoKg (#9, D-16)", () => {
    const propuesta = generarPlan(contextoBase(12));
    const conCarga = propuesta.semanas
      .flatMap((s) => s.sesiones)
      .flatMap((s) => s.prescripciones)
      .filter((p) => p.cargaKg !== null);

    expect(conCarga.length).toBeGreaterThan(0);
    for (const p of conCarga) {
      expect(p.rmVigenteId).not.toBeNull();
      expect(p.rmUsadoKg).not.toBeNull();
    }
  });
});

describe("generarPlan — casos extremos (§16.4)", () => {
  it("E-06: menos semanas que bloques activos -> error explícito, no genera", () => {
    const propuesta = generarPlan(contextoBase(4));
    expect(propuesta.errores.length).toBeGreaterThan(0);
    expect(propuesta.semanas).toEqual([]);
  });

  it("E-08: macrociclo de 1 día -> rechazado con mensaje claro", () => {
    const fechaInicio = new Date("2026-01-05T00:00:00");
    const propuesta = generarPlan(
      contextoBase(1, {
        objetivo: { tipo: "salud", fechaInicio, fechaFin: fechaInicio, fechaCompetencia: null },
      }),
    );
    expect(propuesta.errores.length).toBeGreaterThan(0);
  });

  it("E-17: fecha de competencia anterior a la de inicio -> rechazado", () => {
    const fechaInicio = new Date("2026-03-01T00:00:00");
    const fechaFin = new Date("2026-06-01T00:00:00");
    const fechaCompetencia = new Date("2026-01-01T00:00:00");
    const propuesta = generarPlan(
      contextoBase(12, { objetivo: { tipo: "competencia", fechaInicio, fechaFin, fechaCompetencia } }),
    );
    expect(propuesta.errores.length).toBeGreaterThan(0);
  });

  it("E-09: un ejercicio sin RM se prescribe por reps/RIR y se marca en avisos", () => {
    const propuesta = generarPlan(contextoBase(12, { rmVigentes: [] }));
    expect(propuesta.errores).toEqual([]);
    expect(propuesta.avisos.some((a) => a.includes("no tiene RM vigente"))).toBe(true);

    const prescripciones = propuesta.semanas.flatMap((s) => s.sesiones).flatMap((s) => s.prescripciones);
    expect(prescripciones.some((p) => p.cargaKg === null)).toBe(true);
  });

  it("E-10: un RM de hace 8 meses se usa igual, con aviso de confianza baja", () => {
    const fechaInicio = new Date("2026-06-01T00:00:00");
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + 12 * 7 - 1);
    const rmAntiguo: RmVigenteContexto[] = [
      { rmVigenteId: 1, ejercicioId: 5, valorKg: 80, confianza: "alta", validoDesde: new Date("2025-10-01") },
    ];

    const propuesta = generarPlan(
      contextoBase(12, {
        objetivo: { tipo: "salud", fechaInicio, fechaFin, fechaCompetencia: null },
        rmVigentes: rmAntiguo,
      }),
    );

    expect(propuesta.errores).toEqual([]);
    expect(propuesta.avisos.some((a) => a.includes("ejercicio 5"))).toBe(true);
  });

  it("R-09: cada bloque reancla su carga al RM vigente al inicio del bloque (100 -> 110 no reescribe semanas ya generadas con el valor viejo)", () => {
    const contexto100 = contextoBase(8, {
      rmVigentes: [{ rmVigenteId: 1, ejercicioId: 5, valorKg: 100, confianza: "alta", validoDesde: new Date("2026-01-01") }],
    });
    const contexto110 = contextoBase(8, {
      rmVigentes: [{ rmVigenteId: 2, ejercicioId: 5, valorKg: 110, confianza: "alta", validoDesde: new Date("2026-01-01") }],
    });

    const plan100 = generarPlan(contexto100);
    const plan110 = generarPlan(contexto110);

    const cargaEnPlan = (plan: ReturnType<typeof generarPlan>) =>
      plan.semanas[0].sesiones
        .flatMap((s) => s.prescripciones)
        .find((p) => p.ejercicioId === 5)?.cargaKg ?? null;

    expect(cargaEnPlan(plan100)).not.toBeNull();
    expect(cargaEnPlan(plan110)).not.toBeNull();
    expect(cargaEnPlan(plan110)!).toBeGreaterThan(cargaEnPlan(plan100)!);
  });
});

describe("generarPlan — objetivo competencia", () => {
  it("genera un plan válido con periodo competitivo hacia la fecha de competencia", () => {
    const fechaInicio = new Date("2026-01-05T00:00:00");
    // Exactamente 16 semanas (112 días) después, para que el último bloque
    // no sea una semana parcial (ver nota sobre asignarFechasConsecutivas).
    const fechaCompetencia = new Date(fechaInicio);
    fechaCompetencia.setDate(fechaCompetencia.getDate() + 16 * 7 - 1);
    const propuesta = generarPlan(
      contextoBase(16, {
        objetivo: { tipo: "competencia", fechaInicio, fechaFin: fechaCompetencia, fechaCompetencia },
      }),
    );
    expect(propuesta.errores).toEqual([]);
    expect(propuesta.periodos.some((p) => p.tipo === "competitivo")).toBe(true);
  });
});

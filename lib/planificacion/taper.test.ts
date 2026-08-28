import { describe, expect, it } from "vitest";

import {
  FACTORES_VOLUMEN_TAPER,
  FACTOR_INTENSIDAD_TAPER,
  factoresPorTipoMicrociclo,
  FRECUENCIA_EVALUACION_SEMANAS,
  resolverMicrociclos,
  revisarEspacioTransitorio,
  revisarTaper,
  semanasDeAfinamiento,
  type SemanaParaResolver,
} from "./taper";
import type { TipoMesociclo } from "@/lib/macrociclo";
import { SEMANAS_TRANSITORIO } from "./perfil";

/** Genera N semanas consecutivas empezando el lunes 5 de enero de 2026. */
function semanas(
  total: number,
  mesocicloTipo: TipoMesociclo = "desarrollador",
): SemanaParaResolver[] {
  const inicio = Date.UTC(2026, 0, 5);
  const MS_DIA = 24 * 60 * 60 * 1000;

  return Array.from({ length: total }).map((_, indice) => ({
    numeroSemana: indice + 1,
    mesocicloTipo,
    fechaInicio: new Date(inicio + indice * 7 * MS_DIA),
    fechaFin: new Date(inicio + (indice * 7 + 6) * MS_DIA),
  }));
}

/** Fecha dentro de la semana `numero` (1-indexada). */
function fechaEnSemana(numero: number): Date {
  const MS_DIA = 24 * 60 * 60 * 1000;
  return new Date(Date.UTC(2026, 0, 5) + ((numero - 1) * 7 + 2) * MS_DIA);
}

describe("resolverMicrociclos · evaluaciones (ADR-38)", () => {
  it("la primera semana siempre es de evaluación inicial", () => {
    const resultado = resolverMicrociclos(semanas(20));

    expect(resultado[0].tipoMicrociclo).toBe("evaluacion");
    expect(resultado[0].motivo).toContain("de dónde partes");
  });

  it("la última semana es una evaluación final para poder comparar", () => {
    const resultado = resolverMicrociclos(semanas(20));
    const ultima = resultado[resultado.length - 1];

    expect(ultima.tipoMicrociclo).toBe("evaluacion");
    expect(ultima.motivo).toContain("comparar");
  });

  it("coloca evaluaciones de control cada 10 semanas", () => {
    const resultado = resolverMicrociclos(semanas(31));
    const evaluaciones = resultado
      .filter((semana) => semana.tipoMicrociclo === "evaluacion")
      .map((semana) => semana.numeroSemana);

    expect(evaluaciones).toContain(1);
    expect(evaluaciones).toContain(1 + FRECUENCIA_EVALUACION_SEMANAS);
    expect(evaluaciones).toContain(1 + FRECUENCIA_EVALUACION_SEMANAS * 2);
  });

  it("una semana de evaluación no cuenta como descarga", () => {
    const resultado = resolverMicrociclos(semanas(20));

    for (const semana of resultado) {
      if (semana.tipoMicrociclo === "evaluacion") {
        expect(semana.esDeload).toBe(false);
      }
    }
  });

  it("se pueden desactivar", () => {
    const resultado = resolverMicrociclos(semanas(20), {
      sinEvaluaciones: true,
    });

    expect(
      resultado.some((semana) => semana.tipoMicrociclo === "evaluacion"),
    ).toBe(false);
  });

  it("un plan de una sola semana no rompe nada", () => {
    const resultado = resolverMicrociclos(semanas(1));
    expect(resultado).toHaveLength(1);
  });

  it("sin semanas devuelve lista vacía", () => {
    expect(resolverMicrociclos([])).toEqual([]);
  });
});

describe("resolverMicrociclos · taper (ADR-38)", () => {
  const plan = semanas(16);
  const competenciaPrincipal = [
    {
      fecha: fechaEnSemana(14),
      importancia: "principal" as const,
      nombre: "Campeonato",
    },
  ];

  it("una competencia principal genera dos semanas de taper antes", () => {
    const resultado = resolverMicrociclos(plan, {
      competencias: competenciaPrincipal,
    });

    expect(resultado[11].tipoMicrociclo).toBe("taper"); // semana 12
    expect(resultado[12].tipoMicrociclo).toBe("taper"); // semana 13
  });

  it("el recorte más agresivo va en la semana pegada a la competencia", () => {
    const resultado = resolverMicrociclos(plan, {
      competencias: competenciaPrincipal,
    });

    const lejana = resultado[11].factorVolumen; // 2 semanas antes
    const cercana = resultado[12].factorVolumen; // 1 semana antes

    expect(cercana).toBeLessThan(lejana);
    expect(cercana).toBe(FACTORES_VOLUMEN_TAPER[1]);
    expect(lejana).toBe(FACTORES_VOLUMEN_TAPER[0]);
  });

  it("el recorte de volumen cae dentro de la ventana 41-60 % de Bosquet", () => {
    const resultado = resolverMicrociclos(plan, {
      competencias: competenciaPrincipal,
    });

    const reduccion = 1 - resultado[12].factorVolumen;
    expect(reduccion).toBeGreaterThanOrEqual(0.41);
    expect(reduccion).toBeLessThanOrEqual(0.6);
  });

  it("la intensidad no se toca durante el taper: es el hallazgo central", () => {
    const resultado = resolverMicrociclos(plan, {
      competencias: competenciaPrincipal,
    });

    for (const semana of resultado) {
      if (semana.tipoMicrociclo === "taper") {
        expect(semana.factorIntensidad).toBe(FACTOR_INTENSIDAD_TAPER);
        expect(semana.factorIntensidad).toBe(1);
      }
    }
  });

  it("la semana de la competencia queda marcada como competitiva", () => {
    const resultado = resolverMicrociclos(plan, {
      competencias: competenciaPrincipal,
    });

    expect(resultado[13].tipoMicrociclo).toBe("competitivo");
    expect(resultado[13].motivo).toContain("Campeonato");
  });

  it("una competencia secundaria solo afina una semana", () => {
    const resultado = resolverMicrociclos(plan, {
      competencias: [
        { fecha: fechaEnSemana(10), importancia: "secundaria", nombre: "Copa" },
      ],
    });

    expect(resultado[8].tipoMicrociclo).toBe("taper"); // semana 9
    expect(resultado[7].tipoMicrociclo).not.toBe("taper"); // semana 8
  });

  it("varias competencias generan varios tapers independientes", () => {
    const resultado = resolverMicrociclos(semanas(30), {
      competencias: [
        { fecha: fechaEnSemana(12), importancia: "principal", nombre: "A" },
        { fecha: fechaEnSemana(26), importancia: "principal", nombre: "B" },
      ],
    });

    const tapers = resultado
      .filter((semana) => semana.tipoMicrociclo === "taper")
      .map((semana) => semana.numeroSemana);

    expect(tapers).toEqual([10, 11, 24, 25]);
  });

  it("una competencia fuera del rango de fechas se ignora sin romper", () => {
    const resultado = resolverMicrociclos(plan, {
      competencias: [
        { fecha: new Date(Date.UTC(2027, 5, 1)), importancia: "principal" },
      ],
    });

    expect(
      resultado.some((semana) => semana.tipoMicrociclo === "taper"),
    ).toBe(false);
  });

  it("una fecha inválida no rompe la resolución", () => {
    const resultado = resolverMicrociclos(plan, {
      competencias: [{ fecha: new Date("no-es-fecha"), importancia: "principal" }],
    });

    expect(resultado).toHaveLength(16);
  });

  it("el taper nunca pisa la evaluación inicial", () => {
    const resultado = resolverMicrociclos(semanas(6), {
      competencias: [
        { fecha: fechaEnSemana(2), importancia: "principal", nombre: "X" },
      ],
    });

    expect(resultado[0].tipoMicrociclo).toBe("evaluacion");
  });
});

describe("revisarTaper", () => {
  it("avisa cuando la competencia no deja espacio para afinar", () => {
    const avisos = revisarTaper(semanas(10), [
      { fecha: fechaEnSemana(1), importancia: "principal", nombre: "Torneo" },
    ]);

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("Torneo");
  });

  it("avisa cuando la competencia cae fuera del macrociclo", () => {
    const avisos = revisarTaper(semanas(10), [
      {
        fecha: new Date(Date.UTC(2027, 0, 1)),
        importancia: "principal",
        nombre: "Nacional",
      },
    ]);

    expect(avisos[0]).toContain("fuera del rango");
  });

  it("no avisa cuando hay espacio suficiente", () => {
    const avisos = revisarTaper(semanas(20), [
      { fecha: fechaEnSemana(15), importancia: "principal", nombre: "Final" },
    ]);

    expect(avisos).toEqual([]);
  });
});

describe("modo objetivo · fechas de un plan de salud (ADR-39)", () => {
  const plan = semanas(16);

  it("una fecha objetivo principal coloca una evaluación esa semana", () => {
    const resultado = resolverMicrociclos(plan, {
      modoCalendario: "objetivo",
      competencias: [
        { fecha: fechaEnSemana(12), importancia: "principal", nombre: "Chequeo médico" },
      ],
    });

    expect(resultado[11].tipoMicrociclo).toBe("evaluacion");
    expect(resultado[11].motivo).toContain("Chequeo médico");
  });

  it("una fecha objetivo nunca genera una semana competitiva", () => {
    const resultado = resolverMicrociclos(plan, {
      modoCalendario: "objetivo",
      competencias: [
        { fecha: fechaEnSemana(12), importancia: "principal", nombre: "Viaje" },
      ],
    });

    expect(
      resultado.some((semana) => semana.tipoMicrociclo === "competitivo"),
    ).toBe(false);
  });

  it("una fecha objetivo principal afina una sola semana, no dos", () => {
    const resultado = resolverMicrociclos(plan, {
      modoCalendario: "objetivo",
      competencias: [
        { fecha: fechaEnSemana(12), importancia: "principal", nombre: "Caminata" },
      ],
    });

    const tapers = resultado
      .filter((semana) => semana.tipoMicrociclo === "taper")
      .map((semana) => semana.numeroSemana);

    expect(tapers).toEqual([11]);
  });

  it("una fecha objetivo secundaria no afina nada, solo mide", () => {
    const resultado = resolverMicrociclos(plan, {
      modoCalendario: "objetivo",
      competencias: [
        { fecha: fechaEnSemana(12), importancia: "secundaria", nombre: "Control" },
      ],
    });

    expect(
      resultado.some((semana) => semana.tipoMicrociclo === "taper"),
    ).toBe(false);
    expect(resultado[11].tipoMicrociclo).toBe("evaluacion");
  });

  it("semanasDeAfinamiento distingue los cuatro casos", () => {
    expect(semanasDeAfinamiento("principal", "competencia")).toBe(2);
    expect(semanasDeAfinamiento("secundaria", "competencia")).toBe(1);
    expect(semanasDeAfinamiento("principal", "objetivo")).toBe(1);
    expect(semanasDeAfinamiento("secundaria", "objetivo")).toBe(0);
  });

  it("revisarTaper habla de fechas objetivo, no de competencias", () => {
    const avisos = revisarTaper(
      semanas(10),
      [{ fecha: fechaEnSemana(1), importancia: "principal", nombre: "Meta" }],
      "objetivo",
    );

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("Meta");
  });
});

describe("revisarEspacioTransitorio (M-04 / ADR-41)", () => {
  const competencia = new Date(2027, 1, 14);

  it("avisa cuando el plan termina el mismo día de la competencia", () => {
    const resultado = revisarEspacioTransitorio(competencia, [
      { fecha: competencia, importancia: "principal", nombre: "Campeonato" },
    ]);

    expect(resultado).not.toBeNull();
    expect(resultado?.aviso).toContain("Campeonato");
    expect(resultado?.aviso).toContain("transitorio");
  });

  it("sugiere una fecha final que sí deja sitio al transitorio", () => {
    const resultado = revisarEspacioTransitorio(competencia, [
      { fecha: competencia, importancia: "principal", nombre: "Final" },
    ]);

    const semanas =
      (resultado!.fechaFinSugerida.getTime() - competencia.getTime()) /
      (7 * 24 * 60 * 60 * 1000);

    expect(semanas).toBeGreaterThanOrEqual(SEMANAS_TRANSITORIO.min);
    expect(semanas).toBeLessThanOrEqual(SEMANAS_TRANSITORIO.max);
  });

  it("no avisa cuando hay 3 semanas después de competir", () => {
    const fin = new Date(2027, 2, 7); // 3 semanas después
    expect(
      revisarEspacioTransitorio(fin, [
        { fecha: competencia, importancia: "principal", nombre: "Final" },
      ]),
    ).toBeNull();
  });

  it("las competencias secundarias no exigen transitorio detrás", () => {
    expect(
      revisarEspacioTransitorio(competencia, [
        { fecha: competencia, importancia: "secundaria", nombre: "Copa" },
      ]),
    ).toBeNull();
  });

  it("mide contra la última principal, no contra la primera", () => {
    const fin = new Date(2027, 2, 7);
    const resultado = revisarEspacioTransitorio(fin, [
      { fecha: new Date(2026, 10, 1), importancia: "principal", nombre: "A" },
      { fecha: new Date(2027, 2, 5), importancia: "principal", nombre: "B" },
    ]);

    expect(resultado?.aviso).toContain("B");
  });

  it("sin competencias no hay nada que avisar", () => {
    expect(revisarEspacioTransitorio(competencia, [])).toBeNull();
  });
});

describe("factoresPorTipoMicrociclo (ADR-44)", () => {
  it("un taper puesto a mano recorta volumen y respeta la intensidad", () => {
    const factores = factoresPorTipoMicrociclo("taper");

    expect(1 - factores.factorVolumen).toBeGreaterThanOrEqual(0.41);
    expect(1 - factores.factorVolumen).toBeLessThanOrEqual(0.6);
    expect(factores.factorIntensidad).toBe(1);
    expect(factores.esDeload).toBe(false);
  });

  it("una descarga puesta a mano cuenta como deload", () => {
    expect(factoresPorTipoMicrociclo("recuperacion").esDeload).toBe(true);
  });

  it("una semana de trabajo normal no lleva recorte", () => {
    for (const tipo of ["corriente", "choque", "precompetitivo", "aproximacion"] as const) {
      const factores = factoresPorTipoMicrociclo(tipo);
      expect(factores.factorVolumen).toBe(1);
      expect(factores.factorIntensidad).toBe(1);
    }
  });

  it("coincide con lo que resuelve el motor para el mismo tipo", () => {
    const plan = resolverMicrociclos(semanas(16), {
      competencias: [
        { fecha: fechaEnSemana(14), importancia: "principal", nombre: "X" },
      ],
    });

    const taper = plan.find((s) => s.tipoMicrociclo === "taper" && s.numeroSemana === 13);
    expect(taper?.factorVolumen).toBe(
      factoresPorTipoMicrociclo("taper").factorVolumen,
    );
  });
});

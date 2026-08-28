import { describe, expect, it } from "vitest";

import {
  CAPACIDADES,
  CAPACIDADES_SALUD,
  ESTRUCTURAS_CALENDARIO,
  modoCalendarioDe,
  SEMANAS_MINIMAS_BLOQUE,
  SEMANAS_TRANSITORIO,
  construirEstructura,
  semanasMinimasPara,
  type CapacidadDominante,
  type EstructuraCalendario,
  type PerfilDeportivo,
} from "./perfil";
import type { NivelAtleta } from "./tipos";

function perfil(
  base: Partial<PerfilDeportivo> = {},
): PerfilDeportivo {
  return {
    capacidad: "mixto_intermitente",
    calendario: "pico_unico",
    nivel: "intermediate",
    ...base,
  };
}

const CALENDARIOS: EstructuraCalendario[] = [
  "pico_unico",
  "doble_pico",
  "temporada_larga",
  "sin_competencia",
];
const CAPACIDADES_VALORES: CapacidadDominante[] = [
  "fuerza_potencia",
  "resistencia",
  "mixto_intermitente",
  "tecnico_estetico",
];
const NIVELES_VALORES: NivelAtleta[] = ["beginner", "intermediate", "advanced"];

describe("construirEstructura · invariantes que valen para cualquier perfil", () => {
  it("la suma de semanas de los bloques es siempre la duración total", () => {
    for (const calendario of CALENDARIOS) {
      for (const capacidad of CAPACIDADES_VALORES) {
        for (const nivel of NIVELES_VALORES) {
          for (const total of [12, 16, 24, 36, 52]) {
            const estructura = construirEstructura(
              perfil({ calendario, capacidad, nivel }),
              total,
            );

            expect(estructura.errores).toEqual([]);
            const suma = estructura.bloques.reduce(
              (acumulado, bloque) => acumulado + bloque.semanas,
              0,
            );
            expect(suma).toBe(total);
          }
        }
      }
    }
  });

  it("ningún bloque de entrenamiento baja del mínimo de 2 semanas", () => {
    for (const calendario of CALENDARIOS) {
      for (const total of [12, 20, 40]) {
        const estructura = construirEstructura(perfil({ calendario }), total);

        for (const bloque of estructura.bloques) {
          if (bloque.tipo === "competencia") continue;
          expect(bloque.semanas).toBeGreaterThanOrEqual(SEMANAS_MINIMAS_BLOQUE);
        }
      }
    }
  });

  it("el transitorio nunca dura menos de 2 ni más de 4 semanas", () => {
    for (const calendario of CALENDARIOS) {
      for (const total of [16, 24, 52]) {
        const estructura = construirEstructura(perfil({ calendario }), total);
        const transitorios = estructura.bloques.filter(
          (bloque) => bloque.tipo === "transitorio",
        );

        expect(transitorios.length).toBeGreaterThan(0);
        for (const bloque of transitorios) {
          expect(bloque.semanas).toBeGreaterThanOrEqual(SEMANAS_TRANSITORIO.min);
          expect(bloque.semanas).toBeLessThanOrEqual(SEMANAS_TRANSITORIO.max);
        }
      }
    }
  });

  it("los periodos derivados suman exactamente la duración total", () => {
    for (const calendario of CALENDARIOS) {
      const estructura = construirEstructura(perfil({ calendario }), 32);
      const suma = estructura.periodos.reduce(
        (acumulado, periodo) => acumulado + periodo.semanas,
        0,
      );

      expect(suma).toBe(32);
    }
  });

  it("las etapas de cada periodo suman las semanas de ese periodo", () => {
    const estructura = construirEstructura(perfil({ calendario: "pico_unico" }), 40);

    for (const periodo of estructura.periodos) {
      const suma = periodo.etapas.reduce(
        (acumulado, etapa) => acumulado + etapa.semanas,
        0,
      );
      expect(suma).toBe(periodo.semanas);
    }
  });

  it("los bloques van en orden consecutivo sin huecos", () => {
    const estructura = construirEstructura(perfil({ calendario: "doble_pico" }), 44);

    estructura.bloques.forEach((bloque, indice) => {
      expect(bloque.orden).toBe(indice + 1);
    });
  });
});

describe("estructura del calendario", () => {
  it("todo perfil termina en un periodo transitorio", () => {
    for (const calendario of CALENDARIOS) {
      const estructura = construirEstructura(perfil({ calendario }), 30);
      const ultimo = estructura.periodos[estructura.periodos.length - 1];

      expect(ultimo.tipo).toBe("transitorio");
    }
  });

  it("sin competencia no genera periodo competitivo", () => {
    const estructura = construirEstructura(
      perfil({ calendario: "sin_competencia" }),
      24,
    );

    expect(
      estructura.periodos.some((periodo) => periodo.tipo === "competitivo"),
    ).toBe(false);
  });

  it("doble pico genera dos preparatorios y dos competitivos distintos", () => {
    const estructura = construirEstructura(
      perfil({ calendario: "doble_pico" }),
      44,
    );

    const preparatorios = estructura.periodos.filter(
      (periodo) => periodo.tipo === "preparatorio",
    );
    const competitivos = estructura.periodos.filter(
      (periodo) => periodo.tipo === "competitivo",
    );

    expect(preparatorios).toHaveLength(2);
    expect(competitivos).toHaveLength(2);
    expect(preparatorios[0].id).not.toBe(preparatorios[1].id);
  });

  it("una temporada larga dedica más tiempo a competir que a preparar", () => {
    const estructura = construirEstructura(
      perfil({ calendario: "temporada_larga" }),
      40,
    );

    const preparatorio = estructura.periodos
      .filter((periodo) => periodo.tipo === "preparatorio")
      .reduce((suma, periodo) => suma + periodo.semanas, 0);
    const competitivo = estructura.periodos
      .filter((periodo) => periodo.tipo === "competitivo")
      .reduce((suma, periodo) => suma + periodo.semanas, 0);

    expect(competitivo).toBeGreaterThan(preparatorio);
  });

  it("un pico único dedica más tiempo a preparar que a competir", () => {
    const estructura = construirEstructura(
      perfil({ calendario: "pico_unico" }),
      40,
    );

    const preparatorio = estructura.periodos
      .filter((periodo) => periodo.tipo === "preparatorio")
      .reduce((suma, periodo) => suma + periodo.semanas, 0);
    const competitivo = estructura.periodos
      .filter((periodo) => periodo.tipo === "competitivo")
      .reduce((suma, periodo) => suma + periodo.semanas, 0);

    expect(preparatorio).toBeGreaterThan(competitivo);
  });
});

describe("capacidad dominante", () => {
  it("fuerza-potencia dedica más semanas a bloques de fuerza que resistencia", () => {
    const semanasFuerza = (capacidad: CapacidadDominante) =>
      construirEstructura(perfil({ capacidad }), 40).bloques
        .filter(
          (bloque) =>
            bloque.objetivoBloque === "fuerza_maxima" ||
            bloque.objetivoBloque === "potencia",
        )
        .reduce((suma, bloque) => suma + bloque.semanas, 0);

    expect(semanasFuerza("fuerza_potencia")).toBeGreaterThan(
      semanasFuerza("resistencia"),
    );
  });

  it("resistencia dedica más semanas a bloques de base que fuerza-potencia", () => {
    const semanasBase = (capacidad: CapacidadDominante) =>
      construirEstructura(perfil({ capacidad }), 40).bloques
        .filter(
          (bloque) =>
            bloque.objetivoBloque === "resistencia_fuerza" ||
            bloque.objetivoBloque === "acumulacion",
        )
        .reduce((suma, bloque) => suma + bloque.semanas, 0);

    expect(semanasBase("resistencia")).toBeGreaterThan(
      semanasBase("fuerza_potencia"),
    );
  });
});

describe("nivel del atleta", () => {
  it("un principiante no recibe bloques de choque, y se explica por qué", () => {
    const estructura = construirEstructura(
      perfil({ nivel: "beginner", calendario: "pico_unico" }),
      40,
    );

    expect(estructura.bloques.some((bloque) => bloque.tipo === "choque")).toBe(
      false,
    );
    expect(estructura.avisos.join(" ")).toContain("choque");
  });

  it("un avanzado sí recibe bloque de choque", () => {
    const estructura = construirEstructura(
      perfil({ nivel: "advanced", calendario: "pico_unico" }),
      40,
    );

    expect(estructura.bloques.some((bloque) => bloque.tipo === "choque")).toBe(
      true,
    );
  });
});

describe("macrociclos cortos", () => {
  it("omite bloques en vez de generar bloques de una semana", () => {
    const estructura = construirEstructura(
      perfil({ calendario: "pico_unico", nivel: "advanced" }),
      12,
    );

    expect(estructura.errores).toEqual([]);
    expect(estructura.avisos.length).toBeGreaterThan(0);

    for (const bloque of estructura.bloques) {
      if (bloque.tipo === "competencia") continue;
      expect(bloque.semanas).toBeGreaterThanOrEqual(SEMANAS_MINIMAS_BLOQUE);
    }
  });

  it("con una duración imposible devuelve error explícito y ningún bloque", () => {
    const estructura = construirEstructura(perfil(), 2);

    expect(estructura.errores.length).toBeGreaterThan(0);
    expect(estructura.bloques).toEqual([]);
  });

  it("una duración inválida no lanza", () => {
    expect(construirEstructura(perfil(), 0).errores.length).toBeGreaterThan(0);
    expect(construirEstructura(perfil(), NaN).errores.length).toBeGreaterThan(0);
  });
});

describe("semanasMinimasPara", () => {
  it("devuelve una duración con la que la estructura sí se construye", () => {
    for (const calendario of CALENDARIOS) {
      const actual = perfil({ calendario });
      const minimo = semanasMinimasPara(actual);
      const estructura = construirEstructura(actual, minimo);

      expect(estructura.errores).toEqual([]);
      expect(estructura.bloques.length).toBeGreaterThan(0);
    }
  });
});

describe("catálogos de la interfaz", () => {
  it("cada opción tiene descripción y ejemplos de deportes", () => {
    for (const item of [...CAPACIDADES, ...ESTRUCTURAS_CALENDARIO]) {
      expect(item.descripcion.length).toBeGreaterThan(20);
      expect(item.ejemplos.length).toBeGreaterThan(10);
    }
  });
});

describe("catálogo de salud (ADR-39)", () => {
  it("cubre exactamente las mismas capacidades que el de deportistas", () => {
    expect(CAPACIDADES_SALUD.map((item) => item.value).sort()).toEqual(
      CAPACIDADES.map((item) => item.value).sort(),
    );
  });

  it("ninguna descripción habla de 'tu deporte'", () => {
    for (const item of CAPACIDADES_SALUD) {
      expect(item.descripcion.toLowerCase()).not.toContain("deporte");
      expect(item.descripcion.length).toBeGreaterThan(20);
      expect(item.ejemplos.length).toBeGreaterThan(10);
    }
  });
});

describe("modoCalendarioDe (ADR-39)", () => {
  it("un plan sin competencia trata sus fechas como objetivos", () => {
    expect(modoCalendarioDe(perfil({ calendario: "sin_competencia" }))).toBe(
      "objetivo",
    );
  });

  it("cualquier calendario con competencias las trata como tales", () => {
    for (const calendario of ["pico_unico", "doble_pico", "temporada_larga"] as const) {
      expect(modoCalendarioDe(perfil({ calendario }))).toBe("competencia");
    }
  });
});

describe("redacción del calendario (ADR-40)", () => {
  it("las opciones se formulan desde lo que hace la persona, no desde la jerga", () => {
    const etiquetas = ESTRUCTURAS_CALENDARIO.map((item) => item.label);

    // Ninguna etiqueta usa vocabulario de periodización ("pico", "temporada").
    for (const etiqueta of etiquetas) {
      expect(etiqueta.toLowerCase()).not.toContain("pico");
    }
    // Y la primera opción es la de quien no compite: es el caso más común.
    expect(ESTRUCTURAS_CALENDARIO[0].value).toBe("sin_competencia");
  });

  it("la opción de no competir explica que igual se pueden fijar fechas", () => {
    const sinCompetencia = ESTRUCTURAS_CALENDARIO.find(
      (item) => item.value === "sin_competencia",
    );

    expect(sinCompetencia?.descripcion.toLowerCase()).toContain("fechas");
  });

  it("los ejemplos incluyen casos no deportivos", () => {
    const todos = ESTRUCTURAS_CALENDARIO.map((item) => item.ejemplos).join(" ");
    expect(todos.toLowerCase()).toContain("salud");
  });
});

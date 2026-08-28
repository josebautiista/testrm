import { describe, expect, it } from "vitest";

import {
  estaSinConfigurar,
  sugerirConfiguracionSemana,
  type EntradaSugerencia,
} from "./sugerencia-semana";
import { RANGOS_VOLUMEN, ZONAS_INTENSIDAD } from "@/lib/config/parametros";

function entrada(base: Partial<EntradaSugerencia> = {}): EntradaSugerencia {
  return {
    objetivoBloque: "hipertrofia",
    indiceEnBloque: 1,
    totalSemanasBloque: 4,
    factorVolumen: 1,
    factorIntensidad: 1,
    tipoMicrociclo: "corriente",
    diasDisponibles: 4,
    ...base,
  };
}

const OBJETIVOS = Object.keys(ZONAS_INTENSIDAD) as Array<
  keyof typeof ZONAS_INTENSIDAD
>;

describe("sugerirConfiguracionSemana (ADR-43)", () => {
  it("la intensidad propuesta cae dentro de la zona del objetivo", () => {
    for (const objetivoBloque of OBJETIVOS) {
      for (let indice = 1; indice <= 4; indice += 1) {
        const zona = ZONAS_INTENSIDAD[objetivoBloque];
        const sugerencia = sugerirConfiguracionSemana(
          entrada({ objetivoBloque, indiceEnBloque: indice }),
        );

        expect(sugerencia.intensidad).toBeGreaterThanOrEqual(
          zona.intensidadMinPct - 1,
        );
        expect(sugerencia.intensidad).toBeLessThanOrEqual(
          zona.intensidadMaxPct + 1,
        );
      }
    }
  });

  it("las repeticiones caen dentro del rango del objetivo", () => {
    for (const objetivoBloque of OBJETIVOS) {
      const zona = ZONAS_INTENSIDAD[objetivoBloque];
      const sugerencia = sugerirConfiguracionSemana(
        entrada({ objetivoBloque }),
      );

      expect(sugerencia.repeticiones).toBeGreaterThanOrEqual(zona.repsMin);
      expect(sugerencia.repeticiones).toBeLessThanOrEqual(zona.repsMax);
    }
  });

  it("las series caen dentro del rango de volumen cuando no hay descarga", () => {
    for (const objetivoBloque of OBJETIVOS) {
      const rango = RANGOS_VOLUMEN[objetivoBloque];
      const sugerencia = sugerirConfiguracionSemana(
        entrada({ objetivoBloque, factorVolumen: 1 }),
      );

      expect(sugerencia.series).toBeGreaterThanOrEqual(rango.seriesMin);
      expect(sugerencia.series).toBeLessThanOrEqual(rango.seriesMax);
    }
  });

  it("un bloque de fuerza máxima propone más intensidad que uno de resistencia", () => {
    const fuerza = sugerirConfiguracionSemana(
      entrada({ objetivoBloque: "fuerza_maxima" }),
    );
    const resistencia = sugerirConfiguracionSemana(
      entrada({ objetivoBloque: "resistencia_fuerza" }),
    );

    expect(fuerza.intensidad).toBeGreaterThan(resistencia.intensidad);
    expect(fuerza.repeticiones).toBeLessThan(resistencia.repeticiones);
  });

  it("una semana de taper recorta series pero no intensidad", () => {
    const normal = sugerirConfiguracionSemana(entrada());
    const taper = sugerirConfiguracionSemana(
      entrada({
        tipoMicrociclo: "taper",
        factorVolumen: 0.45,
        factorIntensidad: 1,
      }),
    );

    expect(taper.series).toBeLessThan(normal.series);
    expect(taper.intensidad).toBe(normal.intensidad);
    expect(taper.motivo).toContain("afinamiento");
  });

  it("una semana de descarga recorta el volumen y lo explica", () => {
    const descarga = sugerirConfiguracionSemana(
      entrada({ tipoMicrociclo: "recuperacion", factorVolumen: 0.55 }),
    );

    expect(descarga.motivo).toContain("descarga");
    expect(descarga.series).toBeGreaterThanOrEqual(1);
  });

  it("nunca propone menos de una serie, por agresivo que sea el factor", () => {
    const sugerencia = sugerirConfiguracionSemana(
      entrada({ factorVolumen: 0 }),
    );
    expect(sugerencia.series).toBeGreaterThanOrEqual(1);
  });

  it("la progresión dentro del bloque sube la intensidad", () => {
    const primera = sugerirConfiguracionSemana(
      entrada({ objetivoBloque: "fuerza_maxima", indiceEnBloque: 1, totalSemanasBloque: 4 }),
    );
    const ultima = sugerirConfiguracionSemana(
      entrada({ objetivoBloque: "fuerza_maxima", indiceEnBloque: 4, totalSemanasBloque: 4 }),
    );

    expect(ultima.intensidad).toBeGreaterThanOrEqual(primera.intensidad);
  });

  it("la frecuencia sale de los días disponibles del atleta", () => {
    expect(sugerirConfiguracionSemana(entrada({ diasDisponibles: 5 })).frecuencia).toBe(5);
    expect(sugerirConfiguracionSemana(entrada({ diasDisponibles: 0 })).frecuencia).toBe(1);
    expect(sugerirConfiguracionSemana(entrada({ diasDisponibles: 99 })).frecuencia).toBe(7);
  });

  it("sin bloque asignado no inventa carga y lo dice", () => {
    const sugerencia = sugerirConfiguracionSemana(
      entrada({ objetivoBloque: undefined }),
    );

    expect(sugerencia.series).toBe(0);
    expect(sugerencia.intensidad).toBe(0);
    expect(sugerencia.motivo).toContain("a mano");
  });

  it("un objetivo desconocido se trata como sin bloque, no revienta", () => {
    const sugerencia = sugerirConfiguracionSemana(
      entrada({ objetivoBloque: "inventado" }),
    );
    expect(sugerencia.series).toBe(0);
  });

  it("entradas inválidas no lanzan", () => {
    expect(() =>
      sugerirConfiguracionSemana({
        objetivoBloque: "hipertrofia",
        indiceEnBloque: NaN,
        totalSemanasBloque: 0,
        factorVolumen: NaN,
        factorIntensidad: -5,
      }),
    ).not.toThrow();
  });
});

describe("estaSinConfigurar", () => {
  it("detecta una semana recién creada", () => {
    expect(
      estaSinConfigurar({
        frecuencia: 0,
        series: 0,
        repeticiones: 0,
        intensidad: 0,
      }),
    ).toBe(true);
    expect(
      estaSinConfigurar({
        frecuencia: "",
        series: "",
        repeticiones: "",
        intensidad: "",
      }),
    ).toBe(true);
  });

  it("una semana con cualquier dato ya no está vacía", () => {
    expect(
      estaSinConfigurar({
        frecuencia: 3,
        series: 0,
        repeticiones: 0,
        intensidad: 0,
      }),
    ).toBe(false);
  });
});

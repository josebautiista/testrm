import { describe, expect, it } from "vitest";

import { ZONAS_INTENSIDAD, RANGOS_VOLUMEN } from "@/lib/config/parametros";
import { calcularIntensidadObjetivoPct, calcularSeriesObjetivo } from "./prescripcion";

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

import { describe, expect, it } from "vitest";

import {
  crearCargaInicial,
  direccionesPorDefectoPara,
  esSuma100,
} from "./mesociclo-carga";

const SEMANAS = [
  { numeroSemana: 1, frecuencia: 3 },
  { numeroSemana: 2, frecuencia: 3 },
];

describe("direccionesPorDefectoPara (M-01 / ADR-41)", () => {
  it("un plan de salud no arranca con dirección táctica", () => {
    const direcciones = direccionesPorDefectoPara({
      capacidad: "mixto_intermitente",
      calendario: "sin_competencia",
    });

    expect(direcciones.map((d) => d.id)).toEqual(["fisico", "tecnico"]);
  });

  it("un deporte de equipo sí arranca con las cuatro", () => {
    const direcciones = direccionesPorDefectoPara({
      capacidad: "mixto_intermitente",
      calendario: "temporada_larga",
    });

    expect(direcciones.map((d) => d.id)).toContain("tactico");
    expect(direcciones).toHaveLength(4);
  });

  it("fuerza-potencia compite pero no tiene dirección táctica", () => {
    const direcciones = direccionesPorDefectoPara({
      capacidad: "fuerza_potencia",
      calendario: "pico_unico",
    });

    expect(direcciones.map((d) => d.id)).not.toContain("tactico");
    expect(direcciones.map((d) => d.id)).toContain("psicologico");
  });
});

describe("crearCargaInicial con perfil", () => {
  it("el volumen inicial suma 100 sea cual sea el perfil", () => {
    for (const perfil of [
      { capacidad: "mixto_intermitente", calendario: "sin_competencia" },
      { capacidad: "mixto_intermitente", calendario: "temporada_larga" },
      { capacidad: "fuerza_potencia", calendario: "pico_unico" },
      { capacidad: "resistencia", calendario: "doble_pico" },
    ]) {
      const carga = crearCargaInicial(SEMANAS, perfil);
      const valores = carga.direcciones.map((d) => carga.volumen[d.id]);

      expect(esSuma100(valores)).toBe(true);
    }
  });

  it("solo crea reparto para las direcciones del perfil", () => {
    const carga = crearCargaInicial(SEMANAS, {
      capacidad: "mixto_intermitente",
      calendario: "sin_competencia",
    });

    expect(Object.keys(carga.volumen).sort()).toEqual(["fisico", "tecnico"]);
    expect(Object.keys(carga.microciclos).sort()).toEqual(["fisico", "tecnico"]);
  });

  it("sin perfil conserva el comportamiento anterior (las cuatro)", () => {
    const carga = crearCargaInicial(SEMANAS);
    expect(carga.direcciones).toHaveLength(4);
  });
});

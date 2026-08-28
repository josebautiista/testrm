import { describe, expect, it } from "vitest";

import { evaluarDeloadReactivo } from "./deload";

const SIN_CRITERIOS = {
  caidaE1rmPct: null,
  diferenciaRirPromedio: null,
  sesionesOmitidasPorFatiga: 0,
  rpeSesionRecientes: [],
};

describe("evaluarDeloadReactivo (R-10)", () => {
  it("con 1 solo criterio cumplido, no aplica", () => {
    const resultado = evaluarDeloadReactivo({
      ...SIN_CRITERIOS,
      caidaE1rmPct: 8,
    });
    expect(resultado.criteriosCumplidos).toEqual(["caida_e1rm"]);
    expect(resultado.aplica).toBe(false);
  });

  it("con 2 criterios cumplidos, aplica", () => {
    const resultado = evaluarDeloadReactivo({
      ...SIN_CRITERIOS,
      caidaE1rmPct: 8,
      sesionesOmitidasPorFatiga: 2,
    });
    expect(resultado.aplica).toBe(true);
    expect(resultado.criteriosCumplidos).toContain("caida_e1rm");
    expect(resultado.criteriosCumplidos).toContain("sesiones_omitidas");
  });

  it("RPE alto requiere exactamente 3 sesiones consecutivas >= umbral", () => {
    const conDos = evaluarDeloadReactivo({ ...SIN_CRITERIOS, rpeSesionRecientes: [9, 9] });
    expect(conDos.criteriosCumplidos).not.toContain("rpe_alto");

    const conTres = evaluarDeloadReactivo({ ...SIN_CRITERIOS, rpeSesionRecientes: [9, 9, 9] });
    expect(conTres.criteriosCumplidos).toContain("rpe_alto");

    const conUnaBaja = evaluarDeloadReactivo({ ...SIN_CRITERIOS, rpeSesionRecientes: [9, 6, 9] });
    expect(conUnaBaja.criteriosCumplidos).not.toContain("rpe_alto");
  });

  it("sin ningún criterio, no aplica", () => {
    expect(evaluarDeloadReactivo(SIN_CRITERIOS).aplica).toBe(false);
  });

  it("con los 4 criterios cumplidos, aplica", () => {
    const resultado = evaluarDeloadReactivo({
      caidaE1rmPct: 10,
      diferenciaRirPromedio: -3,
      sesionesOmitidasPorFatiga: 3,
      rpeSesionRecientes: [9, 9, 10],
    });
    expect(resultado.criteriosCumplidos).toHaveLength(4);
    expect(resultado.aplica).toBe(true);
  });
});

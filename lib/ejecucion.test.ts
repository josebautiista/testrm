import { describe, expect, it } from "vitest";

import {
  codificarMotivoOmision,
  decodificarMotivoOmision,
  esCodigoMotivoOmision,
  esOmisionPorFatiga,
} from "./ejecucion";

describe("codificarMotivoOmision / decodificarMotivoOmision", () => {
  it("codifica y decodifica un motivo con detalle", () => {
    const codificado = codificarMotivoOmision("fatiga", "muy cansado tras el trabajo");
    expect(codificado).toBe("[fatiga] muy cansado tras el trabajo");

    const { codigo, detalle } = decodificarMotivoOmision(codificado);
    expect(codigo).toBe("fatiga");
    expect(detalle).toBe("muy cansado tras el trabajo");
  });

  it("codifica sin detalle cuando no se da uno", () => {
    expect(codificarMotivoOmision("lesion")).toBe("[lesion]");
    expect(decodificarMotivoOmision("[lesion]")).toEqual({ codigo: "lesion", detalle: "" });
  });

  it("recorta espacios del detalle", () => {
    const codificado = codificarMotivoOmision("otro", "   viaje imprevisto   ");
    expect(codificado).toBe("[otro] viaje imprevisto");
  });

  it("decodifica null como sin motivo", () => {
    expect(decodificarMotivoOmision(null)).toEqual({ codigo: null, detalle: "" });
  });

  it("trata texto libre sin prefijo como detalle sin código (compatibilidad con datos previos)", () => {
    expect(decodificarMotivoOmision("se lesionó el hombro")).toEqual({
      codigo: null,
      detalle: "se lesionó el hombro",
    });
  });

  it("no reconoce un código inventado dentro del prefijo", () => {
    expect(decodificarMotivoOmision("[inventado] texto")).toEqual({
      codigo: null,
      detalle: "[inventado] texto",
    });
  });
});

describe("esCodigoMotivoOmision", () => {
  it("acepta los 4 códigos válidos", () => {
    for (const codigo of ["fatiga", "lesion", "logistica", "otro"]) {
      expect(esCodigoMotivoOmision(codigo)).toBe(true);
    }
  });

  it("rechaza valores fuera del enum", () => {
    expect(esCodigoMotivoOmision("clima")).toBe(false);
    expect(esCodigoMotivoOmision(null)).toBe(false);
  });
});

describe("esOmisionPorFatiga", () => {
  it("reconoce fatiga y descarta otros motivos", () => {
    expect(esOmisionPorFatiga("[fatiga] cansado")).toBe(true);
    expect(esOmisionPorFatiga("[lesion] dolor de rodilla")).toBe(false);
    expect(esOmisionPorFatiga(null)).toBe(false);
    expect(esOmisionPorFatiga("texto viejo sin prefijo")).toBe(false);
  });
});

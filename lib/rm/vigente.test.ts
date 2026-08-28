import { describe, expect, it } from "vitest";

import {
  CADUCIDAD_SEMANAS_AVISO,
  CADUCIDAD_SEMANAS_CONFIANZA_BAJA,
  evaluarVigencia,
  seleccionarRmVigenteEnFecha,
  semanasEntre,
  type RmVigenteRow,
} from "./vigente";

function fila(overrides: Partial<RmVigenteRow>): RmVigenteRow {
  return {
    id: 1,
    ejercicioId: 1,
    valorKg: 100,
    origen: "test_directo",
    confianza: "alta",
    resultadoRmId: null,
    validoDesde: new Date("2026-01-01"),
    validoHasta: null,
    ...overrides,
  };
}

describe("evaluarVigencia (R-15)", () => {
  it("no está caducado dentro de las 12 semanas", () => {
    const desde = new Date("2026-01-01");
    const fecha = new Date(desde.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
    const estado = evaluarVigencia(fila({ validoDesde: desde }), fecha);
    expect(estado.caducado).toBe(false);
    expect(estado.confianzaEfectiva).toBe("alta");
  });

  it("caduca por encima de 12 semanas pero conserva su confianza", () => {
    const desde = new Date("2026-01-01");
    const fecha = new Date(
      desde.getTime() + (CADUCIDAD_SEMANAS_AVISO + 1) * 7 * 24 * 60 * 60 * 1000,
    );
    const estado = evaluarVigencia(fila({ validoDesde: desde, confianza: "media" }), fecha);
    expect(estado.caducado).toBe(true);
    expect(estado.confianzaEfectiva).toBe("media");
  });

  it("por encima de 24 semanas rebaja la confianza a baja", () => {
    const desde = new Date("2026-01-01");
    const fecha = new Date(
      desde.getTime() +
        (CADUCIDAD_SEMANAS_CONFIANZA_BAJA + 1) * 7 * 24 * 60 * 60 * 1000,
    );
    const estado = evaluarVigencia(fila({ validoDesde: desde, confianza: "alta" }), fecha);
    expect(estado.caducado).toBe(true);
    expect(estado.confianzaEfectiva).toBe("baja");
  });

  it("semanasEntre nunca es negativo", () => {
    expect(semanasEntre(new Date("2026-02-01"), new Date("2026-01-01"))).toBe(0);
  });
});

describe("seleccionarRmVigenteEnFecha (AC-03)", () => {
  it("reconstruye el RM que regía en una fecha pasada, no el actual", () => {
    const historico: RmVigenteRow[] = [
      fila({
        id: 1,
        valorKg: 100,
        validoDesde: new Date("2026-01-01"),
        validoHasta: new Date("2026-03-01"),
      }),
      fila({
        id: 2,
        valorKg: 110,
        validoDesde: new Date("2026-03-01"),
        validoHasta: null,
      }),
    ];

    const enero = seleccionarRmVigenteEnFecha(historico, new Date("2026-01-15"));
    expect(enero?.valorKg).toBe(100);

    const abril = seleccionarRmVigenteEnFecha(historico, new Date("2026-04-01"));
    expect(abril?.valorKg).toBe(110);
  });

  it("devuelve null si no hay ningún RM vigente en esa fecha", () => {
    const historico: RmVigenteRow[] = [
      fila({
        validoDesde: new Date("2026-03-01"),
        validoHasta: null,
      }),
    ];
    const resultado = seleccionarRmVigenteEnFecha(historico, new Date("2025-01-01"));
    expect(resultado).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { combinarResultadosRmMasRecientes } from "./macrociclo-rm";

describe("combinarResultadosRmMasRecientes", () => {
  it("usa el resultado más reciente cuando se repite un ejercicio", () => {
    const resultado = combinarResultadosRmMasRecientes([
      {
        createdAt: new Date("2026-08-01T10:00:00Z"),
        resultados: [
          { ejercicioId: 1, rm: 90 },
          { ejercicioId: 2, rm: 60 },
        ],
      },
      {
        createdAt: new Date("2026-09-01T10:00:00Z"),
        resultados: [{ ejercicioId: 1, rm: 100 }],
      },
    ]);

    expect(resultado).toEqual([
      { ejercicioId: 1, rm: 100 },
      { ejercicioId: 2, rm: 60 },
    ]);
  });

  it("no depende del orden recibido", () => {
    const resultado = combinarResultadosRmMasRecientes([
      {
        createdAt: new Date("2026-09-01T10:00:00Z"),
        resultados: [{ ejercicioId: 3, rm: 70 }],
      },
      {
        createdAt: new Date("2026-07-01T10:00:00Z"),
        resultados: [{ ejercicioId: 3, rm: 50 }],
      },
    ]);

    expect(resultado).toEqual([{ ejercicioId: 3, rm: 70 }]);
  });
});

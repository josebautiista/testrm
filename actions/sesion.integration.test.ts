// Test de integración contra una base de datos real (requiere DATABASE_URL,
// ver .env). Se salta automáticamente si no hay DB configurada.
//
// Bloquea las regresiones de H-01/H-02/ADR-30: durante mucho tiempo un
// protocolo directo (Casas/Naclerio) guardaba su resultado en
// `Sesion.finalRM` y no abría ninguna fila en `RmVigente`, así que el método
// más preciso de la app no llegaba nunca a la planificación.
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSesion } from "./sesion";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("actions/sesion — integración", () => {
  const adapter = new PrismaMariaDb(DATABASE_URL ?? "");
  const prisma = new PrismaClient({ adapter });

  const cc = `TEST-SESION-${Date.now()}`;
  let personaId: number;
  let ejercicioId: number;
  const sesionIds: number[] = [];

  beforeAll(async () => {
    const persona = await prisma.persona.create({
      data: {
        cc,
        nombre: "Test actions/sesion",
        sexo: "masculino",
        masaCorporal: 80,
        edad: 30,
        talla: 1.8,
        entrenado: true,
      },
    });
    personaId = persona.id;

    const ejercicio = await prisma.ejercicio.findFirst({
      where: { esDeTiempo: false },
      orderBy: { id: "asc" },
    });
    if (!ejercicio) {
      throw new Error("El seed debe tener al menos un ejercicio con carga.");
    }
    ejercicioId = ejercicio.id;
  });

  afterAll(async () => {
    await prisma.rmVigente.deleteMany({ where: { personaId } });
    if (sesionIds.length > 0) {
      await prisma.resultadoEjercicio.deleteMany({
        where: { sesionId: { in: sesionIds } },
      });
      await prisma.sesion.deleteMany({ where: { id: { in: sesionIds } } });
    }
    await prisma.persona.delete({ where: { id: personaId } });
    await prisma.$disconnect();
  });

  it("H-01: un protocolo directo abre RmVigente con origen test_directo", async () => {
    const { sesionId } = await createSesion({
      cc,
      requestId: `${cc}-casas`,
      peso: 80,
      trainingMonths: 12,
      rmMethod: "casas",
      estimatedRM: 100,
      finalRM: 107.5,
      protocolData: { metodo: "casas" },
      ejercicios: [],
      protocoloEjercicioId: ejercicioId,
      protocoloRepeticiones: 1,
    });
    sesionIds.push(sesionId);

    const resultados = await prisma.resultadoEjercicio.findMany({
      where: { sesionId },
    });
    expect(resultados).toHaveLength(1);
    expect(resultados[0].ejercicioId).toBe(ejercicioId);
    expect(resultados[0].rm1Estimado).toBe(107.5);
    expect(resultados[0].confianza).toBe("alta");
    expect(resultados[0].formulaPrimaria).toBe("medicion_directa");

    const vigente = await prisma.rmVigente.findFirst({
      where: { personaId, ejercicioId, validoHasta: null },
    });
    expect(vigente).not.toBeNull();
    expect(vigente?.valorKg).toBe(107.5);
    expect(vigente?.origen).toBe("test_directo");
    expect(vigente?.resultadoRmId).toBe(resultados[0].id);
  });

  it("H-02: sin levantamiento válido, el protocolo no se guarda", async () => {
    await expect(
      createSesion({
        cc,
        requestId: `${cc}-sin-rm`,
        peso: 80,
        trainingMonths: 12,
        rmMethod: "naclerio",
        estimatedRM: 100,
        finalRM: 0,
        protocolData: { metodo: "naclerio" },
        ejercicios: [],
        protocoloEjercicioId: ejercicioId,
        protocoloRepeticiones: 0,
      }),
    ).rejects.toThrow();
  });

  it("un test directo posterior cierra el vigente anterior y deja una sola fila abierta", async () => {
    const { sesionId } = await createSesion({
      cc,
      requestId: `${cc}-naclerio`,
      peso: 80,
      trainingMonths: 12,
      rmMethod: "naclerio",
      estimatedRM: 107.5,
      finalRM: 112.5,
      protocolData: { metodo: "naclerio" },
      ejercicios: [],
      protocoloEjercicioId: ejercicioId,
      protocoloRepeticiones: 1,
    });
    sesionIds.push(sesionId);

    const abiertas = await prisma.rmVigente.findMany({
      where: { personaId, ejercicioId, validoHasta: null },
    });
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0].valorKg).toBe(112.5);

    const cerradas = await prisma.rmVigente.findMany({
      where: { personaId, ejercicioId, validoHasta: { not: null } },
    });
    expect(cerradas.length).toBeGreaterThanOrEqual(1);
  });

  it("ADR-27: el RIR reportado se persiste y eleva la estimación", async () => {
    const { sesionId } = await createSesion({
      cc,
      requestId: `${cc}-estimacion`,
      peso: 80,
      trainingMonths: 1,
      rmMethod: "estimation",
      estimatedRM: 0,
      finalRM: 0,
      protocolData: { metodo: "estimacion" },
      ejercicios: [
        {
          ejercicioId,
          repeticiones: 5,
          carga: 80,
          pesoEquipo: 0,
          rir: 2,
          casas: 0,
          nacleiro: 0,
        },
      ],
      protocoloEjercicioId: null,
      protocoloRepeticiones: 0,
    });
    sesionIds.push(sesionId);

    const resultado = await prisma.resultadoEjercicio.findFirst({
      where: { sesionId },
    });

    expect(resultado?.rirReportado).toBe(2);
    // Epley sobre 7 repeticiones efectivas (5 + 2), no sobre 5.
    expect(resultado?.rm1Estimado).toBeCloseTo(80 * (1 + 0.0333 * 7), 1);
  });
});

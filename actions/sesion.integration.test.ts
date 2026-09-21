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
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ADR-52: createSesion ahora resuelve el entrenador en sesión vía
// getAuthUserFromCookies(), que llama a next/headers cookies() y solo
// funciona dentro de un request de Next.js real -no aquí, donde el test
// llama a la Server Action directo-. Se mockea solo esa función; el resto
// de lib/auth y la autorización real de lib/persona-access se mantienen
// intactos. La fixture vincula al entrenador con su atleta.
const authFixture = vi.hoisted(() => ({ id: `test-entrenador-${Date.now()}` }));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getAuthUserFromCookies: async () => ({
      userId: authFixture.id,
      username: "test-entrenador",
      role: "entrenador" as const,
    }),
  };
});

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
    await prisma.user.create({ data: { id: authFixture.id, username: authFixture.id, password: "unused", role: "entrenador" } });
    const persona = await prisma.persona.create({
      data: {
        cc,
        nombre: "Test actions/sesion",
        sexo: "masculino",
        masaCorporal: 80,
        edad: 30,
        talla: 1.8,
        entrenado: true,
        entrenadores: { create: { entrenadorId: authFixture.id } },
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
    await prisma.user.delete({ where: { id: authFixture.id } });
    await prisma.ejercicio.deleteMany({
      where: { esEjercicioLibre: true, nombre: { startsWith: `${cc}-` } },
    });
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

  it("guarda un ejercicio escrito libremente sin publicarlo en el catálogo", async () => {
    const nombreLibre = `${cc}-Peso muerto con agarre especial`;
    const { sesionId } = await createSesion({
      cc,
      requestId: `${cc}-ejercicio-libre`,
      peso: 80,
      trainingMonths: 12,
      rmMethod: "casas",
      estimatedRM: 90,
      finalRM: 95,
      protocolData: { metodo: "casas", ejercicioNombre: nombreLibre },
      ejercicios: [],
      protocoloEjercicioNombre: nombreLibre,
      protocoloRepeticiones: 1,
    });
    sesionIds.push(sesionId);

    const resultado = await prisma.resultadoEjercicio.findFirstOrThrow({
      where: { sesionId },
      include: { ejercicio: true },
    });
    expect(resultado.ejercicio.nombre).toBe(nombreLibre);
    expect(resultado.ejercicio.esEjercicioLibre).toBe(true);
    expect(resultado.ejercicio.activo).toBe(false);
    expect(resultado.rm1Estimado).toBe(95);
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

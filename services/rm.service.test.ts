// TASK-023 · Test de integración contra una base de datos real (requiere
// DATABASE_URL, ver .env). Se salta automáticamente si no hay DB
// configurada, para no romper `npm test` en un entorno sin base de datos.
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { actualizarRmVigente, actualizarRmVigenteSiSupera } from "./rm.service";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("services/rm.service — integración (TASK-023)", () => {
  const adapter = new PrismaMariaDb(DATABASE_URL ?? "");
  const prisma = new PrismaClient({ adapter });
  let personaId: number;
  const ejercicioId = 1; // "Curl de bíceps" del seed

  beforeAll(async () => {
    const persona = await prisma.persona.create({
      data: {
        cc: `TEST-RM-SERVICE-${Date.now()}`,
        nombre: "Test rm.service",
        sexo: "masculino",
        masaCorporal: 80,
        edad: 30,
        talla: 1.8,
        entrenado: true,
      },
    });
    personaId = persona.id;
  });

  afterAll(async () => {
    await prisma.rmVigente.deleteMany({ where: { personaId } });
    await prisma.persona.delete({ where: { id: personaId } });
    await prisma.$disconnect();
  });

  it("cerrar evaluación abre una fila vigente y cierra la anterior; exactamente una fila abierta", async () => {
    await prisma.$transaction(async (tx) => {
      await actualizarRmVigente(tx, {
        personaId,
        ejercicioId,
        valorKg: 100,
        origen: "estimacion",
        confianza: "media",
        fecha: new Date("2026-01-01"),
      });
    });

    let abiertas = await prisma.rmVigente.findMany({
      where: { personaId, ejercicioId, validoHasta: null },
    });
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0].valorKg).toBe(100);

    await prisma.$transaction(async (tx) => {
      await actualizarRmVigente(tx, {
        personaId,
        ejercicioId,
        valorKg: 110,
        origen: "estimacion",
        confianza: "alta",
        fecha: new Date("2026-06-01"),
      });
    });

    abiertas = await prisma.rmVigente.findMany({
      where: { personaId, ejercicioId, validoHasta: null },
    });
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0].valorKg).toBe(110);

    const cerradas = await prisma.rmVigente.findMany({
      where: { personaId, ejercicioId, validoHasta: { not: null } },
    });
    expect(cerradas).toHaveLength(1);
    expect(cerradas[0].valorKg).toBe(100);
    expect(cerradas[0].validoHasta?.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("regresión 100->110 kg: el historial completo permite reconstruir cualquier fecha pasada (AC-03)", async () => {
    const historico = await prisma.rmVigente.findMany({
      where: { personaId, ejercicioId },
      orderBy: { validoDesde: "asc" },
    });

    expect(historico.map((h) => h.valorKg)).toEqual([100, 110]);
    expect(historico[0].validoDesde.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(historico[0].validoHasta?.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(historico[1].validoHasta).toBeNull();
  });

  it("actualizarRmVigenteSiSupera no reemplaza el vigente si no lo supera (uso de entrenamiento, no de evaluación)", async () => {
    await prisma.$transaction(async (tx) => {
      await actualizarRmVigenteSiSupera(tx, {
        personaId,
        ejercicioId,
        valorKg: 105, // menor que el vigente (110)
        origen: "e1rm_entrenamiento",
        confianza: "media",
        fecha: new Date("2026-07-01"),
      });
    });

    const abiertas = await prisma.rmVigente.findMany({
      where: { personaId, ejercicioId, validoHasta: null },
    });
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0].valorKg).toBe(110);

    await prisma.$transaction(async (tx) => {
      await actualizarRmVigenteSiSupera(tx, {
        personaId,
        ejercicioId,
        valorKg: 115, // supera el vigente
        origen: "e1rm_entrenamiento",
        confianza: "media",
        fecha: new Date("2026-08-01"),
      });
    });

    const abiertasFinal = await prisma.rmVigente.findMany({
      where: { personaId, ejercicioId, validoHasta: null },
    });
    expect(abiertasFinal).toHaveLength(1);
    expect(abiertasFinal[0].valorKg).toBe(115);
  });
});

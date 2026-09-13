// TASK-037/038 · Integración contra base de datos real. Se salta si no hay
// DATABASE_URL configurada.
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { crearSesionRealizada, registrarSerie } from "./ejecucion.service";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("services/ejecucion.service — integración", () => {
  const adapter = new PrismaMariaDb(DATABASE_URL ?? "");
  const prisma = new PrismaClient({ adapter });
  let personaId: number;
  const ejercicioId = 5; // "Press de pecho en máquina" del seed

  beforeAll(async () => {
    const persona = await prisma.persona.create({
      data: {
        cc: `TEST-EJECUCION-${Date.now()}`,
        nombre: "Test ejecucion.service",
        sexo: "masculino",
        masaCorporal: 80,
        edad: 28,
        talla: 1.8,
        entrenado: true,
      },
    });
    personaId = persona.id;
  });

  afterAll(async () => {
    await prisma.rmVigente.deleteMany({ where: { personaId } });
    await prisma.serieRealizada.deleteMany({
      where: { sesionRealizada: { personaId } },
    });
    await prisma.sesionRealizada.deleteMany({ where: { personaId } });
    await prisma.persona.delete({ where: { id: personaId } });
    await prisma.$disconnect();
  });

  it("F-03: registrar una serie calcula e1RM y actualiza RmVigente solo si lo supera", async () => {
    const sesion = await crearSesionRealizada({ personaId, estado: "completa" });

    const serie1 = await registrarSerie(
      {
        sesionRealizadaId: sesion.id,
        ejercicioId,
        numeroSerie: 1,
        cargaKg: 80,
        repeticiones: 5,
        rir: 2, // 5+2=7 <=10, RIR<=3 -> válido
        requestId: `serie-1-${Date.now()}`,
      },
      personaId,
    );

    expect(serie1.e1rmKg).not.toBeNull();

    const vigenteTrasSerie1 = await prisma.rmVigente.findFirst({
      where: { personaId, ejercicioId, validoHasta: null },
    });
    expect(vigenteTrasSerie1).not.toBeNull();
    expect(vigenteTrasSerie1!.origen).toBe("e1rm_entrenamiento");

    // Una serie con e1RM menor no debe reemplazar el vigente.
    await registrarSerie(
      {
        sesionRealizadaId: sesion.id,
        ejercicioId,
        numeroSerie: 2,
        cargaKg: 60,
        repeticiones: 3,
        rir: 1,
        requestId: `serie-2-${Date.now()}`,
      },
      personaId,
    );

    const vigenteTrasSerie2 = await prisma.rmVigente.findFirst({
      where: { personaId, ejercicioId, validoHasta: null },
    });
    expect(vigenteTrasSerie2!.valorKg).toBe(vigenteTrasSerie1!.valorKg);
  });

  it("ADR-51: sin RIR reportado, cae al estimador primario (estimarRm) en vez de perder el dato", async () => {
    const sesion = await crearSesionRealizada({ personaId, estado: "completa" });

    const serie = await registrarSerie(
      {
        sesionRealizadaId: sesion.id,
        ejercicioId,
        numeroSerie: 1,
        cargaKg: 120,
        repeticiones: 5,
        rir: null,
        requestId: `sin-rir-${Date.now()}`,
      },
      personaId,
    );

    // Epley(120, 5) = 120 * (1 + 0.0333*5) ≈ 140 kg.
    expect(serie.e1rmKg).not.toBeNull();
    expect(serie.e1rmKg!).toBeGreaterThan(130);
    expect(serie.e1rmKg!).toBeLessThan(150);

    const vigente = await prisma.rmVigente.findFirst({
      where: { personaId, ejercicioId, validoHasta: null },
    });
    expect(vigente!.origen).toBe("e1rm_entrenamiento");
    expect(vigente!.valorKg).toBe(serie.e1rmKg);
  });

  it("ADR-51: sin RIR y con repeticiones no utilizables (>15), no actualiza el RM vigente", async () => {
    const sesion = await crearSesionRealizada({ personaId, estado: "completa" });
    const vigenteAntes = await prisma.rmVigente.findFirst({
      where: { personaId, ejercicioId, validoHasta: null },
    });

    const serie = await registrarSerie(
      {
        sesionRealizadaId: sesion.id,
        ejercicioId,
        numeroSerie: 1,
        cargaKg: 20,
        repeticiones: 20,
        rir: null,
        requestId: `no-utilizable-${Date.now()}`,
      },
      personaId,
    );

    expect(serie.e1rmKg).toBeNull();

    const vigenteDespues = await prisma.rmVigente.findFirst({
      where: { personaId, ejercicioId, validoHasta: null },
    });
    expect(vigenteDespues?.id).toBe(vigenteAntes?.id);
  });

  it("TASK-038: idempotencia — dos envíos con el mismo requestId crean una sola serie", async () => {
    const sesion = await crearSesionRealizada({ personaId, estado: "completa" });
    const requestId = `idempotencia-${Date.now()}`;

    const primera = await registrarSerie(
      {
        sesionRealizadaId: sesion.id,
        ejercicioId,
        numeroSerie: 1,
        cargaKg: 70,
        repeticiones: 8,
        requestId,
      },
      personaId,
    );

    const segunda = await registrarSerie(
      {
        sesionRealizadaId: sesion.id,
        ejercicioId,
        numeroSerie: 1,
        cargaKg: 70,
        repeticiones: 8,
        requestId,
      },
      personaId,
    );

    expect(segunda.id).toBe(primera.id);

    const total = await prisma.serieRealizada.count({ where: { requestId } });
    expect(total).toBe(1);
  });
});

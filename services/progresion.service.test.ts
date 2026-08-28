// TASK-049 · Integración contra base de datos real. Se salta si no hay
// DATABASE_URL configurada.
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  aceptarAjustePropuesto,
  crearAjustePropuesto,
  rechazarAjustePropuesto,
} from "./progresion.service";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("services/progresion.service — integración (TASK-049)", () => {
  const adapter = new PrismaMariaDb(DATABASE_URL ?? "");
  const prisma = new PrismaClient({ adapter });
  let personaId: number;
  let macrocicloId: number;
  let prescripcionId: number;

  beforeAll(async () => {
    const persona = await prisma.persona.create({
      data: {
        cc: `TEST-PROGRESION-${Date.now()}`,
        nombre: "Test progresion.service",
        sexo: "masculino",
        masaCorporal: 80,
        edad: 28,
        talla: 1.8,
        entrenado: true,
      },
    });
    personaId = persona.id;

    const macrociclo = await prisma.macrociclo.create({
      data: {
        personaId,
        objetivoTipo: "salud",
        fechaInicio: new Date("2026-01-05"),
        fechaFin: new Date("2026-03-29"),
        estado: "borrador",
      },
    });
    macrocicloId = macrociclo.id;

    const mesociclo = await prisma.macrocicloMesociclo.create({
      data: {
        macrocicloId,
        tipo: "entrante",
        porcentaje: 100,
        fechaInicio: new Date("2026-01-05"),
        fechaFin: new Date("2026-03-29"),
        orden: 1,
      },
    });

    const semana = await prisma.macrocicloSemana.create({
      data: {
        macrocicloId,
        mesocicloId: mesociclo.id,
        numeroSemana: 1,
        mesCalendario: 1,
        fechaInicio: new Date("2026-01-05"),
        fechaFin: new Date("2026-01-11"),
        tipoMicrociclo: "corriente",
        frecuencia: 1,
        volumen: 0,
        intensidad: 0,
      },
    });

    const sesionPlanificada = await prisma.sesionPlanificada.create({
      data: { semanaId: semana.id, orden: 1, duracionEstimadaMin: 60 },
    });

    const prescripcion = await prisma.prescripcion.create({
      data: {
        sesionPlanificadaId: sesionPlanificada.id,
        ejercicioId: 5,
        orden: 1,
        series: 3,
        repeticionesObjetivo: 8,
        repsMin: 6,
        repsMax: 12,
        porcentajeRm: 70,
        rirObjetivo: 2,
        cargaKg: 70,
        origen: "generado",
        version: 1,
      },
    });
    prescripcionId = prescripcion.id;
  });

  afterAll(async () => {
    await prisma.ajustePropuesto.deleteMany({ where: { personaId } });
    await prisma.macrociclo.delete({ where: { id: macrocicloId } }).catch(() => {});
    await prisma.persona.delete({ where: { id: personaId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("crearAjustePropuesto no duplica una propuesta pendiente idéntica", async () => {
    const primera = await crearAjustePropuesto({
      personaId,
      macrocicloId,
      alcance: "prescripcion",
      objetivoId: prescripcionId,
      propuesta: {
        tipo: "subir_carga",
        magnitudPct: 5,
        justificacion: "RIR sistemáticamente alto.",
        evidencia: { test: true },
      },
    });
    const segunda = await crearAjustePropuesto({
      personaId,
      macrocicloId,
      alcance: "prescripcion",
      objetivoId: prescripcionId,
      propuesta: {
        tipo: "subir_carga",
        magnitudPct: 5,
        justificacion: "RIR sistemáticamente alto (otra vez).",
        evidencia: { test: true },
      },
    });
    expect(segunda.id).toBe(primera.id);

    const total = await prisma.ajustePropuesto.count({
      where: { personaId, tipo: "subir_carga", estado: "pendiente" },
    });
    expect(total).toBe(1);
  });

  it("aceptar un ajuste de carga versiona la prescripción sin reescribir la anterior (R-12)", async () => {
    const ajuste = await crearAjustePropuesto({
      personaId,
      macrocicloId,
      alcance: "prescripcion",
      objetivoId: prescripcionId,
      propuesta: {
        tipo: "bajar_carga",
        magnitudPct: 5,
        justificacion: "No alcanzó repsMin en 2 sesiones.",
        evidencia: {},
      },
    });

    await aceptarAjustePropuesto(ajuste.id, "entrenador-test");

    const original = await prisma.prescripcion.findUniqueOrThrow({ where: { id: prescripcionId } });
    expect(original.cargaKg).toBe(70); // la fila publicada nunca se reescribe
    expect(original.supersededById).not.toBeNull();

    const nueva = await prisma.prescripcion.findUniqueOrThrow({
      where: { id: original.supersededById! },
    });
    expect(nueva.cargaKg).toBeLessThan(70);
    expect(nueva.origen).toBe("autorregulado");
    expect(nueva.version).toBe(2);

    const ajusteActualizado = await prisma.ajustePropuesto.findUniqueOrThrow({
      where: { id: ajuste.id },
    });
    expect(ajusteActualizado.estado).toBe("aceptado");
  });

  it("rechazar un ajuste no modifica ninguna prescripción", async () => {
    const cargaAntes = await prisma.prescripcion.count({ where: { ejercicioId: 5, sesionPlanificadaId: { not: undefined } } });

    const ajuste = await crearAjustePropuesto({
      personaId,
      macrocicloId,
      alcance: "prescripcion",
      objetivoId: prescripcionId,
      propuesta: {
        tipo: "subir_carga",
        magnitudPct: 5,
        justificacion: "test rechazo",
        evidencia: {},
      },
    });

    await rechazarAjustePropuesto(ajuste.id, "entrenador-test");

    const ajusteActualizado = await prisma.ajustePropuesto.findUniqueOrThrow({
      where: { id: ajuste.id },
    });
    expect(ajusteActualizado.estado).toBe("rechazado");

    const cargaDespues = await prisma.prescripcion.count({ where: { ejercicioId: 5, sesionPlanificadaId: { not: undefined } } });
    expect(cargaDespues).toBe(cargaAntes);
  });
});

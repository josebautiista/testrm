// TASK-035 · Integración contra base de datos real (requiere DATABASE_URL).
// Se salta automáticamente si no hay DB configurada.
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  construirContexto,
  generarPropuesta,
  publicarPlan,
} from "./planificacion.service";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)(
  "services/planificacion.service — integración (TASK-035, §16.2)",
  () => {
    const adapter = new PrismaMariaDb(DATABASE_URL ?? "");
    const prisma = new PrismaClient({ adapter });
    let personaId: number;
    let macrocicloId: number;

    beforeAll(async () => {
      const persona = await prisma.persona.create({
        data: {
          cc: `TEST-PLANIFICACION-${Date.now()}`,
          nombre: "Test planificacion.service",
          sexo: "masculino",
          masaCorporal: 80,
          edad: 28,
          talla: 1.8,
          entrenado: true,
          mesesEntrenamiento: 12,
          diasDisponibles: 4,
          minutosPorSesion: 60,
          equipamiento: ["barra", "maquina", "polea", "peso_corporal"],
        },
      });
      personaId = persona.id;

      // RM vigentes para un par de ejercicios del seed.
      await prisma.rmVigente.createMany({
        data: [
          { personaId, ejercicioId: 2, valorKg: 150, origen: "estimacion", confianza: "alta", validoDesde: new Date("2026-01-01") },
          { personaId, ejercicioId: 5, valorKg: 80, origen: "estimacion", confianza: "alta", validoDesde: new Date("2026-01-01") },
        ],
      });

      const fechaInicio = new Date("2026-01-05T00:00:00");
      const fechaFin = new Date(fechaInicio);
      fechaFin.setDate(fechaFin.getDate() + 12 * 7 - 1);

      const macrociclo = await prisma.macrociclo.create({
        data: {
          personaId,
          objetivoTipo: "salud",
          fechaInicio,
          fechaFin,
          estado: "borrador",
        },
      });
      macrocicloId = macrociclo.id;
    });

    afterAll(async () => {
      await prisma.macrociclo.delete({ where: { id: macrocicloId } }).catch(() => {});
      await prisma.rmVigente.deleteMany({ where: { personaId } });
      await prisma.persona.delete({ where: { id: personaId } }).catch(() => {});
      await prisma.$disconnect();
    });

    it("genera y publica un plan coherente; toda carga tiene rmVigenteId", async () => {
      const contexto = await construirContexto(macrocicloId, personaId);
      const propuesta = generarPropuesta(contexto);
      expect(propuesta.errores).toEqual([]);

      await publicarPlan({
        macrocicloId,
        personaId,
        propuesta,
        context: { userType: "persona" },
      });

      const semanasGuardadas = await prisma.macrocicloSemana.findMany({
        where: { macrocicloId },
        include: { sesiones: { include: { prescripciones: true } } },
        orderBy: { numeroSemana: "asc" },
      });

      expect(semanasGuardadas).toHaveLength(propuesta.totalSemanas);

      const prescripcionesConCarga = semanasGuardadas
        .flatMap((s) => s.sesiones)
        .flatMap((s) => s.prescripciones)
        .filter((p) => p.cargaKg !== null);

      expect(prescripcionesConCarga.length).toBeGreaterThan(0);
      for (const p of prescripcionesConCarga) {
        expect(p.rmVigenteId).not.toBeNull();
        expect(p.rmUsadoKg).not.toBeNull();
      }
    });

    it("regenerar desde una fecha futura respeta un override existente y no toca semanas anteriores (R-12, §6.3)", async () => {
      const semana1 = await prisma.macrocicloSemana.findFirstOrThrow({
        where: { macrocicloId, numeroSemana: 1 },
        include: { sesiones: { include: { prescripciones: true } } },
      });
      const primeraPrescripcion = semana1.sesiones[0].prescripciones[0];

      // El entrenador ajusta una prescripción de la semana 1 a mano.
      await prisma.prescripcion.update({
        where: { id: primeraPrescripcion.id },
        data: { cargaKg: 12345, origen: "ajustado_entrenador", version: 2 },
      });

      const contexto = await construirContexto(macrocicloId, personaId);
      const propuesta = generarPropuesta(contexto);
      expect(propuesta.errores).toEqual([]);

      // Regenerar desde la semana 3 en adelante: la semana 1 (con el
      // override) y la semana 2 no deberían tocarse.
      const fechaCorte = new Date(semana1.fechaInicio);
      fechaCorte.setDate(fechaCorte.getDate() + 14); // inicio de la semana 3

      await publicarPlan({
        macrocicloId,
        personaId,
        propuesta,
        context: { userType: "persona" },
        fechaCorte,
      });

      const prescripcionTrasRegenerar = await prisma.prescripcion.findUniqueOrThrow({
        where: { id: primeraPrescripcion.id },
      });
      expect(prescripcionTrasRegenerar.cargaKg).toBe(12345);
      expect(prescripcionTrasRegenerar.origen).toBe("ajustado_entrenador");

      const semana2TrasRegenerar = await prisma.macrocicloSemana.findFirstOrThrow({
        where: { macrocicloId, numeroSemana: 2 },
      });
      expect(semana2TrasRegenerar.fechaInicio.getTime()).toBe(
        new Date(semana1.fechaInicio.getTime() + 7 * 24 * 60 * 60 * 1000).getTime(),
      );
    });
  },
);

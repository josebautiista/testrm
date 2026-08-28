// TASK-035 · Servicio de planificación: construye el ContextoPlanificacion
// desde la base de datos, invoca el motor puro (lib/planificacion/motor.ts)
// y persiste la propuesta con regeneración parcial (§6.3): las semanas ya
// pasadas y las prescripciones marcadas como override nunca se tocan.
import { prisma } from "@/lib/prisma";
import { generarPlan } from "@/lib/planificacion/motor";
import type {
  ContextoPlanificacion,
  EjercicioCatalogo,
  PropuestaPlan,
  RmVigenteContexto,
} from "@/lib/planificacion/tipos";
import { isUserLevel, type UserLevel } from "@/lib/user-level";
import type { AuditContext } from "@/services/macrociclo.service";
import { auditarMacrociclo } from "@/services/macrociclo.service";

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export class PublicacionPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicacionPlanError";
  }
}

/** Construye el ContextoPlanificacion de un macrociclo a partir de la base de datos. */
export async function construirContexto(
  macrocicloId: number,
  personaId: number,
): Promise<ContextoPlanificacion> {
  const [macrociclo, persona, rmVigentesDb, catalogoDb] = await Promise.all([
    prisma.macrociclo.findUniqueOrThrow({
      where: { id: macrocicloId, personaId },
      select: {
        objetivoTipo: true,
        fechaInicio: true,
        fechaFin: true,
        fechaCompetencia: true,
      },
    }),
    prisma.persona.findUniqueOrThrow({
      where: { id: personaId },
      select: {
        sexo: true,
        edad: true,
        masaCorporal: true,
        mesesEntrenamiento: true,
        limitaciones: true,
        diasDisponibles: true,
        minutosPorSesion: true,
        equipamiento: true,
        nivelOverride: true,
      },
    }),
    prisma.rmVigente.findMany({
      where: { personaId, validoHasta: null },
      select: {
        id: true,
        ejercicioId: true,
        valorKg: true,
        confianza: true,
        validoDesde: true,
      },
    }),
    prisma.ejercicio.findMany({ where: { activo: true } }),
  ]);

  const nivel: UserLevel = isUserLevel(persona.nivelOverride) ? persona.nivelOverride : "beginner";

  const rmVigentes: RmVigenteContexto[] = rmVigentesDb.map((r) => ({
    rmVigenteId: r.id,
    ejercicioId: r.ejercicioId,
    valorKg: r.valorKg,
    confianza: r.confianza === "alta" || r.confianza === "media" ? r.confianza : "baja",
    validoDesde: r.validoDesde,
  }));

  const catalogo: EjercicioCatalogo[] = catalogoDb.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    patron: e.patron,
    musculoPrimario: e.musculoPrimario,
    equipamiento: e.equipamiento,
    incrementoMinimoKg: e.incrementoMinimoKg,
    admitePorcentajeRm: e.admitePorcentajeRm,
    esDeTiempo: e.esDeTiempo,
    esUnilateral: e.esUnilateral,
    activo: e.activo,
    enBateriaEvaluacion: e.enBateriaEvaluacion,
  }));

  const equipamiento = Array.isArray(persona.equipamiento)
    ? (persona.equipamiento as string[])
    : [];

  return {
    atleta: {
      nivel,
      sexo: persona.sexo,
      edad: persona.edad,
      masaCorporal: persona.masaCorporal,
      mesesEntrenamiento: persona.mesesEntrenamiento,
      limitaciones: persona.limitaciones,
    },
    objetivo: {
      tipo: macrociclo.objetivoTipo === "competencia" ? "competencia" : "salud",
      fechaInicio: macrociclo.fechaInicio,
      fechaFin: macrociclo.fechaFin,
      fechaCompetencia: macrociclo.fechaCompetencia,
    },
    disponibilidad: {
      diasPorSemana: persona.diasDisponibles,
      minutosPorSesion: persona.minutosPorSesion,
      equipamiento,
    },
    rmVigentes,
    catalogo,
  };
}

/** Invoca el motor puro. No persiste nada (§9.5: generarPlanAction devuelve la propuesta sin guardar). */
export function generarPropuesta(contexto: ContextoPlanificacion): PropuestaPlan {
  return generarPlan(contexto);
}

/**
 * TASK-035 · Persiste una PropuestaPlan ya validada (sin errores).
 * Regeneración parcial (§6.3): solo se escriben semanas cuya `fechaInicio`
 * sea >= fechaCorte (por defecto, hoy) Y cuya `fechaFin` en la base de
 * datos, si la semana ya existía, no haya pasado — nunca se toca una semana
 * ya ejecutada. Las prescripciones ya ajustadas a mano (origen
 * "ajustado_entrenador") quedan ancladas: el motor no las sobrescribe (R-12).
 */
export async function publicarPlan({
  macrocicloId,
  personaId,
  propuesta,
  context,
  fechaCorte,
}: {
  macrocicloId: number;
  personaId: number;
  propuesta: PropuestaPlan;
  context: AuditContext;
  fechaCorte?: Date;
}): Promise<void> {
  if (propuesta.errores.length > 0) {
    throw new PublicacionPlanError(
      `No se puede publicar un plan con errores: ${propuesta.errores.join(" ")}`,
    );
  }

  const corte = startOfDay(fechaCorte ?? new Date());

  await prisma.$transaction(
    async (tx) => {
      // ---------- Periodos + etapas (diff por orden) ----------
      const periodosExistentes = await tx.macrocicloPeriodo.findMany({
        where: { macrocicloId },
        select: { id: true, orden: true },
      });
      const periodoIdPorOrden = new Map(periodosExistentes.map((p) => [p.orden, p.id]));

      for (const periodo of propuesta.periodos) {
        const existenteId = periodoIdPorOrden.get(periodo.orden);
        const data = {
          tipo: periodo.tipo,
          porcentaje: periodo.porcentaje,
          fechaInicio: periodo.fechaInicio,
          fechaFin: periodo.fechaFin,
        };
        if (existenteId) {
          await tx.macrocicloPeriodo.update({ where: { id: existenteId }, data });
        } else {
          const creado = await tx.macrocicloPeriodo.create({
            data: { macrocicloId, orden: periodo.orden, ...data },
          });
          periodoIdPorOrden.set(periodo.orden, creado.id);
        }

        const periodoId = periodoIdPorOrden.get(periodo.orden)!;
        const etapasExistentes = await tx.macrocicloEtapa.findMany({
          where: { periodoId },
          select: { id: true, orden: true },
        });
        const etapaIdPorOrden = new Map(etapasExistentes.map((e) => [e.orden, e.id]));

        for (const etapa of periodo.etapas) {
          const existenteEtapaId = etapaIdPorOrden.get(etapa.orden);
          const dataEtapa = {
            tipo: etapa.tipo,
            porcentaje: etapa.porcentaje,
            fechaInicio: etapa.fechaInicio,
            fechaFin: etapa.fechaFin,
          };
          if (existenteEtapaId) {
            await tx.macrocicloEtapa.update({ where: { id: existenteEtapaId }, data: dataEtapa });
          } else {
            await tx.macrocicloEtapa.create({
              data: { periodoId, orden: etapa.orden, ...dataEtapa },
            });
          }
        }
      }

      // ---------- Mesociclos (diff por orden, con objetivoBloque/zona) ----------
      const mesociclosExistentes = await tx.macrocicloMesociclo.findMany({
        where: { macrocicloId },
        select: { id: true, orden: true },
      });
      const mesocicloIdPorOrden = new Map(mesociclosExistentes.map((m) => [m.orden, m.id]));

      for (const mesociclo of propuesta.mesociclos) {
        const data = {
          tipo: mesociclo.tipo,
          porcentaje: mesociclo.porcentaje,
          fechaInicio: mesociclo.fechaInicio,
          fechaFin: mesociclo.fechaFin,
          objetivoBloque: mesociclo.objetivoBloque,
          intensidadMinPct: mesociclo.intensidadMinPct,
          intensidadMaxPct: mesociclo.intensidadMaxPct,
          repsMin: mesociclo.repsMin,
          repsMax: mesociclo.repsMax,
          rirObjetivo: mesociclo.rirObjetivo,
          progresion: mesociclo.progresion,
        };
        const existenteId = mesocicloIdPorOrden.get(mesociclo.orden);
        if (existenteId) {
          await tx.macrocicloMesociclo.update({ where: { id: existenteId }, data });
        } else {
          const creado = await tx.macrocicloMesociclo.create({
            data: { macrocicloId, orden: mesociclo.orden, ...data },
          });
          mesocicloIdPorOrden.set(mesociclo.orden, creado.id);
        }
      }

      // ---------- Semanas + sesiones + prescripciones ----------
      const semanasExistentes = await tx.macrocicloSemana.findMany({
        where: { macrocicloId },
        select: { id: true, numeroSemana: true, fechaFin: true },
      });
      const semanaExistentePorNumero = new Map(
        semanasExistentes.map((s) => [s.numeroSemana, s]),
      );

      for (const semana of propuesta.semanas) {
        const existente = semanaExistentePorNumero.get(semana.numeroSemana);

        // Regeneración parcial (§6.3): esto solo protege una semana que YA
        // fue publicada antes — nunca bloquea la primera publicación de un
        // plan nuevo, sin importar si sus fechas caen en el pasado respecto
        // a "hoy" (p.ej. un plan que arrancó antes de existir en el
        // sistema). Una semana existente nunca se toca si ya pasó, ni si es
        // anterior a la fecha de corte que pidió el entrenador.
        if (existente) {
          if (existente.fechaFin < corte) continue;
          if (semana.fechaInicio < corte) continue;
        }

        const mesocicloId = mesocicloIdPorOrden.get(semana.mesocicloOrden);
        if (!mesocicloId) continue;

        // volumen/intensidad quedan derivados de las prescripciones (F-05),
        // no como entradas manuales (corrige D-11).
        const todasLasPrescripciones = semana.sesiones.flatMap((s) => s.prescripciones);
        const conPorcentaje = todasLasPrescripciones.filter((p) => p.porcentajeRm !== null);
        const volumenTotal = todasLasPrescripciones.reduce((sum, p) => sum + p.tonelaje, 0);
        const intensidadPromedio =
          conPorcentaje.length > 0
            ? conPorcentaje.reduce((sum, p) => sum + (p.porcentajeRm ?? 0), 0) / conPorcentaje.length
            : 0;

        const dataSemana = {
          macrocicloId,
          mesocicloId,
          numeroSemana: semana.numeroSemana,
          mesCalendario: semana.mesCalendario,
          fechaInicio: semana.fechaInicio,
          fechaFin: semana.fechaFin,
          tipoMicrociclo: semana.tipoMicrociclo,
          frecuencia: semana.sesiones.length,
          volumen: volumenTotal,
          intensidad: intensidadPromedio,
          esDeload: semana.esDeload,
          factorVolumen: semana.factorVolumen,
          factorIntensidad: semana.factorIntensidad,
          origen: "generado",
        };

        let semanaId: number;
        if (existente) {
          await tx.macrocicloSemana.update({ where: { id: existente.id }, data: dataSemana });
          semanaId = existente.id;
        } else {
          const creada = await tx.macrocicloSemana.create({ data: dataSemana });
          semanaId = creada.id;
        }

        const sesionesExistentes = await tx.sesionPlanificada.findMany({
          where: { semanaId },
          select: { id: true, orden: true },
        });
        const sesionIdPorOrden = new Map(sesionesExistentes.map((s) => [s.orden, s.id]));

        for (const sesion of semana.sesiones) {
          const dataSesion = {
            duracionEstimadaMin: sesion.duracionEstimadaMin,
            enfoque: sesion.enfoque,
          };
          let sesionId = sesionIdPorOrden.get(sesion.orden);
          if (sesionId) {
            await tx.sesionPlanificada.update({ where: { id: sesionId }, data: dataSesion });
          } else {
            const creada = await tx.sesionPlanificada.create({
              data: { semanaId, orden: sesion.orden, ...dataSesion },
            });
            sesionId = creada.id;
            sesionIdPorOrden.set(sesion.orden, sesionId);
          }

          // R-12: las prescripciones con origen "ajustado_entrenador" están
          // ancladas — el motor no las toca en una regeneración.
          const prescripcionesExistentes = await tx.prescripcion.findMany({
            where: { sesionPlanificadaId: sesionId },
          });
          const existentePorOrden = new Map(
            prescripcionesExistentes.map((p) => [p.orden, p]),
          );

          for (const prescripcion of sesion.prescripciones) {
            const existentePrescripcion = existentePorOrden.get(prescripcion.orden);

            if (existentePrescripcion?.origen === "ajustado_entrenador") {
              continue;
            }

            const dataPrescripcion = {
              ejercicioId: prescripcion.ejercicioId,
              series: prescripcion.series,
              repeticionesObjetivo: prescripcion.repeticionesObjetivo,
              repsMin: prescripcion.repsMin,
              repsMax: prescripcion.repsMax,
              porcentajeRm: prescripcion.porcentajeRm,
              rirObjetivo: prescripcion.rirObjetivo,
              cargaKg: prescripcion.cargaKg,
              descansoSeg: prescripcion.descansoSeg,
              rmUsadoKg: prescripcion.rmUsadoKg,
              rmVigenteId: prescripcion.rmVigenteId,
              formulaRm: prescripcion.formulaRm,
              origen: "generado",
              calculadoEn: new Date(),
            };

            if (existentePrescripcion) {
              await tx.prescripcion.update({
                where: { id: existentePrescripcion.id },
                data: dataPrescripcion,
              });
            } else {
              await tx.prescripcion.create({
                data: {
                  sesionPlanificadaId: sesionId,
                  orden: prescripcion.orden,
                  version: 1,
                  ...dataPrescripcion,
                },
              });
            }
          }
        }
      }

      await tx.macrociclo.update({
        where: { id: macrocicloId },
        data: { generadoEn: new Date(), version: { increment: 1 } },
      });
    },
    { timeout: 30000, maxWait: 10000 },
  );

  await auditarMacrociclo({
    macrocicloId,
    personaId,
    action: "plan_publicado",
    metadata: {
      totalSemanas: propuesta.totalSemanas,
      avisos: propuesta.avisos.length,
      fechaCorte: corte.toISOString(),
    },
    context,
  });
}

/**
 * TASK-035 · Regenera el plan desde una fecha (por defecto, hoy): recalcula
 * todo con el motor puro, pero `publicarPlan` solo escribe lo que cae en o
 * después de `fechaCorte` — las semanas anteriores y los overrides del
 * entrenador quedan intactos por construcción.
 */
export async function regenerarDesde({
  macrocicloId,
  personaId,
  fechaCorte,
  context,
}: {
  macrocicloId: number;
  personaId: number;
  fechaCorte?: Date;
  context: AuditContext;
}): Promise<PropuestaPlan> {
  const contexto = await construirContexto(macrocicloId, personaId);
  const propuesta = generarPropuesta(contexto);

  if (propuesta.errores.length > 0) {
    return propuesta;
  }

  await publicarPlan({ macrocicloId, personaId, propuesta, context, fechaCorte });

  return propuesta;
}

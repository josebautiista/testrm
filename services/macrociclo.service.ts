import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  type EstadoMacrociclo,
  type MedidasSnapshot,
  type MesocicloInput,
  type PeriodoInput,
  type SemanaInput,
  type TipoEtapa,
  type TipoPeriodo,
  type Vo2maxSnapshot,
} from "@/lib/macrociclo";
import {
  calcularPeriodizacion,
  contarSemanas,
} from "@/lib/macrociclo-periodizacion";
import { isTipoMicrociclo, PASO_WIZARD } from "@/lib/macrociclo";
import { factoresPorTipoMicrociclo } from "@/lib/planificacion/taper";
import { DELOAD } from "@/lib/config/parametros";
import { obtenerEstructura } from "@/lib/planificacion/plantillas";
import {
  isCapacidadDominante,
  isEstructuraCalendario,
  isNivelAtleta,
  modoCalendarioDe,
  type PerfilDeportivo,
} from "@/lib/planificacion/perfil";
import { validarObjetivoBloque } from "@/lib/planificacion/objetivo-bloque";

export type AuditContext = {
  userType: "persona" | "admin";
  adminId?: string | null;
};

export async function auditarMacrociclo({
  macrocicloId,
  personaId,
  action,
  metadata,
  before,
  after,
  context,
}: {
  macrocicloId: number;
  personaId: number;
  action: string;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  context: AuditContext;
}) {
  await prisma.macrocicloAuditLog.create({
    data: {
      macrocicloId,
      personaId,
      adminId: context.adminId,
      userType: context.userType,
      action,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function crearORecuperarBorrador({
  personaId,
  cc,
  context,
}: {
  personaId: number;
  cc: string;
  context: AuditContext;
}) {
  return prisma.$transaction(async (tx) => {
    const abierto = await tx.macrociclo.findFirst({
      where: {
        personaId,
        estado: { in: ["borrador", "activo"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (abierto) {
      return { macrociclo: abierto, created: false };
    }

    const creado = await tx.macrociclo.create({
      data: {
        personaId,
        objetivoTipo: "salud",
        fechaInicio: new Date(),
        fechaFin: new Date(),
        estado: "borrador",
        pasoActual: 1,
      },
    });

    await tx.macrocicloAuditLog.create({
      data: {
        macrocicloId: creado.id,
        personaId,
        adminId: context.adminId,
        userType: context.userType,
        action: "macrociclo_creado",
        metadata: { cc },
      },
    });

    return { macrociclo: creado, created: true };
  });
}

/**
 * ADR-37 · El macrociclo se cierra cuando termina, no cuando se compite.
 *
 * Antes se cerraba un día después de `fechaCompetencia`: el atleta competía y
 * al día siguiente su plan desaparecía, sin transitorio y sin evaluación
 * final. Pero el periodo transitorio va justo después de competir, y cortar
 * en seco produce desentrenamiento medible en menos de cuatro semanas. Ahora
 * el cierre ocurre al pasar `fechaFin`, que es donde termina el transitorio.
 */
export async function cerrarMacrocicloLazy(personaId: number) {
  const umbral = new Date();
  umbral.setHours(0, 0, 0, 0);

  const vencidos = await prisma.macrociclo.findMany({
    where: {
      personaId,
      estado: "activo",
      fechaFin: { lt: umbral },
    },
  });

  for (const macrociclo of vencidos) {
    await prisma.macrociclo.update({
      where: { id: macrociclo.id },
      data: {
        estado: "cerrado",
        closedAt: new Date(),
        closedReason: "auto_fin_transitorio",
      },
    });

    await prisma.macrocicloAuditLog.create({
      data: {
        macrocicloId: macrociclo.id,
        personaId,
        userType: "persona",
        action: "macrociclo_cerrado_auto",
        metadata: { reason: "auto_fin_transitorio" },
      },
    });
  }
}

export async function cerrarMacrociclo({
  id,
  personaId,
  context,
}: {
  id: number;
  personaId: number;
  context: AuditContext;
}) {
  const actualizado = await prisma.macrociclo.update({
    where: { id, personaId, estado: { in: ["borrador", "activo"] } },
    data: {
      estado: "cerrado",
      closedAt: new Date(),
      closedReason: "manual",
    },
  });

  await auditarMacrociclo({
    macrocicloId: id,
    personaId,
    action: "macrociclo_cerrado_manual",
    context,
  });

  return actualizado;
}

export async function eliminarMacrociclo({
  id,
  personaId,
  context,
}: {
  id: number;
  personaId: number;
  context: AuditContext;
}) {
  const actualizado = await prisma.macrociclo.update({
    where: { id, personaId },
    data: {
      estado: "eliminado",
      deletedAt: new Date(),
    },
  });

  await auditarMacrociclo({
    macrocicloId: id,
    personaId,
    action: "macrociclo_eliminado",
    context,
  });

  return actualizado;
}

export async function guardarPasoObjetivoFechas({
  id,
  personaId,
  objetivoTipo,
  objetivoDetalle,
  fechaInicio,
  fechaFin,
  pasoActual,
  context,
}: {
  id: number;
  personaId: number;
  objetivoTipo: string;
  objetivoDetalle?: string;
  fechaInicio: Date;
  fechaFin: Date;
  pasoActual: number;
  context: AuditContext;
}) {
  // M-03/ADR-41: `fechaCompetencia` no se toca aquí. Su fuente única es
  // `guardarCompetencias`, que la deriva de la primera competencia principal
  // del calendario. Tener dos escritores era tener dos verdades.
  const actualizado = await prisma.macrociclo.update({
    where: { id, personaId },
    data: {
      objetivoTipo,
      objetivoDetalle,
      fechaInicio,
      fechaFin,
      pasoActual: Math.max(pasoActual, PASO_WIZARD.perfil),
    },
  });

  await auditarMacrociclo({
    macrocicloId: id,
    personaId,
    action: "paso_objetivo_fechas_guardado",
    context,
  });

  return actualizado;
}

export async function guardarMedidasSnapshot({
  id,
  personaId,
  medidas,
  actualizarPersona,
  pasoActual,
  context,
}: {
  id: number;
  personaId: number;
  medidas: MedidasSnapshot;
  actualizarPersona: boolean;
  pasoActual: number;
  context: AuditContext;
}) {
  const dataPersona = actualizarPersona
    ? {
        masaCorporal: medidas.medidasBasicas?.masaCorporalKg,
        talla: medidas.medidasBasicas?.tallaCm
          ? medidas.medidasBasicas.tallaCm / 100
          : undefined,
        cintura: medidas.perimetros?.cinturaCm,
        cadera: medidas.perimetros?.caderaCm,
      }
    : {};

  await prisma.$transaction(async (tx) => {
    await tx.macrociclo.update({
      where: { id, personaId },
      data: {
        medidasSnapshot: medidas as Prisma.InputJsonValue,
        pasoActual: Math.max(pasoActual, PASO_WIZARD.vo2max),
      },
    });

    if (actualizarPersona) {
      await tx.persona.update({
        where: { id: personaId },
        data: {
          ...(dataPersona.masaCorporal !== undefined && dataPersona.masaCorporal > 0
            ? { masaCorporal: dataPersona.masaCorporal }
            : {}),
          ...(dataPersona.talla !== undefined && dataPersona.talla > 0
            ? { talla: dataPersona.talla }
            : {}),
          ...(dataPersona.cintura !== undefined && dataPersona.cintura > 0
            ? { cintura: dataPersona.cintura }
            : {}),
          ...(dataPersona.cadera !== undefined && dataPersona.cadera > 0
            ? { cadera: dataPersona.cadera }
            : {}),
        },
      });
    }

    await tx.macrocicloAuditLog.create({
      data: {
        macrocicloId: id,
        personaId,
        adminId: context.adminId,
        userType: context.userType,
        action: "medidas_guardadas",
        metadata: { actualizoPersona: actualizarPersona },
      },
    });
  });
}

export async function guardarRmSnapshot({
  id,
  personaId,
  sesionRmId,
  sesionRmIds,
  rmSnapshot,
  pasoActual,
  context,
}: {
  id: number;
  personaId: number;
  sesionRmId: number;
  sesionRmIds: number[];
  rmSnapshot: Record<string, unknown>;
  pasoActual: number;
  context: AuditContext;
}) {
  const actualizado = await prisma.macrociclo.update({
    where: { id, personaId },
    data: {
      sesionRmId,
      rmSnapshot: rmSnapshot as Prisma.InputJsonValue,
      pasoActual: Math.max(pasoActual, PASO_WIZARD.vo2max),
    },
  });

  await auditarMacrociclo({
    macrocicloId: id,
    personaId,
    action: "rm_asociado",
    metadata: { sesionRmId, sesionRmIds },
    context,
  });

  return actualizado;
}

export async function guardarVo2maxSnapshot({
  id,
  personaId,
  vo2max,
  pasoActual,
  context,
}: {
  id: number;
  personaId: number;
  vo2max: Vo2maxSnapshot;
  pasoActual: number;
  context: AuditContext;
}) {
  const actualizado = await prisma.macrociclo.update({
    where: { id, personaId },
    data: {
      vo2maxSnapshot: vo2max as Prisma.InputJsonValue,
      pasoActual: Math.max(pasoActual, PASO_WIZARD.estructura),
    },
  });

  await auditarMacrociclo({
    macrocicloId: id,
    personaId,
    action: "vo2max_guardado",
    context,
  });

  return actualizado;
}

/**
 * ADR-37: la estructura ya no llega como tres conjuntos de porcentajes que el
 * entrenador tenía que cuadrar a mano. Se deriva del perfil deportivo
 * guardado en el macrociclo y de su duración; periodos, etapas y mesociclos
 * alinean por construcción.
 */

/**
 * ADR-37 · Perfil efectivo del macrociclo. Si falta alguno de los tres
 * descriptores se deriva del objetivo: "salud" no tiene competencia y
 * "competencia" asume un pico único, que es el caso más común.
 */
export function resolverPerfil(macrociclo: {
  objetivoTipo: string;
  capacidadDominante: string | null;
  estructuraCalendario: string | null;
  nivelAtleta: string | null;
}): PerfilDeportivo {
  return {
    capacidad: isCapacidadDominante(macrociclo.capacidadDominante)
      ? macrociclo.capacidadDominante
      : "mixto_intermitente",
    calendario: isEstructuraCalendario(macrociclo.estructuraCalendario)
      ? macrociclo.estructuraCalendario
      : macrociclo.objetivoTipo === "competencia"
        ? "pico_unico"
        : "sin_competencia",
    nivel: isNivelAtleta(macrociclo.nivelAtleta)
      ? macrociclo.nivelAtleta
      : "beginner",
  };
}

/** ADR-37 · Guarda los tres descriptores del perfil deportivo. */
/** Paso del asistente que sigue al de perfil. */
const PASO_SIGUIENTE_A_PERFIL = PASO_WIZARD.rm;

export async function guardarPerfilDeportivo({
  id,
  personaId,
  perfil,
  context,
}: {
  id: number;
  personaId: number;
  perfil: PerfilDeportivo;
  context: AuditContext;
}) {
  const antes = await prisma.macrociclo.findUnique({
    where: { id, personaId },
    select: {
      capacidadDominante: true,
      estructuraCalendario: true,
      nivelAtleta: true,
      pasoActual: true,
    },
  });

  if (!antes) {
    throw new Error("Macrociclo no encontrado.");
  }

  const actualizado = await prisma.macrociclo.update({
    where: { id },
    data: {
      capacidadDominante: perfil.capacidad,
      estructuraCalendario: perfil.calendario,
      nivelAtleta: perfil.nivel,
      // Nunca retrocede: si el entrenador vuelve a este paso desde el 7, el
      // asistente no debe reiniciarse a la mitad.
      pasoActual: Math.max(antes.pasoActual, PASO_SIGUIENTE_A_PERFIL),
    },
  });

  await auditarMacrociclo({
    macrocicloId: id,
    personaId,
    action: "perfil_deportivo_guardado",
    before: antes,
    after: {
      capacidadDominante: perfil.capacidad,
      estructuraCalendario: perfil.calendario,
      nivelAtleta: perfil.nivel,
    },
    context,
  });

  return actualizado;
}

/**
 * ADR-38 · Reemplaza el calendario de competencias del macrociclo. Se
 * sustituye completo (no hay diff) porque una competencia no tiene estado
 * propio que preservar: es una fecha con un nombre.
 */
export async function guardarCompetencias({
  id,
  personaId,
  competencias,
  context,
}: {
  id: number;
  personaId: number;
  competencias: Array<{
    nombre: string;
    fecha: Date;
    importancia: "principal" | "secundaria";
  }>;
  context: AuditContext;
}) {
  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId },
    select: {
      fechaInicio: true,
      fechaFin: true,
      pasoActual: true,
      competencias: { select: { nombre: true, fecha: true, importancia: true } },
    },
  });

  if (!macrociclo) {
    throw new Error("Macrociclo no encontrado.");
  }

  const validas = competencias.filter(
    (competencia) =>
      competencia.fecha instanceof Date &&
      !Number.isNaN(competencia.fecha.getTime()) &&
      competencia.nombre.trim() !== "",
  );

  await prisma.$transaction(async (tx) => {
    await tx.macrocicloCompetencia.deleteMany({ where: { macrocicloId: id } });

    if (validas.length > 0) {
      await tx.macrocicloCompetencia.createMany({
        data: validas.map((competencia) => ({
          macrocicloId: id,
          nombre: competencia.nombre.trim(),
          fecha: competencia.fecha,
          importancia: competencia.importancia,
        })),
      });
    }

    // La primera competencia principal sigue poblando `fechaCompetencia`:
    // el cierre automático y los planes antiguos dependen de ese campo.
    const principal = validas
      .filter((competencia) => competencia.importancia === "principal")
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())[0];

    await tx.macrociclo.update({
      where: { id },
      data: {
        fechaCompetencia: principal?.fecha ?? null,
        pasoActual: Math.max(macrociclo.pasoActual, PASO_SIGUIENTE_A_PERFIL),
      },
    });
  });

  await auditarMacrociclo({
    macrocicloId: id,
    personaId,
    action: "competencias_guardadas",
    before: { competencias: macrociclo.competencias },
    after: { competencias: validas },
    context,
  });
}

export async function guardarPeriodizacion({
  id,
  personaId,
  semanas,
  pasoActual,
  context,
}: {
  id: number;
  personaId: number;
  semanas: SemanaInput[];
  pasoActual: number;
  context: AuditContext;
}) {
  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId },
    select: {
      fechaInicio: true,
      fechaFin: true,
      objetivoTipo: true,
      capacidadDominante: true,
      estructuraCalendario: true,
      nivelAtleta: true,
      competencias: {
        select: { nombre: true, fecha: true, importancia: true },
        orderBy: { fecha: "asc" },
      },
    },
  });

  if (!macrociclo) {
    throw new Error("Macrociclo no encontrado.");
  }

  const perfil = resolverPerfil(macrociclo);
  const totalSemanas = contarSemanas(
    macrociclo.fechaInicio,
    macrociclo.fechaFin,
  );
  const estructura = obtenerEstructura(perfil, totalSemanas);

  const calculado = calcularPeriodizacion({
    fechaInicio: macrociclo.fechaInicio,
    fechaFin: macrociclo.fechaFin,
    estructura,
    competencias: macrociclo.competencias.map((competencia) => ({
      fecha: competencia.fecha,
      importancia:
        competencia.importancia === "principal" ? "principal" : "secundaria",
      nombre: competencia.nombre,
    })),
    modoCalendario: modoCalendarioDe(perfil),
    frecuenciaDeload:
      perfil.nivel === "advanced"
        ? DELOAD.frecuenciaSemanasAvanzado
        : DELOAD.frecuenciaSemanasEstandar,
  });

  // F-08/D-10/ADR-37: calcularPeriodizacion nunca lanza; si la estructura no
  // cabe en el rango de fechas, lo reporta aquí como un error explícito antes
  // de tocar la base de datos (E-06).
  if (calculado.errores.length > 0) {
    throw new Error(calculado.errores.join(" "));
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // D-08: guardado no destructivo. En vez de deleteMany + recrear todo (lo
  // que arrastraba en cascada MesocicloCarga y MacrocicloSemanaEjercicio),
  // se diferencia contra lo existente por `orden` (periodos, mesociclos) y
  // por `numeroSemana` (semanas), actualizando en el sitio, insertando lo
  // nuevo y borrando solo lo que ya no tiene lugar. Las semanas cuya
  // fechaFin ya pasó, y los mesociclos que las contienen, nunca se tocan.
  await prisma.$transaction(
    async (tx) => {
      // ---------- Periodos (diff por orden) ----------
      const periodosExistentes = await tx.macrocicloPeriodo.findMany({
        where: { macrocicloId: id },
        select: { id: true, orden: true },
      });
      const periodoIdPorOrden = new Map(
        periodosExistentes.map((p) => [p.orden, p.id]),
      );

      for (const periodo of calculado.periodos) {
        const existenteId = periodoIdPorOrden.get(periodo.orden);
        if (existenteId) {
          await tx.macrocicloPeriodo.update({
            where: { id: existenteId },
            data: {
              tipo: periodo.tipo,
              porcentaje: periodo.porcentaje,
              fechaInicio: periodo.fechaInicio,
              fechaFin: periodo.fechaFin,
            },
          });
        } else {
          const creado = await tx.macrocicloPeriodo.create({
            data: {
              macrocicloId: id,
              tipo: periodo.tipo,
              porcentaje: periodo.porcentaje,
              fechaInicio: periodo.fechaInicio,
              fechaFin: periodo.fechaFin,
              orden: periodo.orden,
            },
          });
          periodoIdPorOrden.set(periodo.orden, creado.id);
        }
      }

      const ordenesPeriodosNuevos = new Set(
        calculado.periodos.map((p) => p.orden),
      );
      const periodosABorrar = periodosExistentes.filter(
        (p) => !ordenesPeriodosNuevos.has(p.orden),
      );
      if (periodosABorrar.length > 0) {
        await tx.macrocicloPeriodo.deleteMany({
          where: { id: { in: periodosABorrar.map((p) => p.id) } },
        });
      }

      // ---------- Etapas por periodo (diff por orden) ----------
      for (const periodo of calculado.periodos) {
        const periodoId = periodoIdPorOrden.get(periodo.orden);
        if (!periodoId) continue;

        const etapasExistentes = await tx.macrocicloEtapa.findMany({
          where: { periodoId },
          select: { id: true, orden: true },
        });
        const etapaIdPorOrden = new Map(
          etapasExistentes.map((e) => [e.orden, e.id]),
        );

        for (const etapa of periodo.etapas) {
          const existenteId = etapaIdPorOrden.get(etapa.orden);
          if (existenteId) {
            await tx.macrocicloEtapa.update({
              where: { id: existenteId },
              data: {
                tipo: etapa.tipo,
                porcentaje: etapa.porcentaje,
                fechaInicio: etapa.fechaInicio,
                fechaFin: etapa.fechaFin,
              },
            });
          } else {
            await tx.macrocicloEtapa.create({
              data: {
                periodoId,
                tipo: etapa.tipo,
                porcentaje: etapa.porcentaje,
                fechaInicio: etapa.fechaInicio,
                fechaFin: etapa.fechaFin,
                orden: etapa.orden,
              },
            });
          }
        }

        const ordenesEtapasNuevas = new Set(periodo.etapas.map((e) => e.orden));
        const etapasABorrar = etapasExistentes.filter(
          (e) => !ordenesEtapasNuevas.has(e.orden),
        );
        if (etapasABorrar.length > 0) {
          await tx.macrocicloEtapa.deleteMany({
            where: { id: { in: etapasABorrar.map((e) => e.id) } },
          });
        }
      }

      // ---------- Mesociclos (diff por orden — corrige D-09) ----------
      const mesociclosExistentes = await tx.macrocicloMesociclo.findMany({
        where: { macrocicloId: id },
        select: { id: true, orden: true },
      });
      const mesocicloIdPorOrden = new Map(
        mesociclosExistentes.map((m) => [m.orden, m.id]),
      );

      for (const mesociclo of calculado.mesociclos) {
        const existenteId = mesocicloIdPorOrden.get(mesociclo.orden);
        if (existenteId) {
          await tx.macrocicloMesociclo.update({
            where: { id: existenteId },
            data: {
              tipo: mesociclo.tipo,
              porcentaje: mesociclo.porcentaje,
              fechaInicio: mesociclo.fechaInicio,
              fechaFin: mesociclo.fechaFin,
            },
          });
        } else {
          const creado = await tx.macrocicloMesociclo.create({
            data: {
              macrocicloId: id,
              tipo: mesociclo.tipo,
              porcentaje: mesociclo.porcentaje,
              fechaInicio: mesociclo.fechaInicio,
              fechaFin: mesociclo.fechaFin,
              orden: mesociclo.orden,
            },
          });
          mesocicloIdPorOrden.set(mesociclo.orden, creado.id);
        }
      }

      // Un mesociclo que ya no aparece en el nuevo cálculo solo se borra si
      // ninguna de sus semanas ya pasó (protege MesocicloCarga histórico).
      const ordenesMesociclosNuevos = new Set(
        calculado.mesociclos.map((m) => m.orden),
      );
      const mesociclosCandidatosABorrar = mesociclosExistentes.filter(
        (m) => !ordenesMesociclosNuevos.has(m.orden),
      );

      let mesociclosABorrar = mesociclosCandidatosABorrar;
      if (mesociclosCandidatosABorrar.length > 0) {
        const semanasHistoricas = await tx.macrocicloSemana.findMany({
          where: {
            mesocicloId: { in: mesociclosCandidatosABorrar.map((m) => m.id) },
            fechaFin: { lt: hoy },
          },
          select: { mesocicloId: true },
        });
        const mesociclosConHistorial = new Set(
          semanasHistoricas.map((s) => s.mesocicloId),
        );
        mesociclosABorrar = mesociclosCandidatosABorrar.filter(
          (m) => !mesociclosConHistorial.has(m.id),
        );
      }
      if (mesociclosABorrar.length > 0) {
        await tx.macrocicloMesociclo.deleteMany({
          where: { id: { in: mesociclosABorrar.map((m) => m.id) } },
        });
      }

      // ---------- Semanas + ejercicios (diff por numeroSemana) ----------
      // Perf: guardarPeriodizacion corre en UNA transacción interactiva con
      // timeout fijo (ver `$transaction` más abajo). Hacer un round-trip por
      // semana y otro por cada ejercicio de cada semana escala como
      // O(semanas × ejercicios) — con un macrociclo largo (p.ej. 29-31
      // semanas, típico en objetivos "salud"/"sin_competencia") eso son 150+
      // round-trips secuenciales, suficientes para agotar el timeout de la
      // transacción a mitad de camino. Cuando eso pasa, MariaDB hace rollback
      // de lo ya insertado pero el código sigue enviando la siguiente
      // consulta, que entonces falla con un FK "fantasma" (referencia una
      // fila que existía hace un instante). Por eso se agrupan las
      // creaciones en bloque (`createMany`) en vez de una por una.
      const semanasExistentes = await tx.macrocicloSemana.findMany({
        where: { macrocicloId: id },
        select: { id: true, numeroSemana: true, fechaFin: true },
      });
      const semanaExistentePorNumero = new Map(
        semanasExistentes.map((s) => [s.numeroSemana, s]),
      );
      const semanasInputMap = new Map(semanas.map((s) => [s.numeroSemana, s]));

      const semanasAGuardar: Array<{
        numeroSemana: number;
        idExistente?: number;
        data: Prisma.MacrocicloSemanaCreateManyInput;
        ejercicios: SemanaInput["ejercicios"];
      }> = [];

      for (const semanaCalculada of calculado.semanas) {
        const existente = semanaExistentePorNumero.get(
          semanaCalculada.numeroSemana,
        );

        // Regla de no-destrucción (§4.3.5): una semana ya pasada nunca se
        // toca, sin importar qué cambió en la configuración.
        if (existente && existente.fechaFin < hoy) {
          continue;
        }

        const mesociclo = calculado.mesociclos.find(
          (m) =>
            semanaCalculada.fechaInicio >= m.fechaInicio &&
            semanaCalculada.fechaInicio <= m.fechaFin,
        );
        const mesocicloId = mesociclo
          ? mesocicloIdPorOrden.get(mesociclo.orden)
          : undefined;
        if (!mesocicloId) {
          // No debería ocurrir si los invariantes de fecha se cumplen; se
          // omite en vez de fallar la transacción completa.
          continue;
        }

        const semanaInput = semanasInputMap.get(semanaCalculada.numeroSemana);

        const tipoPropuesto = semanaCalculada.tipoMicrociclo;
        const tipoSolicitado = semanaInput?.tipoMicrociclo;
        const tipoFinal =
          tipoSolicitado && isTipoMicrociclo(tipoSolicitado)
            ? tipoSolicitado
            : tipoPropuesto;
        const esOverride = tipoFinal !== tipoPropuesto;
        const factores = esOverride
          ? factoresPorTipoMicrociclo(tipoFinal)
          : {
              esDeload: semanaCalculada.esDeload ?? false,
              factorVolumen: semanaCalculada.factorVolumen ?? 1,
              factorIntensidad: semanaCalculada.factorIntensidad ?? 1,
            };

        const data = {
          macrocicloId: id,
          mesocicloId,
          numeroSemana: semanaCalculada.numeroSemana,
          mesCalendario: semanaCalculada.mesCalendario,
          fechaInicio: semanaCalculada.fechaInicio,
          fechaFin: semanaCalculada.fechaFin,
          // ADR-38/ADR-44: el motor propone el tipo de cada semana contra el
          // calendario de competencias, pero el entrenador puede cambiarlo:
          // conoce contextos que el plan no (una lesión, un viaje, un partido
          // amistoso). Si el valor que llega difiere del calculado, se trata
          // como decisión suya y manda.
          //
          // Los factores de carga se derivan del tipo que finalmente queda:
          // una semana marcada como taper con factor de volumen 1 no sería un
          // taper, sería una etiqueta.
          tipoMicrociclo: tipoFinal,
          esDeload: factores.esDeload,
          factorVolumen: factores.factorVolumen,
          factorIntensidad: factores.factorIntensidad,
          frecuencia: semanaInput?.frecuencia ?? 0,
          series: semanaInput?.series ?? 0,
          repeticiones: semanaInput?.repeticiones ?? 0,
          volumen: semanaInput?.volumen ?? 0,
          intensidad: semanaInput?.intensidad ?? 0,
          notas: semanaInput?.notas ?? semanaCalculada.notas,
        };

        semanasAGuardar.push({
          numeroSemana: semanaCalculada.numeroSemana,
          idExistente: existente?.id,
          data,
          ejercicios: semanaInput?.ejercicios ?? [],
        });
      }

      const semanasNuevas = semanasAGuardar.filter((s) => !s.idExistente);
      const semanasParaActualizar = semanasAGuardar.filter(
        (s) => s.idExistente,
      );

      if (semanasNuevas.length > 0) {
        await tx.macrocicloSemana.createMany({
          data: semanasNuevas.map((s) => s.data),
        });
      }
      for (const s of semanasParaActualizar) {
        await tx.macrocicloSemana.update({
          where: { id: s.idExistente! },
          data: s.data,
        });
      }

      // Resolver en un solo round-trip los ids que MariaDB asignó a las
      // semanas recién creadas (createMany no los devuelve).
      const semanaIdPorNumero = new Map<number, number>(
        semanasParaActualizar.map((s) => [s.numeroSemana, s.idExistente!]),
      );
      if (semanasNuevas.length > 0) {
        const creadas = await tx.macrocicloSemana.findMany({
          where: {
            macrocicloId: id,
            numeroSemana: { in: semanasNuevas.map((s) => s.numeroSemana) },
          },
          select: { id: true, numeroSemana: true },
        });
        for (const c of creadas) {
          semanaIdPorNumero.set(c.numeroSemana, c.id);
        }
      }

      // ---------- Ejercicios de todas las semanas afectadas, en bloque ----------
      const semanaIdsAfectadas = [...semanaIdPorNumero.values()];
      const ejerciciosExistentes = semanaIdsAfectadas.length > 0
        ? await tx.macrocicloSemanaEjercicio.findMany({
            where: { macrocicloSemanaId: { in: semanaIdsAfectadas } },
          })
        : [];
      const ejercicioExistentePorClave = new Map(
        ejerciciosExistentes.map((e) => [
          `${e.macrocicloSemanaId}:${e.ejercicioId}`,
          e,
        ]),
      );

      const ejerciciosACrear: Prisma.MacrocicloSemanaEjercicioCreateManyInput[] =
        [];
      const ejerciciosAActualizar: Array<{
        id: number;
        data: {
          formulaRm: string;
          rm: number;
          peso: number;
          volumen: number;
        };
      }> = [];
      const clavesDeseadas = new Set<string>();

      for (const s of semanasAGuardar) {
        const semanaId = semanaIdPorNumero.get(s.numeroSemana);
        if (!semanaId) continue;

        // Si el input trae el mismo ejercicio repetido, el último gana
        // (mismo comportamiento que el upsert secuencial anterior).
        const ejerciciosPorId = new Map(
          s.ejercicios.map((e) => [e.ejercicioId, e]),
        );

        for (const e of ejerciciosPorId.values()) {
          const clave = `${semanaId}:${e.ejercicioId}`;
          clavesDeseadas.add(clave);
          const existenteEj = ejercicioExistentePorClave.get(clave);
          if (!existenteEj) {
            ejerciciosACrear.push({
              macrocicloSemanaId: semanaId,
              ejercicioId: e.ejercicioId,
              formulaRm: e.formulaRm,
              rm: e.rm,
              peso: e.peso,
              volumen: e.volumen,
            });
          } else if (
            existenteEj.formulaRm !== e.formulaRm ||
            existenteEj.rm !== e.rm ||
            existenteEj.peso !== e.peso ||
            existenteEj.volumen !== e.volumen
          ) {
            ejerciciosAActualizar.push({
              id: existenteEj.id,
              data: {
                formulaRm: e.formulaRm,
                rm: e.rm,
                peso: e.peso,
                volumen: e.volumen,
              },
            });
          }
        }
      }

      if (ejerciciosACrear.length > 0) {
        await tx.macrocicloSemanaEjercicio.createMany({
          data: ejerciciosACrear,
        });
      }
      for (const u of ejerciciosAActualizar) {
        await tx.macrocicloSemanaEjercicio.update({
          where: { id: u.id },
          data: u.data,
        });
      }

      const ejerciciosIdsABorrar = ejerciciosExistentes
        .filter(
          (e) => !clavesDeseadas.has(`${e.macrocicloSemanaId}:${e.ejercicioId}`),
        )
        .map((e) => e.id);
      if (ejerciciosIdsABorrar.length > 0) {
        await tx.macrocicloSemanaEjercicio.deleteMany({
          where: { id: { in: ejerciciosIdsABorrar } },
        });
      }

      // Semanas a borrar: solo futuras (las pasadas están protegidas) y que
      // ya no aparecen en el nuevo cálculo.
      const numerosSemanaNuevos = new Set(
        calculado.semanas.map((s) => s.numeroSemana),
      );
      const semanasABorrar = semanasExistentes.filter(
        (s) => !numerosSemanaNuevos.has(s.numeroSemana) && s.fechaFin >= hoy,
      );
      if (semanasABorrar.length > 0) {
        await tx.macrocicloSemana.deleteMany({
          where: { id: { in: semanasABorrar.map((s) => s.id) } },
        });
      }

      await tx.macrociclo.update({
        where: { id },
        data: { pasoActual: Math.max(pasoActual, PASO_WIZARD.carga) },
      });

      await tx.macrocicloAuditLog.create({
        data: {
          macrocicloId: id,
          personaId,
          adminId: context.adminId,
          userType: context.userType,
          action: "periodizacion_guardada",
          metadata: {
            totalSemanas: calculado.totalSemanas,
            periodos: calculado.periodos.length,
            mesociclos: calculado.mesociclos.length,
          },
        },
      });
    },
    // 60s de margen (antes 20s): aun con las creaciones en bloque, un
    // macrociclo muy largo (30+ semanas) o una conexión lenta a la base no
    // deberían agotar el timeout de la transacción interactiva.
    { timeout: 60000, maxWait: 15000 },
  );

  return calculado;
}

export async function activarMacrociclo({
  id,
  personaId,
  context,
}: {
  id: number;
  personaId: number;
  context: AuditContext;
}) {
  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId },
    include: { semanas: true },
  });

  if (!macrociclo) {
    throw new Error("Macrociclo no encontrado.");
  }

  if (macrociclo.estado !== "borrador") {
    throw new Error("El macrociclo no está en estado borrador.");
  }

  if (!macrociclo.sesionRmId) {
    throw new Error("Debes asociar una sesión RM antes de activar.");
  }

  if (macrociclo.semanas.length === 0) {
    throw new Error("Debes configurar la periodización antes de activar.");
  }

  const actualizado = await prisma.macrociclo.update({
    where: { id },
    data: { estado: "activo" },
  });

  // ADR-50: activar ya no depende de "generar plan" — las sesiones son
  // simples huecos para el WOD, uno por cada sesión de la `frecuencia` que
  // el entrenador ya definió al guardar la periodización.
  await crearSesionesPlanificadas(id, personaId);

  await auditarMacrociclo({
    macrocicloId: id,
    personaId,
    action: "macrociclo_activado",
    context,
  });

  return actualizado;
}

/**
 * ADR-50 · Crea las `SesionPlanificada` que falten a partir de la
 * `frecuencia` ya guardada en cada `MacrocicloSemana` — sin periodización
 * ni prescripción por ejercicio (eso lo decide el entrenador al escribir el
 * WOD, ADR-49). Idempotente: no duplica sesiones ya creadas.
 */
export async function crearSesionesPlanificadas(macrocicloId: number, personaId: number) {
  const [semanas, persona] = await Promise.all([
    prisma.macrocicloSemana.findMany({
      where: { macrocicloId },
      select: { id: true, frecuencia: true },
      orderBy: { numeroSemana: "asc" },
    }),
    prisma.persona.findUnique({ where: { id: personaId }, select: { minutosPorSesion: true } }),
  ]);

  const duracionEstimadaMin = persona?.minutosPorSesion ?? 60;

  for (const semana of semanas) {
    const existentes = await prisma.sesionPlanificada.count({ where: { semanaId: semana.id } });
    const faltantes = Math.max(0, semana.frecuencia - existentes);

    for (let i = 0; i < faltantes; i++) {
      await prisma.sesionPlanificada.create({
        data: { semanaId: semana.id, orden: existentes + i + 1, duracionEstimadaMin },
      });
    }
  }
}

export async function obtenerMacrocicloPorId(id: number) {
  return prisma.macrociclo.findUnique({
    where: { id },
    include: {
      persona: true,
      sesionRm: {
        include: {
          resultados: {
            include: {
              ejercicio: { select: { nombre: true } },
            },
          },
        },
      },
      competencias: { orderBy: { fecha: "asc" } },
      periodos: {
        orderBy: { orden: "asc" },
        include: {
          etapas: { orderBy: { orden: "asc" } },
        },
      },
      mesociclos: {
        orderBy: { orden: "asc" },
        include: {
          semanas: { orderBy: { numeroSemana: "asc" } },
        },
      },
      semanas: {
        orderBy: { numeroSemana: "asc" },
        include: {
          ejercicios: {
            include: {
              ejercicio: { select: { id: true, nombre: true } },
            },
          },
        },
      },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function obtenerMacrociclosPorPersona(personaId: number) {
  return prisma.macrociclo.findMany({
    where: { personaId },
    orderBy: { createdAt: "desc" },
    include: {
      semanas: { orderBy: { numeroSemana: "asc" } },
      mesociclos: { orderBy: { orden: "asc" } },
    },
  });
}

export async function obtenerMacrocicloAbierto(personaId: number) {
  await cerrarMacrocicloLazy(personaId);

  return prisma.macrociclo.findFirst({
    where: {
      personaId,
      estado: { in: ["borrador", "activo"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      semanas: { orderBy: { numeroSemana: "asc" } },
      mesociclos: { orderBy: { orden: "asc" } },
    },
  });
}

export async function obtenerMacrociclosAdmin({
  estado,
  personaId,
}: {
  estado?: EstadoMacrociclo;
  personaId?: number;
} = {}) {
  return prisma.macrociclo.findMany({
    where: {
      ...(estado ? { estado } : {}),
      ...(personaId ? { personaId } : {}),
    } as Prisma.MacrocicloWhereInput,
    orderBy: { createdAt: "desc" },
    include: {
      persona: { select: { id: true, nombre: true, cc: true } },
      semanas: { orderBy: { numeroSemana: "asc" } },
      mesociclos: { orderBy: { orden: "asc" } },
    },
  });
}

export async function obtenerCargaMesociclo(mesocicloId: number) {
  return prisma.mesocicloCarga.findUnique({
    where: { mesocicloId },
  });
}

/** ADR-47 · Reemplaza a `guardarCargaMesociclo` (minutos × direcciones, retirado). */
export async function guardarObjetivoBloqueMesociclo({
  macrocicloId,
  personaId,
  mesocicloId,
  data,
  context,
}: {
  macrocicloId: number;
  personaId: number;
  mesocicloId: number;
  data: unknown;
  context: AuditContext;
}) {
  const mesociclo = await prisma.macrocicloMesociclo.findFirst({
    where: { id: mesocicloId, macrocicloId, macrociclo: { personaId } },
  });

  if (!mesociclo) {
    throw new Error("Mesociclo no encontrado.");
  }

  const validado = validarObjetivoBloque(data);
  if (!validado.ok) {
    throw new Error(validado.error);
  }

  const actualizado = await prisma.macrocicloMesociclo.update({
    where: { id: mesocicloId },
    data: {
      objetivoBloque: validado.data.objetivoBloque,
      intensidadMinPct: validado.data.intensidadMinPct,
      intensidadMaxPct: validado.data.intensidadMaxPct,
      repsMin: validado.data.repsMin,
      repsMax: validado.data.repsMax,
      rirObjetivo: validado.data.rirObjetivo,
      progresion: validado.data.progresion,
      seriesSemanalesPorPatron: validado.data
        .seriesSemanalesPorPatron as Prisma.InputJsonValue,
    },
  });

  await auditarMacrociclo({
    macrocicloId,
    personaId,
    action: "objetivo_bloque_mesociclo_guardado",
    metadata: { mesocicloId },
    before: undefined,
    after: validado.data as unknown as Record<string, unknown>,
    context,
  });

  return actualizado;
}

/**
 * "Sesión de hoy": la próxima `SesionPlanificada` aún no registrada,
 * ordenada por semana/orden. Antes había que abrir el detalle del
 * macrociclo y buscarla a mano entre hasta 20 sesiones ya mezcladas con las
 * ya hechas — esto es lo que se muestra destacado arriba de esa lista y en
 * el dashboard.
 */
export async function obtenerProximaSesionPlanificada(macrocicloId: number) {
  return prisma.sesionPlanificada.findFirst({
    // Incluye "parcial": abrir la pantalla de registro ya la marca parcial
    // (RegistroSesion crea la SesionRealizada al montar), aunque el
    // entrenador no haya llegado a escribir el WOD ni completarla. Filtrar
    // solo por "planificada" hacía que la sesión desapareciera de esta
    // tarjeta apenas se abría una vez — justo cuando más falta hacía
    // encontrarla de nuevo.
    where: { semana: { macrocicloId }, estado: { in: ["planificada", "parcial"] } },
    orderBy: [{ semana: { numeroSemana: "asc" } }, { orden: "asc" }],
    select: {
      id: true,
      orden: true,
      wod: true,
      estado: true,
      semana: { select: { numeroSemana: true, fechaInicio: true } },
    },
  });
}

export type ResumenMacrociclo = {
  rango: { desde: Date; hasta: Date };
  rm: Array<{
    ejercicioId: number;
    ejercicioNombre: string;
    inicioKg: number | null;
    actualKg: number | null;
    deltaPct: number | null;
  }>;
  adherencia: {
    total: number;
    realizadas: number;
    parciales: number;
    omitidas: number;
    pendientes: number;
    debidas: number;
    porcentajeAdherencia: number | null;
  };
};

/**
 * M9 (mínimo viable) · Resumen del macrociclo: qué pasó con la fuerza y la
 * adherencia desde que se armó el plan. No existía ninguna vista de esto —
 * cerrar un macrociclo era solo cambiar un estado, sin ningún dato que
 * justifique cómo armar el siguiente bloque.
 *
 * El RM "al inicio" se lee de `RmVigente` vigente en `fechaInicio` (no del
 * `rmSnapshot` JSON legado): es la fuente que el propio proyecto documenta
 * como autoritativa (ADR de RmVigente), y permite reconstruir el valor
 * histórico exacto gracias a que es append-only.
 *
 * ADR-51: "tonelaje registrado" y "ajustes propuestos" se retiraron de este
 * resumen — dependían de `SerieRealizada` con `ejercicioId`/`rir`, que el
 * registro de sesión ya no genera por defecto desde ADR-50 (el WOD es
 * texto libre). Mostrar esos dos en 0 siempre era más confuso que útil.
 */
export async function obtenerResumenMacrociclo(
  macrocicloId: number,
): Promise<ResumenMacrociclo> {
  const macrociclo = await prisma.macrociclo.findUniqueOrThrow({
    where: { id: macrocicloId },
    select: { id: true, personaId: true, fechaInicio: true, fechaFin: true },
  });

  const [rmInicio, rmActual, sesiones] = await Promise.all([
    prisma.rmVigente.findMany({
      where: {
        personaId: macrociclo.personaId,
        validoDesde: { lte: macrociclo.fechaInicio },
        OR: [{ validoHasta: null }, { validoHasta: { gt: macrociclo.fechaInicio } }],
      },
      select: { ejercicioId: true, valorKg: true, ejercicio: { select: { nombre: true } } },
    }),
    prisma.rmVigente.findMany({
      where: { personaId: macrociclo.personaId, validoHasta: null },
      select: { ejercicioId: true, valorKg: true, ejercicio: { select: { nombre: true } } },
    }),
    prisma.sesionPlanificada.findMany({
      where: { semana: { macrocicloId } },
      select: { estado: true, semana: { select: { fechaInicio: true } } },
    }),
  ]);

  const inicioPorEjercicio = new Map(rmInicio.map((r) => [r.ejercicioId, r]));
  const actualPorEjercicio = new Map(rmActual.map((r) => [r.ejercicioId, r]));
  const ejercicioIds = new Set([...inicioPorEjercicio.keys(), ...actualPorEjercicio.keys()]);

  const rm = [...ejercicioIds]
    .map((ejercicioId) => {
      const inicio = inicioPorEjercicio.get(ejercicioId) ?? null;
      const actual = actualPorEjercicio.get(ejercicioId) ?? null;
      const deltaPct =
        inicio && actual && inicio.valorKg > 0
          ? ((actual.valorKg - inicio.valorKg) / inicio.valorKg) * 100
          : null;
      return {
        ejercicioId,
        ejercicioNombre:
          actual?.ejercicio.nombre ?? inicio?.ejercicio.nombre ?? `Ejercicio ${ejercicioId}`,
        inicioKg: inicio?.valorKg ?? null,
        actualKg: actual?.valorKg ?? null,
        deltaPct,
      };
    })
    .sort((a, b) => a.ejercicioNombre.localeCompare(b.ejercicioNombre));

  const hoy = new Date();
  let realizadas = 0;
  let parciales = 0;
  let omitidas = 0;
  let pendientes = 0;
  let debidas = 0;
  for (const s of sesiones) {
    if (s.estado === "realizada") realizadas++;
    else if (s.estado === "parcial") parciales++;
    else if (s.estado === "omitida") omitidas++;
    else pendientes++;
    if (s.semana.fechaInicio <= hoy) debidas++;
  }

  return {
    rango: { desde: macrociclo.fechaInicio, hasta: macrociclo.fechaFin },
    rm,
    adherencia: {
      total: sesiones.length,
      realizadas,
      parciales,
      omitidas,
      pendientes,
      debidas,
      porcentajeAdherencia: debidas > 0 ? (realizadas / debidas) * 100 : null,
    },
  };
}

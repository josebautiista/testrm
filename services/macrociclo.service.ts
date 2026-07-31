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
import { calcularPeriodizacion } from "@/lib/macrociclo-periodizacion";

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

export async function cerrarMacrocicloLazy(personaId: number) {
  const ahora = new Date();
  const umbral = new Date(ahora);
  umbral.setDate(umbral.getDate() - 1);

  const vencidos = await prisma.macrociclo.findMany({
    where: {
      personaId,
      estado: "activo",
      objetivoTipo: "competencia",
      fechaCompetencia: { lt: umbral },
    },
  });

  for (const macrociclo of vencidos) {
    await prisma.macrociclo.update({
      where: { id: macrociclo.id },
      data: {
        estado: "cerrado",
        closedAt: new Date(),
        closedReason: "auto_competencia",
      },
    });

    await prisma.macrocicloAuditLog.create({
      data: {
        macrocicloId: macrociclo.id,
        personaId,
        userType: "persona",
        action: "macrociclo_cerrado_auto",
        metadata: { reason: "auto_competencia" },
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
  fechaCompetencia,
  pasoActual,
  context,
}: {
  id: number;
  personaId: number;
  objetivoTipo: string;
  objetivoDetalle?: string;
  fechaInicio: Date;
  fechaFin: Date;
  fechaCompetencia?: Date;
  pasoActual: number;
  context: AuditContext;
}) {
  const actualizado = await prisma.macrociclo.update({
    where: { id, personaId },
    data: {
      objetivoTipo,
      objetivoDetalle,
      fechaInicio,
      fechaFin,
      fechaCompetencia,
      pasoActual: Math.max(pasoActual, 2),
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
        pasoActual: Math.max(pasoActual, 4),
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
  rmSnapshot,
  pasoActual,
  context,
}: {
  id: number;
  personaId: number;
  sesionRmId: number;
  rmSnapshot: Record<string, unknown>;
  pasoActual: number;
  context: AuditContext;
}) {
  const actualizado = await prisma.macrociclo.update({
    where: { id, personaId },
    data: {
      sesionRmId,
      rmSnapshot: rmSnapshot as Prisma.InputJsonValue,
      pasoActual: Math.max(pasoActual, 5),
    },
  });

  await auditarMacrociclo({
    macrocicloId: id,
    personaId,
    action: "rm_asociado",
    metadata: { sesionRmId },
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
      pasoActual: Math.max(pasoActual, 6),
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

export async function guardarPeriodizacion({
  id,
  personaId,
  periodos,
  etapasPorPeriodo,
  mesociclos,
  semanas,
  pasoActual,
  context,
}: {
  id: number;
  personaId: number;
  periodos: PeriodoInput[];
  etapasPorPeriodo: Record<TipoPeriodo, { tipo: TipoEtapa; porcentaje: number }[]>;
  mesociclos: MesocicloInput[];
  semanas: SemanaInput[];
  pasoActual: number;
  context: AuditContext;
}) {
  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id, personaId },
    select: { fechaInicio: true, fechaFin: true },
  });

  if (!macrociclo) {
    throw new Error("Macrociclo no encontrado.");
  }

  const calculado = calcularPeriodizacion({
    fechaInicio: macrociclo.fechaInicio,
    fechaFin: macrociclo.fechaFin,
    periodos,
    etapasPorPeriodo,
    mesociclos,
  });

  await prisma.$transaction(async (tx) => {
    await tx.macrocicloPeriodo.deleteMany({ where: { macrocicloId: id } });
    await tx.macrocicloMesociclo.deleteMany({ where: { macrocicloId: id } });
    await tx.macrocicloSemana.deleteMany({ where: { macrocicloId: id } });

    const periodosCreados: Record<string, number> = {};
    for (const periodo of calculado.periodos) {
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
      periodosCreados[periodo.tipo] = creado.id;

      for (const etapa of periodo.etapas) {
        await tx.macrocicloEtapa.create({
          data: {
            periodoId: creado.id,
            tipo: etapa.tipo,
            porcentaje: etapa.porcentaje,
            fechaInicio: etapa.fechaInicio,
            fechaFin: etapa.fechaFin,
            orden: etapa.orden,
          },
        });
      }
    }

    const mesociclosCreados: Record<string, number> = {};
    for (const mesociclo of calculado.mesociclos) {
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
      mesociclosCreados[mesociclo.tipo] = creado.id;
    }

    const semanasMap = new Map(semanas.map((s) => [s.numeroSemana, s]));

    for (const semanaCalculada of calculado.semanas) {
      const semanaInput = semanasMap.get(semanaCalculada.numeroSemana);
      const mesocicloId = Object.entries(mesociclosCreados).find(([tipo]) => {
        const mesociclo = calculado.mesociclos.find((m) => m.tipo === tipo);
        if (!mesociclo) return false;
        return (
          semanaCalculada.fechaInicio >= mesociclo.fechaInicio &&
          semanaCalculada.fechaInicio <= mesociclo.fechaFin
        );
      })?.[1];

      if (!mesocicloId) continue;

      await tx.macrocicloSemana.create({
        data: {
          macrocicloId: id,
          mesocicloId,
          numeroSemana: semanaCalculada.numeroSemana,
          mesCalendario: semanaCalculada.mesCalendario,
          fechaInicio: semanaCalculada.fechaInicio,
          fechaFin: semanaCalculada.fechaFin,
          tipoMicrociclo: semanaInput?.tipoMicrociclo ?? "corriente",
          frecuencia: semanaInput?.frecuencia ?? 0,
          volumen: semanaInput?.volumen ?? 0,
          intensidad: semanaInput?.intensidad ?? 0,
          notas: semanaInput?.notas,
        },
      });
    }

    await tx.macrociclo.update({
      where: { id },
      data: { pasoActual: Math.max(pasoActual, 10) },
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
  });

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

  await auditarMacrociclo({
    macrocicloId: id,
    personaId,
    action: "macrociclo_activado",
    context,
  });

  return actualizado;
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
      periodos: {
        orderBy: { orden: "asc" },
        include: {
          etapas: { orderBy: { orden: "asc" } },
        },
      },
      mesociclos: { orderBy: { orden: "asc" } },
      semanas: { orderBy: { numeroSemana: "asc" } },
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

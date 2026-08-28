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
import {
  type CargaMesocicloInputData,
  validarCargaMesociclo,
} from "@/lib/mesociclo-carga";

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
        pasoActual: Math.max(pasoActual, 3),
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
      pasoActual: Math.max(pasoActual, 3),
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
      pasoActual: Math.max(pasoActual, 4),
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

  // F-08/D-10: calcularPeriodizacion nunca lanza; si la distribución de
  // semanas no es posible (menos semanas que bloques activos), lo reporta
  // aquí como un error explícito antes de tocar la base de datos (E-06).
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
      const semanasExistentes = await tx.macrocicloSemana.findMany({
        where: { macrocicloId: id },
        select: { id: true, numeroSemana: true, fechaFin: true },
      });
      const semanaExistentePorNumero = new Map(
        semanasExistentes.map((s) => [s.numeroSemana, s]),
      );
      const semanasInputMap = new Map(semanas.map((s) => [s.numeroSemana, s]));

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
        const data = {
          macrocicloId: id,
          mesocicloId,
          numeroSemana: semanaCalculada.numeroSemana,
          mesCalendario: semanaCalculada.mesCalendario,
          fechaInicio: semanaCalculada.fechaInicio,
          fechaFin: semanaCalculada.fechaFin,
          tipoMicrociclo: semanaInput?.tipoMicrociclo ?? "corriente",
          frecuencia: semanaInput?.frecuencia ?? 0,
          series: semanaInput?.series ?? 0,
          repeticiones: semanaInput?.repeticiones ?? 0,
          volumen: semanaInput?.volumen ?? 0,
          intensidad: semanaInput?.intensidad ?? 0,
          notas: semanaInput?.notas,
        };

        let semanaId: number;
        if (existente) {
          await tx.macrocicloSemana.update({ where: { id: existente.id }, data });
          semanaId = existente.id;
        } else {
          const creada = await tx.macrocicloSemana.create({ data });
          semanaId = creada.id;
        }

        const ejerciciosInput = semanaInput?.ejercicios ?? [];
        const ejercicioIdsNuevos = ejerciciosInput.map((e) => e.ejercicioId);

        for (const e of ejerciciosInput) {
          await tx.macrocicloSemanaEjercicio.upsert({
            where: {
              macrocicloSemanaId_ejercicioId: {
                macrocicloSemanaId: semanaId,
                ejercicioId: e.ejercicioId,
              },
            },
            create: {
              macrocicloSemanaId: semanaId,
              ejercicioId: e.ejercicioId,
              formulaRm: e.formulaRm,
              rm: e.rm,
              peso: e.peso,
              volumen: e.volumen,
            },
            update: {
              formulaRm: e.formulaRm,
              rm: e.rm,
              peso: e.peso,
              volumen: e.volumen,
            },
          });
        }

        if (existente) {
          await tx.macrocicloSemanaEjercicio.deleteMany({
            where: {
              macrocicloSemanaId: semanaId,
              ejercicioId: { notIn: ejercicioIdsNuevos },
            },
          });
        }
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
        data: { pasoActual: Math.max(pasoActual, 8) },
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
    { timeout: 20000, maxWait: 10000 },
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
      mesociclos: {
        orderBy: { orden: "asc" },
        include: {
          semanas: { orderBy: { numeroSemana: "asc" } },
          carga: true,
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

export async function guardarCargaMesociclo({
  macrocicloId,
  personaId,
  mesocicloId,
  data,
  context,
}: {
  macrocicloId: number;
  personaId: number;
  mesocicloId: number;
  data: CargaMesocicloInputData;
  context: AuditContext;
}) {
  const mesociclo = await prisma.macrocicloMesociclo.findFirst({
    where: { id: mesocicloId, macrocicloId, macrociclo: { personaId } },
    include: {
      macrociclo: { select: { id: true, personaId: true } },
      semanas: true,
    },
  });

  if (!mesociclo) {
    throw new Error("Mesociclo no encontrado.");
  }

  const semanas = mesociclo.semanas.map((s) => ({
    numeroSemana: s.numeroSemana,
    frecuencia: s.frecuencia,
  }));

  const validado = validarCargaMesociclo(data, semanas);
  if (!validado.ok) {
    throw new Error(validado.error);
  }

  const actualizado = await prisma.mesocicloCarga.upsert({
    where: { mesocicloId },
    create: {
      mesocicloId,
      tiempoSesionMin: validado.data.tiempoSesionMin,
      direcciones: validado.data.direcciones as Prisma.InputJsonValue,
      volumen: validado.data.volumen as Prisma.InputJsonValue,
      microciclos: validado.data.microciclos as Prisma.InputJsonValue,
      sesiones: validado.data.sesiones as Prisma.InputJsonValue,
    },
    update: {
      tiempoSesionMin: validado.data.tiempoSesionMin,
      direcciones: validado.data.direcciones as Prisma.InputJsonValue,
      volumen: validado.data.volumen as Prisma.InputJsonValue,
      microciclos: validado.data.microciclos as Prisma.InputJsonValue,
      sesiones: validado.data.sesiones as Prisma.InputJsonValue,
    },
  });

  await auditarMacrociclo({
    macrocicloId,
    personaId,
    action: "carga_mesociclo_guardada",
    metadata: { mesocicloId },
    before: undefined,
    after: validado.data as Record<string, unknown>,
    context,
  });

  return actualizado;
}

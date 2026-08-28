import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  seleccionarRmVigenteEnFecha,
  type ConfianzaRmVigente,
  type OrigenRmVigente,
  type RmVigenteRow,
} from "@/lib/rm/vigente";

type TransactionClient = Prisma.TransactionClient;

export type ActualizarRmVigenteInput = {
  personaId: number;
  ejercicioId: number;
  valorKg: number;
  origen: OrigenRmVigente;
  confianza: ConfianzaRmVigente;
  resultadoRmId?: number | null;
  fecha?: Date;
};

/**
 * TASK-022 · M4: cierra la fila `RmVigente` abierta de (persona, ejercicio)
 * si existe, y abre una nueva. Debe llamarse siempre dentro de una
 * transacción para que "cerrar la anterior" y "abrir la nueva" sean
 * atómicos (invariante de §3.5: una sola fila abierta por par).
 *
 * Se usa incondicionalmente desde una evaluación (test de RM): un nuevo
 * resultado medido siempre pasa a ser el vigente. Para RM derivado de
 * entrenamiento (e1RM) se debe llamar sólo cuando supera al vigente — ver
 * `actualizarRmVigenteSiSupera`.
 */
export async function actualizarRmVigente(
  tx: TransactionClient,
  input: ActualizarRmVigenteInput,
) {
  if (!Number.isFinite(input.valorKg) || input.valorKg <= 0) {
    return null;
  }

  const fecha = input.fecha ?? new Date();

  const abierto = await tx.rmVigente.findFirst({
    where: {
      personaId: input.personaId,
      ejercicioId: input.ejercicioId,
      validoHasta: null,
    },
    orderBy: { validoDesde: "desc" },
  });

  if (abierto) {
    await tx.rmVigente.update({
      where: { id: abierto.id },
      data: { validoHasta: fecha },
    });
  }

  return tx.rmVigente.create({
    data: {
      personaId: input.personaId,
      ejercicioId: input.ejercicioId,
      valorKg: input.valorKg,
      origen: input.origen,
      confianza: input.confianza,
      resultadoRmId: input.resultadoRmId ?? null,
      validoDesde: fecha,
    },
  });
}

/**
 * F-03/origen "e1rm_entrenamiento": una serie de entrenamiento solo
 * reemplaza el RM vigente si lo supera (a diferencia de una evaluación, que
 * siempre reemplaza). Ver §16.2: "RmVigente actualizado solo si supera al
 * vigente".
 */
export async function actualizarRmVigenteSiSupera(
  tx: TransactionClient,
  input: ActualizarRmVigenteInput,
) {
  if (!Number.isFinite(input.valorKg) || input.valorKg <= 0) {
    return null;
  }

  const vigente = await obtenerRmVigenteTx(tx, input.personaId, input.ejercicioId);
  if (vigente && vigente.valorKg >= input.valorKg) {
    return null;
  }

  return actualizarRmVigente(tx, input);
}

async function obtenerRmVigenteTx(
  tx: TransactionClient,
  personaId: number,
  ejercicioId: number,
) {
  return tx.rmVigente.findFirst({
    where: { personaId, ejercicioId, validoHasta: null },
    orderBy: { validoDesde: "desc" },
  });
}

/** Lee el RM vigente actual (fuera de transacción) para un ejercicio. */
export async function obtenerRmVigente(personaId: number, ejercicioId: number) {
  return prisma.rmVigente.findFirst({
    where: { personaId, ejercicioId, validoHasta: null },
    orderBy: { validoDesde: "desc" },
  });
}

/** Todos los RM vigentes de un atleta, uno por ejercicio, con el ejercicio incluido. */
export async function listarRmVigentesPorPersona(personaId: number) {
  return prisma.rmVigente.findMany({
    where: { personaId, validoHasta: null },
    include: { ejercicio: true },
    orderBy: { ejercicioId: "asc" },
  });
}

/**
 * AC-03: reconstruye el RM vigente de un ejercicio en cualquier fecha
 * pasada a partir del historial completo (abiertas y cerradas).
 */
export async function resolverRmVigenteHistorico(
  personaId: number,
  ejercicioId: number,
  fecha: Date,
) {
  const historico = await prisma.rmVigente.findMany({
    where: { personaId, ejercicioId },
    orderBy: { validoDesde: "asc" },
  });

  return seleccionarRmVigenteEnFecha(historico as RmVigenteRow[], fecha);
}

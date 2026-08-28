// ADR-36 · La fase de entrenamiento se deriva del mesociclo activo.
//
// Contexto (D-14): `Persona.faseEntrenamiento` era un cuarto sistema de
// progresión paralelo al macrociclo. Al retirar su mecanismo de avance
// (TASK-051) quedó solo la escritura inicial —`"resistencia"` fijo al guardar
// la primera sesión— y el lector en la interfaz, así que "Tu fase actual es:
// Resistencia" era constante para todo atleta, para siempre, incluso con un
// macrociclo de fuerza máxima en curso.
//
// Este módulo es dominio puro (sin Prisma): resuelve en qué bloque del plan
// está el atleta hoy y qué orientación de entrenamiento implica.

import type { TipoMesociclo } from "@/lib/macrociclo";
import { OBJETIVO_BLOQUE_POR_MESOCICLO } from "@/lib/planificacion/plantillas";
import type { ObjetivoBloque } from "@/lib/config/parametros";
import type { TrainingFase } from "@/lib/training";

/**
 * Los siete objetivos de bloque del motor de planificación se agrupan en las
 * tres orientaciones que entiende la interfaz de recomendaciones.
 *
 * `recuperacion` cae en "resistencia" porque comparte su zona de intensidad
 * (50–65 % 1RM, ZONAS_INTENSIDAD en lib/config/parametros.ts): un bloque de
 * descarga no se entrena como uno de fuerza máxima.
 */
export const FASE_POR_OBJETIVO_BLOQUE: Record<ObjetivoBloque, TrainingFase> = {
  fuerza_maxima: "fuerza",
  realizacion: "fuerza",
  potencia: "fuerza",
  hipertrofia: "hipertrofia",
  acumulacion: "hipertrofia",
  resistencia_fuerza: "resistencia",
  recuperacion: "resistencia",
};

export type MesocicloParaFase = {
  id: number;
  tipo: string;
  /** Puede faltar en macrociclos creados con el wizard manual (columna nullable). */
  objetivoBloque: string | null;
  fechaInicio: Date;
  fechaFin: Date;
  orden: number;
};

export type FaseActiva = {
  fase: TrainingFase;
  objetivoBloque: ObjetivoBloque;
  mesocicloId: number;
  tipoMesociclo: string;
  fechaInicio: Date;
  fechaFin: Date;
  /** Posición del mesociclo dentro del macrociclo (1-indexado) y total. */
  posicion: number;
  total: number;
  /** Días que faltan para que termine el bloque. 0 si termina hoy. */
  diasRestantes: number;
};

function esObjetivoBloque(valor: unknown): valor is ObjetivoBloque {
  return (
    typeof valor === "string" &&
    Object.prototype.hasOwnProperty.call(FASE_POR_OBJETIVO_BLOQUE, valor)
  );
}

function esTipoMesociclo(valor: unknown): valor is TipoMesociclo {
  return (
    typeof valor === "string" &&
    Object.prototype.hasOwnProperty.call(OBJETIVO_BLOQUE_POR_MESOCICLO, valor)
  );
}

/**
 * El objetivo del bloque viene de la columna cuando existe; si no (macrociclos
 * anteriores a C-06/TASK-033, creados con el wizard manual), se deriva del
 * tipo de mesociclo con la misma tabla que usa el motor de planificación —
 * para no introducir un segundo criterio.
 */
export function resolverObjetivoBloque(
  mesociclo: Pick<MesocicloParaFase, "tipo" | "objetivoBloque">,
): ObjetivoBloque | null {
  if (esObjetivoBloque(mesociclo.objetivoBloque)) {
    return mesociclo.objetivoBloque;
  }

  if (esTipoMesociclo(mesociclo.tipo)) {
    return OBJETIVO_BLOQUE_POR_MESOCICLO[mesociclo.tipo];
  }

  return null;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Las fronteras de un mesociclo son columnas `@db.Date`: Prisma las devuelve
 * como `Date` a medianoche **UTC**, y representan un día de calendario, no un
 * instante. Leerlas con componentes locales adelanta un día entero en
 * cualquier zona con desplazamiento negativo (Colombia es UTC-5), con lo que
 * el bloque cambiaría un día antes de tiempo.
 */
function diaDeFechaPlana(fecha: Date): number {
  return Date.UTC(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth(),
    fecha.getUTCDate(),
  );
}

/**
 * "Hoy", en cambio, sí es un instante real: el día que le corresponde es el
 * del calendario **local** del atleta. Ambas funciones devuelven el mismo
 * tipo de valor (medianoche UTC del día de calendario) para poder compararse
 * y restarse entre sí.
 */
function diaDeInstante(fecha: Date): number {
  return Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/**
 * Devuelve el mesociclo cuyo rango de fechas contiene `fecha` y la
 * orientación de entrenamiento que implica.
 *
 * Devuelve `null` cuando no hay ningún bloque vigente hoy — antes de que
 * empiece el macrociclo, después de que termine, o si el atleta no tiene
 * ninguno abierto. Ese `null` es información: significa "no hay plan activo",
 * y la interfaz debe decirlo en vez de inventar una fase.
 */
export function resolverFaseActiva(
  mesociclos: MesocicloParaFase[],
  fecha: Date = new Date(),
): FaseActiva | null {
  if (!Array.isArray(mesociclos) || mesociclos.length === 0) {
    return null;
  }

  const hoy = diaDeInstante(fecha);
  const ordenados = [...mesociclos].sort((a, b) => a.orden - b.orden);

  const indice = ordenados.findIndex(
    (mesociclo) =>
      diaDeFechaPlana(mesociclo.fechaInicio) <= hoy &&
      diaDeFechaPlana(mesociclo.fechaFin) >= hoy,
  );

  if (indice === -1) {
    return null;
  }

  const mesociclo = ordenados[indice];
  const objetivoBloque = resolverObjetivoBloque(mesociclo);

  if (!objetivoBloque) {
    return null;
  }

  return {
    fase: FASE_POR_OBJETIVO_BLOQUE[objetivoBloque],
    objetivoBloque,
    mesocicloId: mesociclo.id,
    tipoMesociclo: mesociclo.tipo,
    fechaInicio: mesociclo.fechaInicio,
    fechaFin: mesociclo.fechaFin,
    posicion: indice + 1,
    total: ordenados.length,
    diasRestantes: Math.max(
      0,
      Math.round((diaDeFechaPlana(mesociclo.fechaFin) - hoy) / MS_POR_DIA),
    ),
  };
}

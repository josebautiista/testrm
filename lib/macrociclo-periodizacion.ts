// ADR-37 · Asignación de fechas a la estructura del macrociclo.
//
// Modelo anterior: periodos y mesociclos eran **dos distribuciones
// porcentuales independientes** sobre la misma línea de tiempo. Nada
// garantizaba que el bloque "estabilizador" cayera dentro de la etapa
// "específica" a la que pertenece conceptualmente, y el entrenador tenía que
// cuadrar a mano dos conjuntos de porcentajes que debían sumar 100 cada uno.
//
// Modelo actual: `lib/planificacion/perfil.ts construirEstructura` produce la
// secuencia de bloques con sus semanas exactas, y los periodos y etapas se
// **derivan** agrupando bloques consecutivos. Aquí solo se traducen esas
// semanas a fechas. Alinean por construcción y desaparece toda una clase de
// errores de cuadre.

import {
  type EtapaCalculada,
  type MesocicloCalculado,
  type PeriodoCalculado,
  type SemanaCalculada,
  diasEntre,
} from "./macrociclo";
import type { EstructuraPlan } from "./planificacion/perfil";
import {
  resolverMicrociclos,
  type CompetenciaPlan,
  type ModoCalendario,
} from "./planificacion/taper";

export type PeriodizacionInput = {
  fechaInicio: Date;
  fechaFin: Date;
  estructura: EstructuraPlan;
  /** Competencias del calendario, para colocar taper y semanas competitivas. */
  competencias?: CompetenciaPlan[];
  /** ADR-39 · Cómo tratar esas fechas: competencias o hitos de un plan de salud. */
  modoCalendario?: ModoCalendario;
  /** Cada cuántas semanas cae una descarga programada. */
  frecuenciaDeload?: number;
};

export type PeriodizacionOutput = {
  fechaInicio: Date;
  fechaFin: Date;
  totalSemanas: number;
  periodos: PeriodoCalculado[];
  mesociclos: MesocicloCalculado[];
  semanas: SemanaCalculada[];
  /** Decisiones tomadas que el entrenador debe conocer (bloques omitidos, etc.). */
  avisos: string[];
  errores: string[];
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function generarSemanasRango(
  fechaInicio: Date,
  fechaFin: Date,
): Array<{
  numeroSemana: number;
  fechaInicio: Date;
  fechaFin: Date;
  mesCalendario: number;
}> {
  const inicio = startOfDay(fechaInicio);
  const fin = startOfDay(fechaFin);
  const semanas: Array<{
    numeroSemana: number;
    fechaInicio: Date;
    fechaFin: Date;
    mesCalendario: number;
  }> = [];

  let current = new Date(inicio);
  let numero = 1;

  while (diasEntre(current, fin) >= 0) {
    const semanaFin = addDays(current, Math.min(6, diasEntre(current, fin)));
    semanas.push({
      numeroSemana: numero,
      fechaInicio: new Date(current),
      fechaFin: new Date(semanaFin),
      mesCalendario: current.getMonth() + 1,
    });
    current = addDays(semanaFin, 1);
    numero++;
  }

  return semanas;
}

/**
 * Reparte una lista de bloques con `semanas` conocidas sobre las semanas
 * calendario ya generadas. Cada bloque toma tantas semanas consecutivas como
 * le corresponden; el último hereda cualquier resto para que la última fecha
 * coincida exactamente con `fechaFin` (R-16 invariante #2: el plan no puede
 * desbordar su propio rango).
 */
function asignarRangos<T extends { semanas: number }>(
  bloques: T[],
  semanasCalendario: Array<{ fechaInicio: Date; fechaFin: Date }>,
): Array<T & { fechaInicio: Date; fechaFin: Date; indiceInicio: number; indiceFin: number }> {
  const resultado: Array<
    T & { fechaInicio: Date; fechaFin: Date; indiceInicio: number; indiceFin: number }
  > = [];

  let cursor = 0;

  bloques.forEach((bloque, indice) => {
    const esUltimo = indice === bloques.length - 1;
    const indiceInicio = Math.min(cursor, semanasCalendario.length - 1);
    const indiceFin = esUltimo
      ? semanasCalendario.length - 1
      : Math.min(cursor + bloque.semanas - 1, semanasCalendario.length - 1);

    resultado.push({
      ...bloque,
      indiceInicio,
      indiceFin,
      fechaInicio: semanasCalendario[indiceInicio].fechaInicio,
      fechaFin: semanasCalendario[indiceFin].fechaFin,
    });

    cursor = indiceFin + 1;
  });

  return resultado;
}

export function calcularPeriodizacion(
  input: PeriodizacionInput,
): PeriodizacionOutput {
  const fechaInicio = startOfDay(input.fechaInicio);
  const fechaFin = startOfDay(input.fechaFin);
  const semanasCalendario = generarSemanasRango(fechaInicio, fechaFin);
  const totalSemanas = semanasCalendario.length;

  const { estructura } = input;

  if (estructura.errores.length > 0 || estructura.bloques.length === 0) {
    return {
      fechaInicio,
      fechaFin,
      totalSemanas,
      periodos: [],
      mesociclos: [],
      semanas: [],
      avisos: estructura.avisos,
      errores:
        estructura.errores.length > 0
          ? estructura.errores
          : ["La estructura del macrociclo quedó vacía."],
    };
  }

  if (estructura.totalSemanas !== totalSemanas) {
    return {
      fechaInicio,
      fechaFin,
      totalSemanas,
      periodos: [],
      mesociclos: [],
      semanas: [],
      avisos: estructura.avisos,
      errores: [
        `La estructura se calculó para ${estructura.totalSemanas} semanas y el rango de fechas tiene ${totalSemanas}. Vuelve a generar la estructura.`,
      ],
    };
  }

  // --- Mesociclos ---------------------------------------------------------
  const bloquesConFecha = asignarRangos(estructura.bloques, semanasCalendario);

  // --- Microciclos: tipo y factores de carga de cada semana ---------------
  const semanaDeBloque = new Map<number, (typeof bloquesConFecha)[number]>();
  for (const bloque of bloquesConFecha) {
    for (let i = bloque.indiceInicio; i <= bloque.indiceFin; i += 1) {
      semanaDeBloque.set(i, bloque);
    }
  }

  const microciclos = resolverMicrociclos(
    semanasCalendario.map((semana, indice) => ({
      numeroSemana: semana.numeroSemana,
      mesocicloTipo: semanaDeBloque.get(indice)?.tipo ?? bloquesConFecha[0].tipo,
      fechaInicio: semana.fechaInicio,
      fechaFin: semana.fechaFin,
    })),
    {
      competencias: input.competencias,
      modoCalendario: input.modoCalendario,
      frecuenciaDeload: input.frecuenciaDeload,
    },
  );

  const microcicloPorNumero = new Map(
    microciclos.map((item) => [item.numeroSemana, item]),
  );

  const semanas: SemanaCalculada[] = semanasCalendario.map((semana, indice) => {
    const micro = microcicloPorNumero.get(semana.numeroSemana);
    const bloque = semanaDeBloque.get(indice);

    return {
      numeroSemana: semana.numeroSemana,
      mesCalendario: semana.mesCalendario,
      fechaInicio: semana.fechaInicio,
      fechaFin: semana.fechaFin,
      tipoMicrociclo: micro?.tipoMicrociclo ?? "corriente",
      frecuencia: 0,
      series: 0,
      repeticiones: 0,
      volumen: 0,
      intensidad: 0,
      notas: micro?.motivo,
      ejercicios: [],
      // ADR-43: contexto para poder proponer la carga de la semana.
      objetivoBloque: bloque?.objetivoBloque,
      indiceEnBloque: bloque ? indice - bloque.indiceInicio + 1 : undefined,
      totalSemanasBloque: bloque
        ? bloque.indiceFin - bloque.indiceInicio + 1
        : undefined,
      factorVolumen: micro?.factorVolumen ?? 1,
      factorIntensidad: micro?.factorIntensidad ?? 1,
      esDeload: micro?.esDeload ?? false,
    };
  });

  const mesociclos: MesocicloCalculado[] = bloquesConFecha.map((bloque) => ({
    tipo: bloque.tipo,
    porcentaje: bloque.porcentaje,
    fechaInicio: bloque.fechaInicio,
    fechaFin: bloque.fechaFin,
    orden: bloque.orden,
    semanas: semanas.slice(bloque.indiceInicio, bloque.indiceFin + 1),
  }));

  // --- Periodos y etapas --------------------------------------------------
  const periodosConFecha = asignarRangos(estructura.periodos, semanasCalendario);

  const periodos: PeriodoCalculado[] = periodosConFecha.map((periodo) => {
    const semanasDelPeriodo = semanasCalendario.slice(
      periodo.indiceInicio,
      periodo.indiceFin + 1,
    );

    const etapasConFecha = asignarRangos(periodo.etapas, semanasDelPeriodo);

    const etapas: EtapaCalculada[] = etapasConFecha.map((etapa) => ({
      tipo: etapa.tipo,
      porcentaje: etapa.porcentaje,
      fechaInicio: etapa.fechaInicio,
      fechaFin: etapa.fechaFin,
      orden: etapa.orden,
    }));

    return {
      tipo: periodo.tipo,
      porcentaje: periodo.porcentaje,
      fechaInicio: periodo.fechaInicio,
      fechaFin: periodo.fechaFin,
      orden: periodo.orden,
      etapas,
    };
  });

  return {
    fechaInicio,
    fechaFin,
    totalSemanas,
    periodos,
    mesociclos,
    semanas,
    avisos: estructura.avisos,
    errores: [],
  };
}

/** Semanas completas que caben entre dos fechas, para dimensionar la estructura. */
export function contarSemanas(fechaInicio: Date, fechaFin: Date): number {
  return generarSemanasRango(fechaInicio, fechaFin).length;
}

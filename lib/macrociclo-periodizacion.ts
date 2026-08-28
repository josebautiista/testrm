import {
  type EtapaCalculada,
  type EtapaInput,
  type MesocicloCalculado,
  type MesocicloInput,
  type PeriodoCalculado,
  type PeriodoInput,
  type SemanaCalculada,
  type TipoEtapa,
  type TipoMesociclo,
  type TipoPeriodo,
  diasEntre,
} from "./macrociclo";
import {
  DistribucionSemanasError,
  distribuirSemanasPorMayorResto,
} from "./planificacion/estructura";

export type PeriodizacionInput = {
  fechaInicio: Date;
  fechaFin: Date;
  periodos: PeriodoInput[];
  etapasPorPeriodo: Record<TipoPeriodo, EtapaInput[]>;
  mesociclos: MesocicloInput[];
};

export type PeriodizacionOutput = {
  fechaInicio: Date;
  fechaFin: Date;
  totalSemanas: number;
  periodos: PeriodoCalculado[];
  mesociclos: MesocicloCalculado[];
  semanas: SemanaCalculada[];
  /**
   * Mensajes de error de la distribución de semanas (F-08 / D-10), p. ej.
   * "menos semanas que bloques". Nunca se lanza una excepción desde
   * calcularPeriodizacion: cuando hay errores, el nivel afectado (periodos,
   * mesociclos) se devuelve vacío y el llamador decide cómo mostrarlo o si
   * bloquea el guardado (ver services/macrociclo.service.ts).
   */
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

function generarSemanasRango(
  fechaInicio: Date,
  fechaFin: Date,
): Array<{ numeroSemana: number; fechaInicio: Date; fechaFin: Date; mesCalendario: number }> {
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

function completarPorcentajes(
  items: { tipo: string; porcentaje: number }[],
): { tipo: string; porcentaje: number }[] {
  const total = items.reduce((sum, item) => sum + item.porcentaje, 0);
  const vacios = items.filter((item) => item.porcentaje === 0 || Number.isNaN(item.porcentaje));

  if (vacios.length === 1 && total < 100 && total >= 0) {
    return items.map((item) =>
      vacios.some((v) => v.tipo === item.tipo)
        ? { ...item, porcentaje: Math.max(0, 100 - total) }
        : item,
    );
  }

  return items;
}

/**
 * Reparte semanas por mayor resto (F-08). Nunca lanza: si la distribución no
 * es posible (menos semanas que bloques activos), registra el motivo en
 * `errores` y devuelve todos los ítems en 0 semanas.
 */
function distribuirSemanasSeguro(
  totalSemanas: number,
  items: { tipo: string; porcentaje: number }[],
  contexto: string,
  errores: string[],
): { tipo: string; semanas: number }[] {
  try {
    return distribuirSemanasPorMayorResto(totalSemanas, items);
  } catch (error) {
    if (error instanceof DistribucionSemanasError) {
      errores.push(`${contexto}: ${error.message}`);
      return items.map((item) => ({ tipo: item.tipo, semanas: 0 }));
    }
    throw error;
  }
}

function asignarFechasConsecutivas(
  inicio: Date,
  distribucion: { tipo: string; semanas: number }[],
  finLimite?: Date,
): Array<{ tipo: string; fechaInicio: Date; fechaFin: Date; semanas: number }> {
  let current = startOfDay(inicio);
  return distribucion.map((item, index) => {
    const dias = Math.max(0, item.semanas * 7 - 1);
    let fin = addDays(current, dias);

    // La última semana calendario del macrociclo puede ser parcial (menos
    // de 7 días) si el rango total no es múltiplo exacto de 7 días. Todos
    // los bloques anteriores usan semanas completas por construcción, así
    // que solo el último bloque de la cadena puede heredar ese faltante;
    // sin este ajuste, R-16 invariante #2 se violaba en cualquier
    // macrociclo cuya duración no cayera en un múltiplo exacto de semanas.
    const esUltimo = index === distribucion.length - 1;
    if (esUltimo && finLimite && fin > finLimite) {
      fin = new Date(finLimite);
    }

    const rango = {
      tipo: item.tipo,
      fechaInicio: new Date(current),
      fechaFin: new Date(fin),
      semanas: item.semanas,
    };
    current = addDays(fin, 1);
    return rango;
  });
}

function calcularPeriodos(
  fechaInicio: Date,
  fechaFin: Date,
  totalSemanas: number,
  periodosInput: PeriodoInput[],
  etapasPorPeriodo: Record<TipoPeriodo, EtapaInput[]>,
  errores: string[],
): PeriodoCalculado[] {
  const completados = completarPorcentajes(
    periodosInput.map((p) => ({ tipo: p.tipo, porcentaje: p.porcentaje })),
  );

  const distribuidos = distribuirSemanasSeguro(
    totalSemanas,
    completados.map((p) => ({ tipo: p.tipo, porcentaje: p.porcentaje })),
    "Periodos",
    errores,
  );

  const rangos = asignarFechasConsecutivas(fechaInicio, distribuidos, fechaFin);

  return rangos.map((rango, index) => {
    const tipo = rango.tipo as TipoPeriodo;
    const etapasInput = etapasPorPeriodo[tipo] ?? [];
    const etapasCompletadas = completarPorcentajes(
      etapasInput.map((e) => ({ tipo: e.tipo, porcentaje: e.porcentaje })),
    );

    const semanasEtapa = distribuirSemanasSeguro(
      rango.semanas,
      etapasCompletadas.map((e) => ({ tipo: e.tipo, porcentaje: e.porcentaje })),
      `Etapas de ${tipo}`,
      errores,
    );

    const rangosEtapa = asignarFechasConsecutivas(rango.fechaInicio, semanasEtapa, rango.fechaFin);

    const etapas: EtapaCalculada[] = rangosEtapa.map((re, idx) => ({
      tipo: re.tipo as TipoEtapa,
      porcentaje: etapasCompletadas[idx]?.porcentaje ?? 0,
      fechaInicio: re.fechaInicio,
      fechaFin: re.fechaFin,
      orden: idx + 1,
    }));

    return {
      tipo,
      porcentaje: completados[index]?.porcentaje ?? 0,
      fechaInicio: rango.fechaInicio,
      fechaFin: rango.fechaFin,
      orden: index + 1,
      etapas,
    };
  });
}

function calcularMesociclos(
  fechaInicio: Date,
  fechaFin: Date,
  totalSemanas: number,
  mesociclosInput: MesocicloInput[],
  semanasBase: Array<{
    numeroSemana: number;
    fechaInicio: Date;
    fechaFin: Date;
    mesCalendario: number;
  }>,
  errores: string[],
): MesocicloCalculado[] {
  const items = mesociclosInput.map((m) => ({ tipo: m.tipo, porcentaje: m.porcentaje }));
  const completados = completarPorcentajes(items);
  const distribuidos = distribuirSemanasSeguro(
    totalSemanas,
    completados.map((m) => ({ tipo: m.tipo, porcentaje: m.porcentaje })),
    "Mesociclos",
    errores,
  );
  const rangos = asignarFechasConsecutivas(fechaInicio, distribuidos, fechaFin);

  return rangos.map((rango, index) => {
    const semanasMesociclo = semanasBase.filter(
      (s) =>
        diasEntre(s.fechaInicio, rango.fechaFin) >= 0 &&
        diasEntre(rango.fechaInicio, s.fechaFin) >= 0,
    ).map((s) => ({
      ...s,
      tipoMicrociclo: "corriente" as const,
      frecuencia: 0,
      series: 0,
      repeticiones: 0,
      volumen: 0,
      intensidad: 0,
      ejercicios: [],
    }));

    return {
      tipo: rango.tipo as TipoMesociclo,
      porcentaje: completados[index]?.porcentaje ?? 0,
      fechaInicio: rango.fechaInicio,
      fechaFin: rango.fechaFin,
      orden: index + 1,
      semanas: semanasMesociclo,
    };
  });
}

export function calcularPeriodizacion(
  input: PeriodizacionInput,
): PeriodizacionOutput {
  const errores: string[] = [];
  const fechaInicio = startOfDay(input.fechaInicio);
  const fechaFin = startOfDay(input.fechaFin);
  const semanasBase = generarSemanasRango(fechaInicio, fechaFin);
  const totalSemanas = semanasBase.length;

  const periodos = calcularPeriodos(
    fechaInicio,
    fechaFin,
    totalSemanas,
    input.periodos,
    input.etapasPorPeriodo,
    errores,
  );

  const mesociclos = calcularMesociclos(
    fechaInicio,
    fechaFin,
    totalSemanas,
    input.mesociclos,
    semanasBase,
    errores,
  );

    const semanas: SemanaCalculada[] = semanasBase.map((semanaBase) => ({
      numeroSemana: semanaBase.numeroSemana,
      mesCalendario: semanaBase.mesCalendario,
      fechaInicio: semanaBase.fechaInicio,
      fechaFin: semanaBase.fechaFin,
      tipoMicrociclo: "corriente",
      frecuencia: 0,
      series: 0,
      repeticiones: 0,
      volumen: 0,
      intensidad: 0,
      ejercicios: [],
    }));

  return {
    fechaInicio,
    fechaFin,
    totalSemanas,
    periodos,
    mesociclos,
    semanas,
    errores,
  };
}

export function totalPorcentajePeriodos(periodos: PeriodoInput[]): number {
  return periodos.reduce((sum, p) => sum + (p.porcentaje || 0), 0);
}

export function totalPorcentajeEtapas(etapas: EtapaInput[]): number {
  return etapas.reduce((sum, e) => sum + (e.porcentaje || 0), 0);
}

export function totalPorcentajeMesociclos(mesociclos: MesocicloInput[]): number {
  return mesociclos.reduce((sum, m) => sum + (m.porcentaje || 0), 0);
}

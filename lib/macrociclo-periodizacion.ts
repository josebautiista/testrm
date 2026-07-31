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

function distribuirSemanas(
  totalSemanas: number,
  items: { tipo: string; porcentaje: number }[],
): { tipo: string; semanas: number }[] {
  if (totalSemanas <= 0) {
    return items.map((item) => ({ tipo: item.tipo, semanas: 0 }));
  }

  let asignadas = items.map((item) => ({
    tipo: item.tipo,
    porcentaje: item.porcentaje,
    semanas: 0,
  }));

  let usadas = 0;
  asignadas = asignadas.map((item) => {
    if (item.porcentaje <= 0) return { ...item, semanas: 0 };
    const raw = Math.round((totalSemanas * item.porcentaje) / 100);
    const semanas = Math.max(1, raw);
    usadas += semanas;
    return { ...item, semanas };
  });

  const diferencia = totalSemanas - usadas;

  if (diferencia !== 0) {
    const activos = asignadas
      .map((item, index) => ({ ...item, index }))
      .filter((item) => item.porcentaje > 0);

    if (activos.length > 0) {
      activos.sort((a, b) => b.porcentaje - a.porcentaje);
      const targetIndex = activos[0].index;
      asignadas[targetIndex] = {
        ...asignadas[targetIndex],
        semanas: Math.max(1, asignadas[targetIndex].semanas + diferencia),
      };
    }
  }

  return asignadas.map((item) => ({
    tipo: item.tipo,
    semanas: item.semanas,
  }));
}

function asignarFechasConsecutivas(
  inicio: Date,
  distribucion: { tipo: string; semanas: number }[],
): Array<{ tipo: string; fechaInicio: Date; fechaFin: Date; semanas: number }> {
  let current = startOfDay(inicio);
  return distribucion.map((item) => {
    const dias = Math.max(0, item.semanas * 7 - 1);
    const fin = addDays(current, dias);
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
): PeriodoCalculado[] {
  const completados = completarPorcentajes(
    periodosInput.map((p) => ({ tipo: p.tipo, porcentaje: p.porcentaje })),
  );

  const distribuidos = distribuirSemanas(
    totalSemanas,
    completados.map((p) => ({ tipo: p.tipo, porcentaje: p.porcentaje })),
  );

  const rangos = asignarFechasConsecutivas(fechaInicio, distribuidos);

  return rangos.map((rango, index) => {
    const tipo = rango.tipo as TipoPeriodo;
    const etapasInput = etapasPorPeriodo[tipo] ?? [];
    const etapasCompletadas = completarPorcentajes(
      etapasInput.map((e) => ({ tipo: e.tipo, porcentaje: e.porcentaje })),
    );

    const semanasEtapa = distribuirSemanas(
      rango.semanas,
      etapasCompletadas.map((e) => ({ tipo: e.tipo, porcentaje: e.porcentaje })),
    );

    const rangosEtapa = asignarFechasConsecutivas(rango.fechaInicio, semanasEtapa);

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
): MesocicloCalculado[] {
  const items = mesociclosInput.map((m) => ({ tipo: m.tipo, porcentaje: m.porcentaje }));
  const completados = completarPorcentajes(items);
  const distribuidos = distribuirSemanas(
    totalSemanas,
    completados.map((m) => ({ tipo: m.tipo, porcentaje: m.porcentaje })),
  );
  const rangos = asignarFechasConsecutivas(fechaInicio, distribuidos);

  return rangos.map((rango, index) => {
    const semanasMesociclo = semanasBase.filter(
      (s) =>
        diasEntre(s.fechaInicio, rango.fechaFin) >= 0 &&
        diasEntre(rango.fechaInicio, s.fechaFin) >= 0,
    ).map((s) => ({
      ...s,
      tipoMicrociclo: "corriente" as const,
      frecuencia: 0,
      volumen: 0,
      intensidad: 0,
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
  );

  const mesociclos = calcularMesociclos(
    fechaInicio,
    fechaFin,
    totalSemanas,
    input.mesociclos,
    semanasBase,
  );

  const semanas: SemanaCalculada[] = semanasBase.map((semanaBase) => ({
    numeroSemana: semanaBase.numeroSemana,
    mesCalendario: semanaBase.mesCalendario,
    fechaInicio: semanaBase.fechaInicio,
    fechaFin: semanaBase.fechaFin,
    tipoMicrociclo: "corriente",
    frecuencia: 0,
    volumen: 0,
    intensidad: 0,
  }));

  return {
    fechaInicio,
    fechaFin,
    totalSemanas,
    periodos,
    mesociclos,
    semanas,
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

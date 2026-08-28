// F-08 · Distribución de semanas por porcentaje — método del mayor resto (Hare).
// Corrige D-10 (§0.2 PLAN-MAESTRO.md): el algoritmo anterior forzaba mínimo 1
// semana por ítem y volcaba toda la diferencia sobre el de mayor porcentaje,
// lo que rompía Σ semanas = totalSemanas y desbordaba fechaFin.
//
// Algoritmo: a cada bloque activo (porcentaje > 0) se le garantiza 1 semana
// mínima (solo posible si totalSemanas >= número de bloques activos; si no,
// se rechaza con un error explícito). Las semanas restantes se reparten
// proporcionalmente por porcentaje usando floor() + mayor resto, lo que
// garantiza Σ semanas = totalSemanas por construcción.

export type ItemDistribucion = {
  tipo: string;
  porcentaje: number;
};

export type ItemDistribuido = {
  tipo: string;
  semanas: number;
};

export class DistribucionSemanasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DistribucionSemanasError";
  }
}

/**
 * Reparte `totalSemanas` entre `items` según su porcentaje, usando el método
 * del mayor resto con mínimo garantizado de 1 semana por bloque activo.
 * Garantiza que la suma de semanas devueltas sea siempre igual a
 * `totalSemanas` (cuando hay al menos un ítem activo).
 *
 * @throws DistribucionSemanasError si totalSemanas < número de ítems activos
 *   (porcentaje > 0): no puede darse al menos 1 semana a cada uno sin
 *   inventar semanas fuera del rango del macrociclo.
 */
export function distribuirSemanasPorMayorResto(
  totalSemanas: number,
  items: ItemDistribucion[],
): ItemDistribuido[] {
  if (totalSemanas <= 0) {
    return items.map((item) => ({ tipo: item.tipo, semanas: 0 }));
  }

  const activos = items.filter((item) => item.porcentaje > 0);

  if (activos.length === 0) {
    return items.map((item) => ({ tipo: item.tipo, semanas: 0 }));
  }

  if (totalSemanas < activos.length) {
    throw new DistribucionSemanasError(
      `No es posible repartir ${totalSemanas} semana(s) entre ${activos.length} bloque(s) activo(s): ` +
        `se necesita al menos 1 semana por bloque. Reduce el número de bloques o aumenta la duración.`,
    );
  }

  const totalPorcentaje = activos.reduce((sum, item) => sum + item.porcentaje, 0);
  const restante = totalSemanas - activos.length;

  const proporcional = activos.map((item) => {
    const exacto = (restante * item.porcentaje) / totalPorcentaje;
    const base = Math.floor(exacto);
    return { tipo: item.tipo, base, resto: exacto - base };
  });

  const usadas = proporcional.reduce((sum, item) => sum + item.base, 0);
  let sobrantes = restante - usadas;

  const ordenPorResto = [...proporcional].sort((a, b) => b.resto - a.resto);
  for (let i = 0; i < ordenPorResto.length && sobrantes > 0; i += 1) {
    ordenPorResto[i].base += 1;
    sobrantes -= 1;
  }

  const semanasPorTipo = new Map(
    proporcional.map((item) => [item.tipo, 1 + item.base]),
  );

  return items.map((item) => ({
    tipo: item.tipo,
    semanas: semanasPorTipo.get(item.tipo) ?? 0,
  }));
}

// TASK-029 · Asignación de tipo de microciclo por semana y ubicación de
// deload (R-10, R-16 invariantes #5 y #10).

import { DELOAD } from "@/lib/config/parametros";
import type { TipoMesociclo, TipoMicrociclo } from "@/lib/macrociclo";

/**
 * Mapeo directo mesociclo -> microciclo "natural" de esa fase. Varios
 * nombres ya coinciden entre TipoMesociclo y TipoMicrociclo (precompetitivo,
 * choque, aproximacion) porque comparten el mismo vocabulario académico
 * (ADR-23); donde no coinciden se usa "corriente" (trabajo estándar) o
 * "competitivo" (semana de competencia real).
 */
const MICROCICLO_BASE_POR_MESOCICLO: Record<TipoMesociclo, TipoMicrociclo> = {
  entrante: "corriente",
  desarrollador: "corriente",
  desarrollador_especifico: "corriente",
  estabilizador: "corriente",
  precompetitivo: "precompetitivo",
  choque: "choque",
  aproximacion: "aproximacion",
  competencia: "competitivo",
};

export type SemanaParaMicrociclo = {
  numeroSemana: number;
  mesocicloTipo: TipoMesociclo;
};

export type MicrocicloAsignado = {
  numeroSemana: number;
  tipoMicrociclo: TipoMicrociclo;
  esDeload: boolean;
};

/**
 * R-10: deload programado cada `frecuenciaDeload` semanas (contador global,
 * no por mesociclo — un deload en la última semana de un bloque cuenta para
 * el siguiente). R-16 #10: nunca dos semanas de "choque" consecutivas — la
 * segunda se convierte en descarga, lo que de paso funciona como el deload
 * reactivo natural de un microciclo de choque.
 */
export function asignarMicrociclos(
  semanas: SemanaParaMicrociclo[],
  frecuenciaDeload: number = DELOAD.frecuenciaSemanasEstandar,
): MicrocicloAsignado[] {
  const resultado: MicrocicloAsignado[] = [];
  let semanasDesdeUltimoDeload = 0;
  let ultimoFueChoque = false;

  for (const semana of semanas) {
    const base = MICROCICLO_BASE_POR_MESOCICLO[semana.mesocicloTipo];
    semanasDesdeUltimoDeload += 1;

    let tipoMicrociclo: TipoMicrociclo = base;
    let esDeload = false;

    if (base === "choque" && ultimoFueChoque) {
      tipoMicrociclo = "recuperacion";
      esDeload = true;
    } else if (semanasDesdeUltimoDeload >= frecuenciaDeload) {
      tipoMicrociclo = "recuperacion";
      esDeload = true;
    }

    if (esDeload) {
      semanasDesdeUltimoDeload = 0;
    }

    ultimoFueChoque = tipoMicrociclo === "choque";
    resultado.push({ numeroSemana: semana.numeroSemana, tipoMicrociclo, esDeload });
  }

  return resultado;
}

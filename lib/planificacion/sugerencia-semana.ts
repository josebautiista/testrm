// ADR-43 · Configuración propuesta de cada semana del macrociclo.
//
// El paso de Semanas pedía a mano frecuencia, series, repeticiones,
// intensidad y volumen para cada una de las semanas del plan — hasta 52
// filas de cinco campos, arrancando todas en cero. Pero todo eso ya es
// derivable: cada bloque lleva su `objetivoBloque`, cada objetivo tiene su
// zona de intensidad y su rango de volumen en `lib/config/parametros.ts`, y
// cada semana lleva ya resueltos sus factores de carga (descarga, taper,
// evaluación).
//
// Este módulo **no reimplementa** nada: reutiliza `calcularIntensidadObjetivoPct`
// y `calcularSeriesObjetivo` de `prescripcion.ts`, que son las mismas
// funciones que usa el motor de planificación. El asistente manual pasa así
// de rellenar a revisar, sin introducir un segundo criterio de cálculo.

import {
  PROGRESION_POR_OBJETIVO,
  RANGOS_VOLUMEN,
  ZONAS_INTENSIDAD,
  type ObjetivoBloque,
} from "@/lib/config/parametros";
import type { TipoMicrociclo } from "@/lib/macrociclo";
import {
  calcularIntensidadObjetivoPct,
  calcularSeriesObjetivo,
} from "./prescripcion";

export type SugerenciaSemana = {
  frecuencia: number;
  series: number;
  repeticiones: number;
  /** Porcentaje del RM, 0-100. */
  intensidad: number;
  /** Explicación de dónde sale la propuesta, para mostrarla junto al campo. */
  motivo: string;
};

export type EntradaSugerencia = {
  objetivoBloque?: string;
  /** Posición dentro del bloque, 1-indexada. */
  indiceEnBloque?: number;
  totalSemanasBloque?: number;
  factorVolumen?: number;
  factorIntensidad?: number;
  tipoMicrociclo?: TipoMicrociclo;
  /** Días por semana que el atleta declaró disponibles. */
  diasDisponibles?: number;
};

const DIAS_POR_DEFECTO = 3;

function esObjetivoBloque(valor: unknown): valor is ObjetivoBloque {
  return (
    typeof valor === "string" &&
    Object.prototype.hasOwnProperty.call(ZONAS_INTENSIDAD, valor)
  );
}

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor));
}

const OBJETIVO_LEGIBLE: Record<ObjetivoBloque, string> = {
  fuerza_maxima: "fuerza máxima",
  realizacion: "realización",
  potencia: "potencia",
  hipertrofia: "hipertrofia",
  acumulacion: "acumulación",
  resistencia_fuerza: "resistencia a la fuerza",
  recuperacion: "recuperación",
};

/**
 * Propone la carga de una semana a partir de su bloque y sus factores.
 *
 * Nunca lanza: sin contexto suficiente devuelve una propuesta conservadora
 * marcada como tal, para que el entrenador sepa que ahí no hay nada supuesto.
 */
export function sugerirConfiguracionSemana(
  entrada: EntradaSugerencia,
): SugerenciaSemana {
  const diasDisponibles = Number.isFinite(entrada.diasDisponibles)
    ? acotar(Math.round(entrada.diasDisponibles as number), 1, 7)
    : DIAS_POR_DEFECTO;

  if (!esObjetivoBloque(entrada.objetivoBloque)) {
    return {
      frecuencia: diasDisponibles,
      series: 0,
      repeticiones: 0,
      intensidad: 0,
      motivo:
        "Esta semana no está asignada a ningún bloque, así que no hay nada de dónde derivar la carga. Rellénala a mano.",
    };
  }

  const objetivoBloque = entrada.objetivoBloque;
  const zona = ZONAS_INTENSIDAD[objetivoBloque];
  const rango = RANGOS_VOLUMEN[objetivoBloque];
  const progresion = PROGRESION_POR_OBJETIVO[objetivoBloque];

  const total = Math.max(1, Math.round(entrada.totalSemanasBloque ?? 1));
  const indice = acotar(Math.round(entrada.indiceEnBloque ?? 1), 1, total);

  const factorVolumen = Number.isFinite(entrada.factorVolumen)
    ? acotar(entrada.factorVolumen as number, 0, 1)
    : 1;
  const factorIntensidad = Number.isFinite(entrada.factorIntensidad)
    ? acotar(entrada.factorIntensidad as number, 0, 1)
    : 1;

  const intensidadBase = calcularIntensidadObjetivoPct(
    zona,
    progresion,
    indice,
    total,
  );
  const seriesBase = calcularSeriesObjetivo(rango, progresion, indice, total);

  const intensidad = Math.round(
    acotar(intensidadBase * factorIntensidad, 0, 100),
  );
  const series = Math.max(1, Math.round(seriesBase * factorVolumen));
  const repeticiones = Math.max(
    1,
    Math.round((zona.repsMin + zona.repsMax) / 2),
  );

  const nombreObjetivo = OBJETIVO_LEGIBLE[objetivoBloque];
  const detalleBloque = `Bloque de ${nombreObjetivo}, semana ${indice} de ${total}.`;

  let ajuste = "";
  if (entrada.tipoMicrociclo === "taper") {
    ajuste = ` Al ser semana de afinamiento, el volumen baja al ${Math.round(
      factorVolumen * 100,
    )} % y la intensidad se mantiene.`;
  } else if (entrada.tipoMicrociclo === "evaluacion") {
    ajuste = " Al ser semana de evaluación, el volumen se reduce para dejar sitio a los tests.";
  } else if (factorVolumen < 1) {
    ajuste = ` Semana de descarga: volumen al ${Math.round(factorVolumen * 100)} %.`;
  }

  return {
    frecuencia: diasDisponibles,
    series,
    repeticiones,
    intensidad,
    motivo: `${detalleBloque} La zona de ${nombreObjetivo} trabaja al ${zona.intensidadMinPct}-${zona.intensidadMaxPct} % con ${zona.repsMin}-${zona.repsMax} repeticiones.${ajuste}`,
  };
}

/** true si la configuración está vacía (todo en cero), es decir, sin tocar. */
export function estaSinConfigurar(config: {
  frecuencia: number | "";
  series: number | "";
  repeticiones: number | "";
  intensidad: number | "";
}): boolean {
  return (
    !Number(config.frecuencia) &&
    !Number(config.series) &&
    !Number(config.repeticiones) &&
    !Number(config.intensidad)
  );
}

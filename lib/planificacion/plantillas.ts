// TASK-028 · Plantillas de periodización por objetivo y nivel.
//
// Decisión de diseño (pendiente de validar con el entrenador, ver Q-03/Q-05
// en §19.3 del plan): en vez de tablas hardcodeadas para 8/12/16/24 semanas,
// la plantilla es un reparto porcentual fijo (igual al que ya usa el wizard
// manual en MacrocicloWizard.tsx, para no introducir un segundo criterio) y
// se apoya en distribuirSemanasPorMayorResto (F-08) para escalar a
// cualquier duración sin perder la propiedad Σ semanas = total. Un
// macrociclo más corto que el número de bloques activos se rechaza con un
// error explícito (E-06/E-08) en vez de generar una estructura inválida.
import { ETAPAS_POR_PERIODO, ORDEN_MESES, type TipoEtapa, type TipoMesociclo, type TipoPeriodo } from "@/lib/macrociclo";
import { PROGRESION_POR_OBJETIVO, ZONAS_INTENSIDAD, type ObjetivoBloque } from "@/lib/config/parametros";
import type { NivelAtleta, ObjetivoTipo } from "./tipos";

export type PlantillaMesociclo = {
  tipo: TipoMesociclo;
  porcentaje: number;
  objetivoBloque: ObjetivoBloque;
};

export type PlantillaPeriodizacion = {
  periodos: Array<{ tipo: TipoPeriodo; porcentaje: number }>;
  etapasPorPeriodo: Record<TipoPeriodo, Array<{ tipo: TipoEtapa; porcentaje: number }>>;
  mesociclos: PlantillaMesociclo[];
};

/** Objetivo de bloque por tipo de mesociclo (vocabulario cubano-soviético, ADR-23). */
const OBJETIVO_BLOQUE_POR_MESOCICLO: Record<TipoMesociclo, ObjetivoBloque> = {
  entrante: "resistencia_fuerza",
  desarrollador: "hipertrofia",
  desarrollador_especifico: "acumulacion",
  estabilizador: "fuerza_maxima",
  precompetitivo: "realizacion",
  choque: "potencia",
  aproximacion: "realizacion",
  competencia: "potencia",
};

/** Reparto porcentual por defecto — igual al que ya usa el wizard manual. */
const PORCENTAJE_MESOCICLO_DEFECTO: Record<TipoMesociclo, number> = {
  entrante: 10,
  desarrollador: 15,
  desarrollador_especifico: 15,
  estabilizador: 10,
  precompetitivo: 15,
  choque: 10,
  aproximacion: 15,
  competencia: 10,
};

/**
 * Objetivo "salud": sin bloque de competencia real, se reduce el peso de
 * los mesociclos de pico (choque/competencia) a favor de desarrollo.
 */
const PORCENTAJE_MESOCICLO_SALUD: Record<TipoMesociclo, number> = {
  entrante: 15,
  desarrollador: 25,
  desarrollador_especifico: 20,
  estabilizador: 15,
  precompetitivo: 10,
  choque: 5,
  aproximacion: 5,
  competencia: 5,
};

export function obtenerPlantilla(
  objetivoTipo: ObjetivoTipo,
  _nivel: NivelAtleta,
): PlantillaPeriodizacion {
  void _nivel; // reservado: ajustar plantilla por nivel es trabajo futuro (Q-03).

  const porcentajesMesociclo =
    objetivoTipo === "salud" ? PORCENTAJE_MESOCICLO_SALUD : PORCENTAJE_MESOCICLO_DEFECTO;

  const mesociclos: PlantillaMesociclo[] = ORDEN_MESES.map((tipo) => ({
    tipo,
    porcentaje: porcentajesMesociclo[tipo],
    objetivoBloque: OBJETIVO_BLOQUE_POR_MESOCICLO[tipo],
  }));

  const periodos: Array<{ tipo: TipoPeriodo; porcentaje: number }> =
    objetivoTipo === "competencia"
      ? [
          { tipo: "preparatorio", porcentaje: 70 },
          { tipo: "competitivo", porcentaje: 30 },
        ]
      : [
          { tipo: "preparatorio", porcentaje: 80 },
          { tipo: "competitivo", porcentaje: 20 },
        ];

  const etapasPorPeriodo: PlantillaPeriodizacion["etapasPorPeriodo"] = {
    preparatorio: ETAPAS_POR_PERIODO.preparatorio.map((tipo, index, arr) => ({
      tipo,
      porcentaje: Math.round(100 / arr.length),
    })),
    competitivo: ETAPAS_POR_PERIODO.competitivo.map((tipo, index, arr) => ({
      tipo,
      porcentaje: Math.round(100 / arr.length),
    })),
  };

  return { periodos, etapasPorPeriodo, mesociclos };
}

export function obtenerZonaBloque(objetivoBloque: ObjetivoBloque) {
  return ZONAS_INTENSIDAD[objetivoBloque];
}

export function obtenerProgresionBloque(objetivoBloque: ObjetivoBloque) {
  return PROGRESION_POR_OBJETIVO[objetivoBloque];
}

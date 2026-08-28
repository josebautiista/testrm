// TASK-028 · Plantillas de periodización.
//
// ADR-37: el reparto porcentual fijo (una sola secuencia de 8 mesociclos con
// una variante "salud") se sustituye por la estructura derivada del perfil
// deportivo — capacidad dominante, estructura del calendario y nivel. La
// lógica vive en `lib/planificacion/perfil.ts`; este módulo queda como la
// puerta de entrada del motor y como fuente única de la relación
// mesociclo → objetivo de bloque.

import type { TipoMesociclo } from "@/lib/macrociclo";
import {
  PROGRESION_POR_OBJETIVO,
  ZONAS_INTENSIDAD,
  type ObjetivoBloque,
} from "@/lib/config/parametros";
import {
  construirEstructura,
  type EstructuraPlan,
  type PerfilDeportivo,
} from "./perfil";

/** Objetivo de bloque por tipo de mesociclo (vocabulario cubano-soviético, ADR-23). */
export const OBJETIVO_BLOQUE_POR_MESOCICLO: Record<TipoMesociclo, ObjetivoBloque> = {
  entrante: "resistencia_fuerza",
  desarrollador: "hipertrofia",
  desarrollador_especifico: "acumulacion",
  estabilizador: "fuerza_maxima",
  precompetitivo: "realizacion",
  choque: "potencia",
  aproximacion: "realizacion",
  competencia: "potencia",
  transitorio: "recuperacion",
};

/**
 * Estructura del macrociclo para un perfil y una duración dados.
 * Es el único punto por el que el motor obtiene la forma del plan.
 */
export function obtenerEstructura(
  perfil: PerfilDeportivo,
  totalSemanas: number,
): EstructuraPlan {
  return construirEstructura(perfil, totalSemanas);
}

export function obtenerZonaBloque(objetivoBloque: ObjetivoBloque) {
  return ZONAS_INTENSIDAD[objetivoBloque];
}

export function obtenerProgresionBloque(objetivoBloque: ObjetivoBloque) {
  return PROGRESION_POR_OBJETIVO[objetivoBloque];
}

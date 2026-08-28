// M4 · RM vigente — dominio puro (sin Prisma). Resuelve "¿cuál era el 1RM de
// referencia de este ejercicio en esta fecha?" y su caducidad (R-15).
// La persistencia (leer/escribir RmVigente) vive en services/rm.service.ts;
// estas funciones son deliberadamente puras y testeables sin base de datos.

export type OrigenRmVigente =
  | "test_directo"
  | "estimacion"
  | "e1rm_entrenamiento"
  | "manual";

export type ConfianzaRmVigente = "alta" | "media" | "baja";

export type RmVigenteRow = {
  id: number;
  ejercicioId: number;
  valorKg: number;
  origen: OrigenRmVigente | string;
  confianza: ConfianzaRmVigente | string;
  resultadoRmId: number | null;
  validoDesde: Date;
  validoHasta: Date | null;
};

/** R-15: por encima de esto, el RM se marca caducado y se avisa reevaluar. */
export const CADUCIDAD_SEMANAS_AVISO = 12;
/** R-15: por encima de esto, además se rebaja la confianza a "baja". */
export const CADUCIDAD_SEMANAS_CONFIANZA_BAJA = 24;

const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000;

export function semanasEntre(desde: Date, hasta: Date): number {
  const diff = hasta.getTime() - desde.getTime();
  return diff <= 0 ? 0 : diff / MS_POR_SEMANA;
}

export type EstadoVigenciaRm = {
  semanasTranscurridas: number;
  caducado: boolean;
  /** Confianza efectiva para el motor: la original, o "baja" si pasó el umbral duro. */
  confianzaEfectiva: ConfianzaRmVigente;
};

/**
 * R-15. Nunca bloquea el uso del RM: el motor de planificación (Fase 4)
 * decide si avisa o si genera igual con confianza reducida.
 */
export function evaluarVigencia(
  rmVigente: Pick<RmVigenteRow, "validoDesde" | "confianza">,
  fecha: Date = new Date(),
): EstadoVigenciaRm {
  const semanasTranscurridas = semanasEntre(rmVigente.validoDesde, fecha);
  const caducado = semanasTranscurridas > CADUCIDAD_SEMANAS_AVISO;
  const confianzaOriginal: ConfianzaRmVigente =
    rmVigente.confianza === "alta" || rmVigente.confianza === "media"
      ? rmVigente.confianza
      : "baja";
  const confianzaEfectiva: ConfianzaRmVigente =
    semanasTranscurridas > CADUCIDAD_SEMANAS_CONFIANZA_BAJA
      ? "baja"
      : confianzaOriginal;

  return { semanasTranscurridas, caducado, confianzaEfectiva };
}

/**
 * AC-03: reconstruye cuál era el RM vigente de un ejercicio en cualquier
 * fecha pasada, a partir del historial append-only completo (abiertas y
 * cerradas) de un mismo (persona, ejercicio).
 */
export function seleccionarRmVigenteEnFecha(
  historico: RmVigenteRow[],
  fecha: Date,
): RmVigenteRow | null {
  const candidatos = historico.filter(
    (fila) =>
      fila.validoDesde <= fecha &&
      (fila.validoHasta === null || fila.validoHasta > fecha),
  );

  if (candidatos.length === 0) {
    return null;
  }

  return candidatos.reduce((mejor, actual) =>
    actual.validoDesde > mejor.validoDesde ? actual : mejor,
  );
}

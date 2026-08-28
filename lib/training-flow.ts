/**
 * Métodos de evaluación de RM disponibles según la experiencia declarada.
 *
 * ADR-33: los meses de entrenamiento son autorreportados y no constituyen un
 * cribado de seguridad — la revisión sistemática de fiabilidad del 1RM
 * (Grgic 2020) muestra que el test es fiable con o sin familiarización previa.
 * Este umbral es una política del producto, no una afirmación clínica; el
 * cribado real (salud, técnica, asistencia, respiración) se confirma en el
 * formulario antes de habilitar un protocolo máximo.
 */
export function getAvailableRMMethods(trainingMonths: number) {
  if (!Number.isFinite(trainingMonths) || trainingMonths < 4) {
    return ["estimation"];
  }

  return ["estimation", "casas", "naclerio"];
}

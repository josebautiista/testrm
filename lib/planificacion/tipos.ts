// Tipos compartidos del dominio puro de lib/planificacion/**. El motor de
// generación automática (contexto -> propuesta de plan) se retiró en
// ADR-49/ADR-50 (docs/DECISIONES.md): el entrenador escribe el WOD, no un
// motor. Lo que queda aquí es lo que `perfil.ts`/`sugerencia-semana.ts`
// siguen usando para el asistente manual.

export type NivelAtleta = "beginner" | "intermediate" | "advanced";

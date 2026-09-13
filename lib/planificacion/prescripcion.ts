// ADR-49/ADR-50 (docs/DECISIONES.md) · El motor ya no elige ejercicios, no
// calcula cargas ni genera sesiones — el entrenador escribe el WOD y las
// sesiones se crean directamente desde la `frecuencia` de cada semana al
// activar el macrociclo (services/macrociclo.service.ts
// crearSesionesPlanificadas). Lo único que queda aquí es el cálculo de
// progresión intra-mesociclo (R-08), que sigue usando
// `lib/planificacion/sugerencia-semana.ts` para el paso "Semanas" del
// asistente manual.
import type { ProgresionBloque } from "@/lib/config/parametros";

function lerp(min: number, max: number, ratio: number): number {
  const r = Math.min(1, Math.max(0, ratio));
  return min + (max - min) * r;
}

/** Posición relativa [0,1] de una semana dentro de su bloque (R-08). */
export function calcularProgresoEnBloque(
  indiceSemanaEnBloque: number,
  totalSemanasBloque: number,
): number {
  if (totalSemanasBloque <= 1) return 1;
  return lerp(0, 1, (indiceSemanaEnBloque - 1) / (totalSemanasBloque - 1));
}

/**
 * R-08: nunca sube volumen e intensidad la misma semana. Bloques
 * "lineal_intensidad" suben %1RM semana a semana con series ancladas al
 * mínimo del rango; "lineal_volumen" hacen lo inverso; "ondulante" alterna
 * por paridad de semana; "mantenimiento" (deload) usa siempre el mínimo.
 */
export function calcularIntensidadObjetivoPct(
  zona: { intensidadMinPct: number; intensidadMaxPct: number },
  progresion: ProgresionBloque,
  indiceSemanaEnBloque: number,
  totalSemanasBloque: number,
): number {
  const progreso = calcularProgresoEnBloque(indiceSemanaEnBloque, totalSemanasBloque);

  switch (progresion) {
    case "lineal_intensidad":
      return lerp(zona.intensidadMinPct, zona.intensidadMaxPct, progreso);
    case "ondulante":
      return indiceSemanaEnBloque % 2 === 0 ? zona.intensidadMaxPct : zona.intensidadMinPct;
    case "lineal_volumen":
    case "mantenimiento":
    default:
      return zona.intensidadMinPct;
  }
}

export function calcularSeriesObjetivo(
  rango: { seriesMin: number; seriesMax: number },
  progresion: ProgresionBloque,
  indiceSemanaEnBloque: number,
  totalSemanasBloque: number,
): number {
  const progreso = calcularProgresoEnBloque(indiceSemanaEnBloque, totalSemanasBloque);

  switch (progresion) {
    case "lineal_volumen":
      return Math.round(lerp(rango.seriesMin, rango.seriesMax, progreso));
    case "ondulante":
      return indiceSemanaEnBloque % 2 === 0 ? rango.seriesMax : rango.seriesMin;
    case "lineal_intensidad":
    case "mantenimiento":
    default:
      return rango.seriesMin;
  }
}

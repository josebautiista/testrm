// ADR-47 · Validación pura del objetivo de bloque editado en el paso "Carga"
// del wizard (`components/macrociclo/ObjetivoBloqueEditor.tsx`). Reemplaza a
// `lib/mesociclo-carga.ts` (minutos × direcciones, retirado — ver ADR-24/47
// en docs/DECISIONES.md). Sin Prisma: mismo criterio que el resto de
// lib/planificacion/**.

import {
  PATRONES_MOVIMIENTO,
  type PatronMovimiento,
} from "@/lib/ejercicio-catalogo";
import {
  ZONAS_INTENSIDAD,
  type ObjetivoBloque,
  type ProgresionBloque,
} from "@/lib/config/parametros";

/** Patrones de fuerza editables en el paso de carga (cardio no lleva %1RM ni RIR). */
export const PATRONES_FUERZA: readonly Exclude<PatronMovimiento, "cardio">[] =
  PATRONES_MOVIMIENTO.filter(
    (p): p is Exclude<PatronMovimiento, "cardio"> => p !== "cardio",
  );

const PROGRESIONES_BLOQUE: readonly ProgresionBloque[] = [
  "lineal_intensidad",
  "lineal_volumen",
  "ondulante",
  "mantenimiento",
];

export function esObjetivoBloque(value: unknown): value is ObjetivoBloque {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ZONAS_INTENSIDAD, value)
  );
}

export function esProgresionBloque(value: unknown): value is ProgresionBloque {
  return (
    typeof value === "string" &&
    (PROGRESIONES_BLOQUE as readonly string[]).includes(value)
  );
}

export type ObjetivoBloqueInputData = {
  objetivoBloque: ObjetivoBloque;
  intensidadMinPct: number;
  intensidadMaxPct: number;
  repsMin: number;
  repsMax: number;
  rirObjetivo: number;
  progresion: ProgresionBloque;
  /** patrón → series semanales objetivo. Solo patrones de fuerza (sin cardio). */
  seriesSemanalesPorPatron: Record<string, number>;
};

export type ObjetivoBloqueValidationResult =
  | { ok: true; data: ObjetivoBloqueInputData }
  | { ok: false; error: string };

function esNumeroFinito(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validarObjetivoBloque(
  input: unknown,
): ObjetivoBloqueValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Formato de datos inválido." };
  }

  const data = input as Partial<ObjetivoBloqueInputData>;

  if (!esObjetivoBloque(data.objetivoBloque)) {
    return { ok: false, error: "El objetivo de bloque no es válido." };
  }
  if (!esProgresionBloque(data.progresion)) {
    return { ok: false, error: "El tipo de progresión no es válido." };
  }

  const { intensidadMinPct, intensidadMaxPct, repsMin, repsMax, rirObjetivo } =
    data;
  if (
    ![intensidadMinPct, intensidadMaxPct, repsMin, repsMax, rirObjetivo].every(
      esNumeroFinito,
    )
  ) {
    return {
      ok: false,
      error: "Los valores de zona (%1RM, reps, RIR) deben ser números.",
    };
  }

  if (
    intensidadMinPct! < 1 ||
    intensidadMaxPct! > 100 ||
    intensidadMinPct! >= intensidadMaxPct!
  ) {
    return {
      ok: false,
      error:
        "La zona de %1RM debe estar entre 1 y 100, con el mínimo menor que el máximo.",
    };
  }

  if (
    !Number.isInteger(repsMin) ||
    !Number.isInteger(repsMax) ||
    repsMin! < 1 ||
    repsMax! > 30 ||
    repsMin! > repsMax!
  ) {
    return {
      ok: false,
      error:
        "El rango de repeticiones debe estar entre 1 y 30, con el mínimo menor o igual al máximo.",
    };
  }

  if (!Number.isInteger(rirObjetivo) || rirObjetivo! < 0 || rirObjetivo! > 10) {
    return { ok: false, error: "El RIR objetivo debe ser un entero entre 0 y 10." };
  }

  const seriesSemanalesPorPatron: Record<string, number> = {};
  const entradasSeries = Object.entries(data.seriesSemanalesPorPatron ?? {});
  for (const [patron, series] of entradasSeries) {
    if (!esNumeroFinito(series) || series < 0) {
      return {
        ok: false,
        error: `Las series semanales de "${patron}" deben ser un número mayor o igual a 0.`,
      };
    }
    seriesSemanalesPorPatron[patron] = series;
  }

  return {
    ok: true,
    data: {
      objetivoBloque: data.objetivoBloque,
      intensidadMinPct: intensidadMinPct!,
      intensidadMaxPct: intensidadMaxPct!,
      repsMin: repsMin!,
      repsMax: repsMax!,
      rirObjetivo: rirObjetivo!,
      progresion: data.progresion,
      seriesSemanalesPorPatron,
    },
  };
}

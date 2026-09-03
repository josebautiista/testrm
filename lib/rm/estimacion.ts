// Estimador primario de 1RM y nivel de confianza.
// Corrige D-02 (§0.2 PLAN-MAESTRO.md): nunca se usa max() entre fórmulas
// como estimador puntual. Ver F-01, ADR-01 y ADR-03.
//
// ADR-27: el RIR reportado corrige la estimación puntual. Una serie con
// repeticiones en reserva no es una serie al fallo: 8 repeticiones con 3 RIR
// equivalen, para la fórmula, a 11. Sin esta corrección Epley subestima
// sistemáticamente el 1RM de toda serie que no llegó al fallo.
//
// ADR-28: la ventana [3,8] es la zona donde una fórmula predictiva es
// precisa (Reynolds 2006: el 5RM predice con R²≈0,97; la precisión cae ~1,5%
// por repetición por encima de 8). No sustituye a la ventana de validez
// [1,10] de ADR-03 — es la que guía al atleta a repetir el intento con otra
// carga en vez de aceptar una estimación pobre.

import { calculateEpley } from "@/lib/rm/formulas";

export type ConfianzaRM = "alta" | "media" | "baja";

export type EstimacionRM = {
  /** Estimación puntual (fórmula primaria: Epley). */
  valor: number;
  confianza: ConfianzaRM;
  /** true si las repeticiones caen fuera de la ventana válida [1,10]. */
  fueraDeRango: boolean;
  /** true si la estimación no debe usarse para prescribir (r > 15, o r >= 30 bloqueado). */
  noUtilizable: boolean;
  /** Repeticiones usadas realmente por las fórmulas: reportadas + RIR (ADR-27). */
  repeticionesEfectivas: number;
};

/** Bloqueo duro: evita las singularidades de Brzycki/Lander (D-04). */
export const REPETICIONES_BLOQUEO_DURO = 30;
/** Ventana válida de referencia (ADR-03). */
export const REPETICIONES_VENTANA_VALIDA = { min: 1, max: 10 } as const;
/** Por encima de este umbral, la estimación deja de ser utilizable para prescribir. */
export const REPETICIONES_LIMITE_UTILIZABLE = 15;
/**
 * Ventana de precisión del test (ADR-28). Dentro de ella la fórmula está en
 * su mejor zona; fuera, el flujo pide repetir el intento con otra carga.
 */
export const VENTANA_OPTIMA_TEST = { min: 3, max: 8 } as const;
/** Repeticiones objetivo cuando hay que recalcular la carga del intento. */
export const REPETICIONES_OBJETIVO_TEST = 5;

function resolverConfianza(
  reps: number,
  rirReportado?: number | null,
): ConfianzaRM {
  if (reps <= 5 && typeof rirReportado === "number" && rirReportado <= 1) {
    return "alta";
  }

  if (reps <= REPETICIONES_VENTANA_VALIDA.max) {
    return "media";
  }

  return "baja";
}

function normalizarRir(rirReportado?: number | null): number {
  if (typeof rirReportado !== "number" || !Number.isFinite(rirReportado)) {
    return 0;
  }

  return Math.max(0, Math.floor(rirReportado));
}

/**
 * Estima el 1RM a partir de una serie submáxima.
 * Nunca lanza: con entradas inválidas devuelve una estimación en cero.
 */
export function estimarRm(
  carga: number,
  repeticiones: number,
  opciones: { sexo?: string; rirReportado?: number | null } = {},
): EstimacionRM {
  if (
    !Number.isFinite(carga) ||
    !Number.isFinite(repeticiones) ||
    carga < 0 ||
    repeticiones <= 0
  ) {
    return {
      valor: 0,
      confianza: "baja",
      fueraDeRango: true,
      noUtilizable: true,
      repeticionesEfectivas: 0,
    };
  }

  // ADR-27: las fórmulas trabajan sobre repeticiones "hasta el fallo". Si el
  // atleta reportó RIR, las que le quedaban cuentan igual.
  const rir = normalizarRir(opciones.rirReportado);
  const repeticionesEfectivas = repeticiones + rir;

  // Bloqueo duro: por encima de este umbral las fórmulas de Brzycki/Lander
  // cruzan su singularidad y producen valores negativos (D-04).
  if (repeticionesEfectivas >= REPETICIONES_BLOQUEO_DURO) {
    return {
      valor: 0,
      confianza: "baja",
      fueraDeRango: true,
      noUtilizable: true,
      repeticionesEfectivas,
    };
  }

  const valor = calculateEpley(carga, repeticionesEfectivas);

  const fueraDeRango =
    repeticionesEfectivas < REPETICIONES_VENTANA_VALIDA.min ||
    repeticionesEfectivas > REPETICIONES_VENTANA_VALIDA.max;
  const noUtilizable = repeticionesEfectivas > REPETICIONES_LIMITE_UTILIZABLE;

  // La confianza se resuelve sobre las repeticiones *reportadas*: describe la
  // calidad del dato que entregó el atleta, no la aritmética de la fórmula.
  const confianza = fueraDeRango
    ? "baja"
    : resolverConfianza(repeticiones, opciones.rirReportado);

  return {
    valor,
    confianza,
    fueraDeRango,
    noUtilizable,
    repeticionesEfectivas,
  };
}

/**
 * e1RM con RIR (F-03): estima 1RM desde una serie de entrenamiento sin test
 * dedicado. Solo válido si repeticiones + RIR <= 10 y RIR <= 3.
 */
export function estimarE1rmConRir(
  carga: number,
  repeticiones: number,
  rir: number,
): { valor: number; valido: boolean } {
  if (
    !Number.isFinite(carga) ||
    !Number.isFinite(repeticiones) ||
    !Number.isFinite(rir) ||
    carga < 0 ||
    repeticiones <= 0 ||
    rir < 0
  ) {
    return { valor: 0, valido: false };
  }

  const valido = repeticiones + rir <= 10 && rir <= 3;
  const valor = calculateEpley(carga, repeticiones + rir);

  return { valor, valido };
}

// ---------------------------------------------------------------------------
// Test adaptativo (ADR-28)
// ---------------------------------------------------------------------------

/**
 * Tren superior vs. inferior. La NSCA prescribe incrementos distintos entre
 * intentos según la masa muscular implicada, y la literatura (Nuzzo 2024)
 * confirma que la relación reps↔%1RM difiere por ejercicio.
 */
export type TrenEjercicio = "superior" | "inferior";

/** Incrementos NSCA entre intentos de un test, como fracción de la carga. */
export const INCREMENTO_ENTRE_INTENTOS: Record<
  TrenEjercicio,
  { min: number; max: number }
> = {
  superior: { min: 0.05, max: 0.1 },
  inferior: { min: 0.1, max: 0.2 },
};

/** Patrones de `Ejercicio.patron` que cuentan como tren inferior. */
const PATRONES_TREN_INFERIOR = new Set(["sentadilla", "bisagra"]);

export function resolverTren(patron?: string | null): TrenEjercicio {
  return typeof patron === "string" && PATRONES_TREN_INFERIOR.has(patron)
    ? "inferior"
    : "superior";
}

export type AjusteCarga = {
  /** "ninguno" = el intento cayó en la ventana óptima y sirve tal cual. */
  accion: "ninguno" | "subir" | "bajar" | "sin_datos";
  /** Carga sugerida para el siguiente intento, redondeada al incremento del equipo. */
  cargaSugerida: number;
  /** Diferencia respecto a la carga usada, en kg (con signo). */
  deltaKg: number;
  /** Texto listo para mostrar al atleta. */
  mensaje: string;
};

function redondearACargable(peso: number, incrementoMinimoKg: number): number {
  const incremento =
    Number.isFinite(incrementoMinimoKg) && incrementoMinimoKg > 0
      ? incrementoMinimoKg
      : 2.5;

  if (!Number.isFinite(peso) || peso <= 0) {
    return 0;
  }

  return Math.round(peso / incremento) * incremento;
}

/**
 * ADR-28: decide si el intento sirve o si hay que repetirlo con otra carga.
 *
 * La carga objetivo sale de invertir Epley hacia `REPETICIONES_OBJETIVO_TEST`,
 * pero el salto se acota a la banda NSCA del tren correspondiente para que un
 * solo intento nunca proponga un incremento mayor al recomendado.
 */
export function sugerirAjusteCarga(
  carga: number,
  repeticiones: number,
  opciones: {
    tren?: TrenEjercicio;
    incrementoMinimoKg?: number;
    rirReportado?: number | null;
  } = {},
): AjusteCarga {
  const sinDatos: AjusteCarga = {
    accion: "sin_datos",
    cargaSugerida: 0,
    deltaKg: 0,
    mensaje: "Registra el peso y las repeticiones para saber si el intento sirve.",
  };

  if (
    !Number.isFinite(carga) ||
    !Number.isFinite(repeticiones) ||
    carga <= 0 ||
    repeticiones <= 0
  ) {
    return sinDatos;
  }

  const tren = opciones.tren ?? "superior";
  const incrementoMinimoKg = opciones.incrementoMinimoKg ?? 2.5;
  const rir = normalizarRir(opciones.rirReportado);
  const repsEfectivas = repeticiones + rir;

  if (
    repsEfectivas >= VENTANA_OPTIMA_TEST.min &&
    repsEfectivas <= VENTANA_OPTIMA_TEST.max
  ) {
    return {
      accion: "ninguno",
      cargaSugerida: carga,
      deltaKg: 0,
      mensaje:
        rir > 0
          ? `Intento válido: ${repeticiones} repeticiones con ${rir} en reserva equivalen a ${repsEfectivas} al fallo, dentro de la ventana de ${VENTANA_OPTIMA_TEST.min}–${VENTANA_OPTIMA_TEST.max}.`
          : `Intento válido: ${repeticiones} repeticiones están dentro de la ventana de ${VENTANA_OPTIMA_TEST.min}–${VENTANA_OPTIMA_TEST.max}, donde la fórmula es más precisa.`,
    };
  }

  const banda = INCREMENTO_ENTRE_INTENTOS[tren];
  const subir = repsEfectivas > VENTANA_OPTIMA_TEST.max;

  // Carga que, según Epley, daría REPETICIONES_OBJETIVO_TEST repeticiones.
  const e1rm = calculateEpley(carga, repsEfectivas);
  const cargaIdeal = e1rm / (1 + 0.0333 * REPETICIONES_OBJETIVO_TEST);
  const factorIdeal = cargaIdeal / carga;

  // Se acota el salto a la banda NSCA (nunca menos del mínimo recomendado,
  // nunca más del máximo) y se redondea al incremento real del equipo.
  const factorAcotado = subir
    ? Math.min(Math.max(factorIdeal, 1 + banda.min), 1 + banda.max)
    : Math.max(Math.min(factorIdeal, 1 - banda.min), 1 - banda.max);

  const cargaSugerida = Math.max(
    incrementoMinimoKg,
    redondearACargable(carga * factorAcotado, incrementoMinimoKg),
  );
  const deltaKg = Math.round((cargaSugerida - carga) * 100) / 100;

  const detalleRir =
    rir > 0 ? ` (${repeticiones} + ${rir} en reserva)` : "";

  return {
    accion: subir ? "subir" : "bajar",
    cargaSugerida,
    deltaKg,
    mensaje: subir
      ? `${repsEfectivas} repeticiones${detalleRir} son demasiadas para estimar bien. Sube a ${cargaSugerida} kg, descansa 2–3 minutos y repite el intento.`
      : `${repsEfectivas} repeticiones${detalleRir} son muy pocas. Baja a ${cargaSugerida} kg, descansa 2–3 minutos y repite el intento.`,
  };
}

// ---------------------------------------------------------------------------
// Repetibilidad (ADR-29)
// ---------------------------------------------------------------------------

/**
 * CV mediano test–retest del 1RM (Grgic 2020, revisión sistemática de 32
 * estudios, n=1595): 4,2 %. ICC mediano 0,97.
 */
export const CV_TEST_RETEST_1RM = 0.042;

/**
 * Cambio mínimo detectable al 95 %: 1,96 · √2 · CV ≈ 11,6 % con CV = 4,2 %.
 * Por debajo de este umbral, una diferencia entre dos tests es ruido de
 * medición y no una mejora o pérdida real de fuerza.
 */
export const CAMBIO_MINIMO_DETECTABLE = 1.96 * Math.SQRT2 * CV_TEST_RETEST_1RM;

export type ComparacionRm = {
  deltaKg: number;
  deltaPorcentaje: number;
  /** true si el cambio supera el cambio mínimo detectable (señal, no ruido). */
  esCambioReal: boolean;
  direccion: "sube" | "baja" | "igual";
  mensaje: string;
};

/**
 * ADR-29: compara un RM nuevo contra el vigente y dice si la diferencia es
 * distinguible del error de medición. Sirve para avisar al entrenador antes
 * de que un mal día baje el RM que alimenta toda la prescripción.
 */
export function compararConRmVigente(
  rmNuevo: number,
  rmVigente: number | null | undefined,
): ComparacionRm | null {
  if (
    !Number.isFinite(rmNuevo) ||
    rmNuevo <= 0 ||
    typeof rmVigente !== "number" ||
    !Number.isFinite(rmVigente) ||
    rmVigente <= 0
  ) {
    return null;
  }

  const deltaKg = Math.round((rmNuevo - rmVigente) * 100) / 100;
  const deltaPorcentaje = (rmNuevo - rmVigente) / rmVigente;
  const magnitud = Math.abs(deltaPorcentaje);
  const esCambioReal = magnitud >= CAMBIO_MINIMO_DETECTABLE;
  const direccion = deltaKg > 0 ? "sube" : deltaKg < 0 ? "baja" : "igual";
  const porcentajeTexto = `${(magnitud * 100).toFixed(1)} %`;
  const umbralTexto = `${(CAMBIO_MINIMO_DETECTABLE * 100).toFixed(1)} %`;

  if (direccion === "igual") {
    return {
      deltaKg,
      deltaPorcentaje,
      esCambioReal: false,
      direccion,
      mensaje: "Mismo valor que el RM vigente.",
    };
  }

  return {
    deltaKg,
    deltaPorcentaje,
    esCambioReal,
    direccion,
    mensaje: esCambioReal
      ? `${direccion === "sube" ? "Sube" : "Baja"} ${porcentajeTexto} respecto al RM vigente: supera el ${umbralTexto} de error de medición, es un cambio real.`
      : `${direccion === "sube" ? "Sube" : "Baja"} ${porcentajeTexto}, por debajo del ${umbralTexto} de error típico entre dos tests. Puede ser ruido de medición, no un cambio de fuerza.`,
  };
}

// ---------------------------------------------------------------------------
// Orden de la batería de evaluación (ADR-34)
// ---------------------------------------------------------------------------

/**
 * La NSCA pide separar los tests de ejercicios distintos por 3–5 minutos y
 * evaluar primero los movimientos que implican más masa muscular: si la
 * sentadilla se testea al final, mide fatiga acumulada y no fuerza.
 *
 * Número menor = se evalúa antes.
 */
export const ORDEN_PATRON_EVALUACION: Record<string, number> = {
  sentadilla: 10,
  bisagra: 20,
  empuje_vertical: 30,
  traccion_vertical: 40,
  empuje_horizontal: 50,
  traccion_horizontal: 60,
  accesorio: 70,
  core: 80,
  cardio: 90,
};

const ORDEN_PATRON_DESCONOCIDO = 75;

export function ordenarParaEvaluacion<
  T extends { id: number; patron?: string | null; esDeTiempo?: boolean },
>(ejercicios: T[]): T[] {
  if (!Array.isArray(ejercicios)) {
    return [];
  }

  return [...ejercicios].sort((a, b) => {
    // Los ejercicios de tiempo (resistencia muscular) van siempre al final:
    // no producen RM y fatigan el core antes de los multiarticulares.
    const tiempoA = a.esDeTiempo ? 1 : 0;
    const tiempoB = b.esDeTiempo ? 1 : 0;
    if (tiempoA !== tiempoB) return tiempoA - tiempoB;

    const ordenA =
      ORDEN_PATRON_EVALUACION[a.patron ?? ""] ?? ORDEN_PATRON_DESCONOCIDO;
    const ordenB =
      ORDEN_PATRON_EVALUACION[b.patron ?? ""] ?? ORDEN_PATRON_DESCONOCIDO;
    if (ordenA !== ordenB) return ordenA - ordenB;

    return a.id - b.id;
  });
}

// Dominio de los protocolos de test **directo** de 1RM (Casas y Naclerio).
//
// Un test directo no estima: mide. Por eso todo lo que sale de aquí exige un
// peso realmente levantado y marcado como completado — nunca un peso teórico
// (D-05; ADR-30 lo extiende a Naclerio, donde seguía abierto).
//
// Ver docs/DECISIONES.md ADR-17 (origen de Casas), ADR-18/ADR-31 (Naclerio),
// ADR-30 (regla de peso real) y ADR-32 (límite de intentos máximos).

export type FaseProtocolo =
  | "calentamiento"
  | "aproximacion"
  | "maxima"
  | "intento_extra";

export type PasoProtocolo = {
  /** Número de paso, empezando en 1. */
  numero: number;
  nombre: string;
  fase: FaseProtocolo;
  /** Fracción del RM de referencia. 1 = 100 %. */
  porcentaje: number;
  /** Segundo extremo del rango, si el paso admite un rango de carga. */
  porcentajeMax?: number;
  /** Repeticiones objetivo del paso. */
  reps: number;
  descansoSeg: number;
  /** Qué debe sentir/hacer el atleta en este paso. Se muestra en la interfaz. */
  indicacion: string;
};

/** Un paso ya resuelto contra un RM de referencia y con lo que ocurrió. */
export type PasoEjecutado = PasoProtocolo & {
  pesoObjetivo: number;
  pesoObjetivoMax: number;
  pesoObjetivoLabel: string;
  /** Peso realmente cargado en la barra/máquina. */
  pesoReal: number;
  /** Repeticiones realmente completadas. */
  repsReales: number;
  /** ¿Se completó el levantamiento con técnica válida? Sin esto no cuenta. */
  completado: boolean;
  /** OMNI-RES 0–10 reportado al terminar el paso (opcional). */
  omniRes: number | null;
};

// ---------------------------------------------------------------------------
// Escala OMNI-RES (Robertson et al.), la que usa Naclerio en su protocolo
// ---------------------------------------------------------------------------

export const OMNI_RES_ESCALA: { valor: number; etiqueta: string }[] = [
  { valor: 0, etiqueta: "0 · Nada de esfuerzo" },
  { valor: 1, etiqueta: "1 · Muy muy fácil" },
  { valor: 2, etiqueta: "2 · Muy fácil" },
  { valor: 3, etiqueta: "3 · Fácil" },
  { valor: 4, etiqueta: "4 · Algo fácil" },
  { valor: 5, etiqueta: "5 · Moderado" },
  { valor: 6, etiqueta: "6 · Algo duro" },
  { valor: 7, etiqueta: "7 · Duro" },
  { valor: 8, etiqueta: "8 · Muy duro" },
  { valor: 9, etiqueta: "9 · Casi máximo" },
  { valor: 10, etiqueta: "10 · Máximo, no podía más" },
];

// ---------------------------------------------------------------------------
// Protocolo Casas
// ---------------------------------------------------------------------------

/**
 * ADR-17: los porcentajes y descansos son convención del proyecto, sin fuente
 * bibliográfica aportada todavía. Lo que sí se ajusta a la NSCA es la
 * estructura: aproximaciones decrecientes en repeticiones, descansos de 1–5
 * minutos, y el 1RM buscado dentro de los primeros intentos máximos.
 */
export const PASOS_CASAS: PasoProtocolo[] = [
  {
    numero: 1,
    nombre: "Fase específica",
    fase: "calentamiento",
    porcentaje: 0.4,
    porcentajeMax: 0.6,
    reps: 8,
    descansoSeg: 60,
    indicacion:
      "Calentamiento del patrón. Movimiento controlado, sin buscar esfuerzo.",
  },
  {
    numero: 2,
    nombre: "Preparación articular",
    fase: "calentamiento",
    porcentaje: 0.7,
    porcentajeMax: 0.8,
    reps: 5,
    descansoSeg: 180,
    indicacion: "Ya pesa. Técnica idéntica a la que usarás en los máximos.",
  },
  {
    numero: 3,
    nombre: "Preparación neuromuscular",
    fase: "aproximacion",
    porcentaje: 0.85,
    porcentajeMax: 0.9,
    reps: 3,
    descansoSeg: 300,
    indicacion: "Máxima velocidad de ejecución con carga alta.",
  },
  {
    numero: 4,
    nombre: "Máxima activación",
    fase: "aproximacion",
    porcentaje: 0.95,
    reps: 1,
    descansoSeg: 120,
    indicacion: "Última aproximación antes del intento real.",
  },
  {
    numero: 5,
    nombre: "Búsqueda del RM",
    fase: "maxima",
    porcentaje: 1,
    reps: 1,
    descansoSeg: 300,
    indicacion:
      "Primer intento máximo. Si lo completas con técnica válida, márcalo y sigue.",
  },
  {
    numero: 6,
    nombre: "Intento máximo 2",
    fase: "maxima",
    porcentaje: 1.025,
    reps: 1,
    descansoSeg: 300,
    indicacion: "Sube al incremento más pequeño que permita el equipo.",
  },
  {
    numero: 7,
    nombre: "Intento máximo 3",
    fase: "maxima",
    porcentaje: 1.05,
    reps: 1,
    descansoSeg: 300,
    indicacion:
      "Último intento recomendado. Más allá de aquí la fatiga arruina la medida.",
  },
];

// ---------------------------------------------------------------------------
// Protocolo Naclerio (test progresivo de cargas incrementales)
// ---------------------------------------------------------------------------

/**
 * ADR-31 — Naclerio & Figueroa (2004), test progresivo (TPR):
 *
 *   8 ± 2 series de 2–3 repeticiones ejecutadas con **máxima aceleración**,
 *   pausas de 2 a 5 minutos, y RPE OMNI-RES 0–10 registrado al final de cada
 *   serie. Series 1–2 al 35–50 %, 3–4 al 55–65 %, 5–6 al 70–80 %, 7–8 al
 *   85–95/100 %.
 *
 * Esto reemplaza la implementación anterior (peso inicial derivado de la
 * fuerza relativa + progresión lineal "KIES" + escalones hasta el 115,8 %
 * del RM tecleado a mano), que no correspondía a ningún protocolo publicado
 * y permitía registrar un RM que nadie había levantado.
 */
export const PASOS_NACLERIO: PasoProtocolo[] = [
  {
    numero: 1,
    nombre: "Serie 1 · carga ligera",
    fase: "calentamiento",
    porcentaje: 0.4,
    reps: 3,
    descansoSeg: 120,
    indicacion:
      "Tres repeticiones a la máxima velocidad que permita la técnica. Aquí se calienta el patrón, no se busca esfuerzo.",
  },
  {
    numero: 2,
    nombre: "Serie 2 · carga ligera",
    fase: "calentamiento",
    porcentaje: 0.5,
    reps: 3,
    descansoSeg: 120,
    indicacion: "Misma intención: acelerar al máximo cada repetición.",
  },
  {
    numero: 3,
    nombre: "Serie 3 · carga media",
    fase: "calentamiento",
    porcentaje: 0.55,
    reps: 3,
    descansoSeg: 180,
    indicacion: "La velocidad empieza a caer. Es normal y es el dato que interesa.",
  },
  {
    numero: 4,
    nombre: "Serie 4 · carga media",
    fase: "aproximacion",
    porcentaje: 0.65,
    reps: 3,
    descansoSeg: 180,
    indicacion: "Última serie de 3 repeticiones.",
  },
  {
    numero: 5,
    nombre: "Serie 5 · carga media-alta",
    fase: "aproximacion",
    porcentaje: 0.7,
    reps: 2,
    descansoSeg: 180,
    indicacion: "Dos repeticiones. Sigue acelerando al máximo.",
  },
  {
    numero: 6,
    nombre: "Serie 6 · carga media-alta",
    fase: "aproximacion",
    porcentaje: 0.8,
    reps: 2,
    descansoSeg: 240,
    indicacion: "Descanso largo antes de las series máximas.",
  },
  {
    numero: 7,
    nombre: "Serie 7 · carga casi máxima",
    fase: "maxima",
    porcentaje: 0.9,
    reps: 1,
    descansoSeg: 300,
    indicacion: "Una repetición. Si se completa con técnica válida, márcala.",
  },
  {
    numero: 8,
    nombre: "Serie 8 · carga máxima",
    fase: "maxima",
    porcentaje: 1,
    reps: 1,
    descansoSeg: 300,
    indicacion: "El RM estimado de partida. A partir de aquí se sube por incrementos reales.",
  },
];

// ---------------------------------------------------------------------------
// Intentos extra ("± 2" de Naclerio, "3–7 intentos" de la NSCA)
// ---------------------------------------------------------------------------

/**
 * ADR-32: la NSCA espera que el 1RM se alcance en 3–7 intentos, y Naclerio
 * define el test en 8 ± 2 series. Por eso se admiten como máximo 2 intentos
 * extra por encima del último paso del protocolo.
 *
 * Cada intento extra sube el **incremento real del equipo** (2,5 kg en una
 * barra estándar), no un porcentaje compuesto sobre un RM teórico: si el
 * atleta levantó 100 kg, el siguiente intento son 102,5 kg reales.
 */
export const MAX_INTENTOS_EXTRA = 2;

export function construirIntentosExtra(
  ultimoPesoObjetivo: number,
  incrementoMinimoKg: number,
  cantidad: number = MAX_INTENTOS_EXTRA,
): PasoProtocolo[] {
  const incremento =
    Number.isFinite(incrementoMinimoKg) && incrementoMinimoKg > 0
      ? incrementoMinimoKg
      : 2.5;

  if (!Number.isFinite(ultimoPesoObjetivo) || ultimoPesoObjetivo <= 0) {
    return [];
  }

  const total = Math.max(0, Math.min(cantidad, MAX_INTENTOS_EXTRA));

  return Array.from({ length: total }).map((_, indice) => ({
    numero: 0, // lo asigna quien los concatena
    nombre: `Intento extra ${indice + 1}`,
    fase: "intento_extra" as const,
    porcentaje:
      (ultimoPesoObjetivo + incremento * (indice + 1)) / ultimoPesoObjetivo,
    reps: 1,
    descansoSeg: 300,
    indicacion: `Solo si el intento anterior salió limpio. Sube ${incremento} kg reales, no un porcentaje.`,
  }));
}

// ---------------------------------------------------------------------------
// Resolución del RM medido
// ---------------------------------------------------------------------------

export type RmMedido = {
  /** Peso más alto levantado y marcado como completado. 0 si no hay ninguno. */
  valorKg: number;
  /** Número del paso del que salió. */
  pasoNumero: number | null;
  /** Intentos máximos registrados (completados o fallidos). */
  intentosMaximos: number;
  /** true cuando ya se superó el rango de intentos que la NSCA considera válido. */
  excedeIntentosRecomendados: boolean;
};

/** Intentos máximos por encima de los cuales la fatiga invalida la medida (NSCA 3–7). */
export const MAX_INTENTOS_MAXIMOS_RECOMENDADOS = 7;

/**
 * D-05 / ADR-30 — el RM medido sale **solo** de pesos reales marcados como
 * completados. Un peso objetivo, un intento fallido o una fila sin marcar no
 * pueden convertirse en el RM del atleta.
 */
export function resolverRmMedido(pasos: PasoEjecutado[]): RmMedido {
  const vacio: RmMedido = {
    valorKg: 0,
    pasoNumero: null,
    intentosMaximos: 0,
    excedeIntentosRecomendados: false,
  };

  if (!Array.isArray(pasos) || pasos.length === 0) {
    return vacio;
  }

  const intentosMaximos = pasos.filter(
    (paso) =>
      (paso.fase === "maxima" || paso.fase === "intento_extra") &&
      paso.pesoReal > 0,
  ).length;

  const validos = pasos.filter(
    (paso) =>
      paso.completado &&
      Number.isFinite(paso.pesoReal) &&
      paso.pesoReal > 0 &&
      paso.repsReales > 0,
  );

  if (validos.length === 0) {
    return {
      ...vacio,
      intentosMaximos,
      excedeIntentosRecomendados:
        intentosMaximos > MAX_INTENTOS_MAXIMOS_RECOMENDADOS,
    };
  }

  const mejor = validos.reduce((maximo, paso) =>
    paso.pesoReal > maximo.pesoReal ? paso : maximo,
  );

  return {
    valorKg: mejor.pesoReal,
    pasoNumero: mejor.numero,
    intentosMaximos,
    excedeIntentosRecomendados:
      intentosMaximos > MAX_INTENTOS_MAXIMOS_RECOMENDADOS,
  };
}

/**
 * Un RM medido sobre 1 repetición no necesita fórmula, pero si el atleta
 * completó más de una repetición en su mejor intento la medida sigue siendo
 * directa para esa carga: el 1RM se estima desde ahí. Devuelve las
 * repeticiones del mejor intento válido para que quien persista decida.
 */
export function repeticionesDelMejorIntento(pasos: PasoEjecutado[]): number {
  const validos = pasos.filter(
    (paso) => paso.completado && paso.pesoReal > 0 && paso.repsReales > 0,
  );

  if (validos.length === 0) {
    return 0;
  }

  return validos.reduce((maximo, paso) =>
    paso.pesoReal > maximo.pesoReal ? paso : maximo,
  ).repsReales;
}

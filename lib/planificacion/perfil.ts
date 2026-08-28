// ADR-37 · Perfil deportivo: cómo un mismo motor sirve a cualquier deporte.
//
// La evidencia es clara en que **ningún modelo de periodización es superior**:
// los meta-análisis dan diferencias pequeñas entre lineal, ondulante y por
// bloques (bloques algo mejor en avanzados, ondulante algo mejor para 1RM,
// sin diferencia en principiantes). Lo que la investigación 2019-2025 señala
// como determinante no es *qué* modelo, sino que exista variación
// estructurada en el tiempo.
//
// De ahí la decisión de diseño: no se pide el deporte por su nombre (hay
// cientos, no escala, y el nombre no es computable). Se piden tres
// descriptores que cualquier entrenador sabe responder y que sí cambian la
// estructura del plan — el *needs analysis* de la NSCA reducido a lo que
// realmente decide algo:
//
//   1. Capacidad dominante  → qué objetivo de bloque predomina
//   2. Estructura del calendario → periodización simple, doble o de temporada
//   3. Nivel del atleta     → si conviene carga concentrada o distribuida
//
// Lo universal (tres periodos, general→específico, alternancia
// carga/descarga, taper, transitorio) vive en el motor. Lo que varía por
// deporte entra por aquí.

import {
  ETAPA_DESCRIPCION,
  MESOCICLO_DESCRIPCION,
  MESES_POR_TIPO_LABEL,
  type TipoEtapa,
  type TipoMesociclo,
  type TipoPeriodo,
} from "@/lib/macrociclo";
import type { ObjetivoBloque } from "@/lib/config/parametros";
import type { NivelAtleta } from "./tipos";
import { distribuirSemanasPorMayorResto } from "./estructura";

// ---------------------------------------------------------------------------
// Los tres descriptores
// ---------------------------------------------------------------------------

export type CapacidadDominante =
  | "fuerza_potencia"
  | "resistencia"
  | "mixto_intermitente"
  | "tecnico_estetico";

export type EstructuraCalendario =
  | "pico_unico"
  | "doble_pico"
  | "temporada_larga"
  | "sin_competencia";

export type PerfilDeportivo = {
  capacidad: CapacidadDominante;
  calendario: EstructuraCalendario;
  nivel: NivelAtleta;
};

export const PERFIL_POR_DEFECTO: PerfilDeportivo = {
  capacidad: "mixto_intermitente",
  calendario: "sin_competencia",
  nivel: "beginner",
};

/** Catálogo para la interfaz: qué significa cada opción y a qué deportes aplica. */
export const CAPACIDADES: Array<{
  value: CapacidadDominante;
  label: string;
  descripcion: string;
  ejemplos: string;
}> = [
  {
    value: "fuerza_potencia",
    label: "Fuerza y potencia",
    descripcion:
      "El rendimiento depende de producir mucha fuerza en muy poco tiempo. Los esfuerzos son cortos y máximos, con descansos largos entre ellos.",
    ejemplos:
      "Halterofilia, powerlifting, lanzamientos, saltos, velocidad hasta 200 m, salto de esquí.",
  },
  {
    value: "resistencia",
    label: "Resistencia",
    descripcion:
      "El rendimiento depende de sostener un esfuerzo durante mucho tiempo. La fuerza importa, pero al servicio de la economía y la fatiga.",
    ejemplos:
      "Fondo y medio fondo, ciclismo de ruta, natación de distancia, triatlón, remo, marcha.",
  },
  {
    value: "mixto_intermitente",
    label: "Mixto o intermitente",
    descripcion:
      "Alternas esfuerzos intensos con recuperaciones incompletas durante un tiempo prolongado. Necesitas potencia y capacidad de repetirla.",
    ejemplos:
      "Fútbol, baloncesto, rugby, hockey, voleibol, tenis, deportes de combate, CrossFit.",
  },
  {
    value: "tecnico_estetico",
    label: "Técnico o estético",
    descripcion:
      "El resultado se juzga por la ejecución. La preparación física sostiene la técnica y previene lesiones, pero no es lo que se puntúa.",
    ejemplos:
      "Gimnasia artística y rítmica, clavados, patinaje artístico, tiro, arquería, danza deportiva, ecuestre.",
  },
];

/**
 * ADR-40 · La pregunta se formula desde lo que hace la persona ("¿compites en
 * algo?"), no desde el vocabulario de la periodización. Tres de las cuatro
 * opciones estaban redactadas desde dentro del mundo competitivo, lo que
 * dejaba sin respuesta a quien entrena por salud — que es justo el caso más
 * común. Los ejemplos incluyen deliberadamente casos no deportivos, porque
 * "una fecha en la que quiero rendir" no implica competir.
 */
export const ESTRUCTURAS_CALENDARIO: Array<{
  value: EstructuraCalendario;
  label: string;
  descripcion: string;
  ejemplos: string;
}> = [
  {
    value: "sin_competencia",
    label: "No compito",
    descripcion:
      "No hay un día que tengas que defender, así que las 24 semanas (o las que sean) se dedican íntegras a construir. Puedes fijar igualmente fechas que te importen: el plan las usa como hitos para medir tu progreso.",
    ejemplos:
      "Salud general, recomposición corporal, volver a entrenar, mantenerte en forma.",
  },
  {
    value: "pico_unico",
    label: "Tengo una fecha importante",
    descripcion:
      "Un solo día manda sobre todos los demás y quieres llegar en tu mejor momento. Todo el plan se construye hacia esa fecha y termina afinando para ella.",
    ejemplos:
      "Un campeonato, un maratón, una competencia de powerlifting, una prueba física de acceso.",
  },
  {
    value: "doble_pico",
    label: "Tengo dos fechas separadas",
    descripcion:
      "Dos momentos del año en los que quieres rendir, con meses de por medio. El plan se divide en dos ciclos completos: cada uno con su preparación, su fecha y su descanso.",
    ejemplos:
      "Temporada indoor y outdoor, dos campeonatos por semestre, dos carreras objetivo al año.",
  },
  {
    value: "temporada_larga",
    label: "Compito seguido durante meses",
    descripcion:
      "Tienes fechas cada semana o cada dos durante meses. La preparación es corta y el grueso del tiempo es sostener el rendimiento sin acumular fatiga.",
    ejemplos:
      "Liga de fútbol, baloncesto o voleibol, y cualquier calendario con partidos semanales.",
  },
];

/**
 * ADR-39 · La misma pregunta, para quien no practica un deporte. Los valores
 * son los mismos —el motor no cambia— pero preguntar "qué capacidad domina en
 * tu deporte" a alguien que entrena por salud no tiene respuesta posible.
 */
export const CAPACIDADES_SALUD: Array<{
  value: CapacidadDominante;
  label: string;
  descripcion: string;
  ejemplos: string;
}> = [
  {
    value: "fuerza_potencia",
    label: "Ganar fuerza",
    descripcion:
      "Quieres levantar más y ser más fuerte. El plan dedica más tiempo a los bloques de cargas altas y menos a los de volumen.",
    ejemplos:
      "Recuperar fuerza tras un parón, ganar masa muscular, envejecer con más fuerza funcional.",
  },
  {
    value: "resistencia",
    label: "Ganar resistencia",
    descripcion:
      "Quieres aguantar más y fatigarte menos. El plan alarga la base y reduce el trabajo de cargas máximas.",
    ejemplos:
      "Subir escaleras sin ahogarte, caminatas largas, salud cardiovascular, volver a correr.",
  },
  {
    value: "mixto_intermitente",
    label: "Mixto o equilibrado",
    descripcion:
      "No quieres inclinar el plan hacia ningún lado. Reparte el tiempo de forma pareja entre fuerza y base. Si no lo tienes claro, esta es la opción segura.",
    ejemplos:
      "Salud general, recomposición corporal, mantenerte en forma sin un objetivo concreto.",
  },
  {
    value: "tecnico_estetico",
    label: "Movilidad y control",
    descripcion:
      "Priorizas moverte bien, con control y sin dolor, por encima de las cifras. Más trabajo general y menos carga concentrada.",
    ejemplos:
      "Volver del dolor de espalda, mejorar postura y movilidad, retomar tras una lesión.",
  },
];

export const NIVELES: Array<{
  value: NivelAtleta;
  label: string;
  descripcion: string;
}> = [
  {
    value: "beginner",
    label: "Principiante",
    descripcion:
      "Menos de un año entrenando de forma estructurada. Progresa con casi cualquier estímulo, así que el plan evita bloques de carga concentrada.",
  },
  {
    value: "intermediate",
    label: "Intermedio",
    descripcion:
      "Uno a tres años de entrenamiento consistente. Ya necesita variación planificada para seguir progresando.",
  },
  {
    value: "advanced",
    label: "Avanzado",
    descripcion:
      "Más de tres años y cerca de su techo. Requiere cargas concentradas y bloques bien diferenciados para producir adaptación.",
  },
];

// ---------------------------------------------------------------------------
// Secuencias de bloques por estructura de calendario
// ---------------------------------------------------------------------------

type BloquePlantilla = {
  /** Identificador único: permite repetir un mismo tipo (doble pico). */
  id: string;
  tipo: TipoMesociclo;
  periodoId: string;
  periodoTipo: TipoPeriodo;
  etapaTipo: TipoEtapa;
  objetivoBloque: ObjetivoBloque;
  /** Peso relativo dentro del macrociclo, antes de ajustar por perfil. */
  peso: number;
};

/**
 * Prioridad de descarte cuando el macrociclo es demasiado corto para dar el
 * mínimo de semanas a todos los bloques. Se sacrifica primero lo accesorio
 * (carga concentrada, especificidad) y nunca la reentrada, la competencia ni
 * el transitorio.
 */
const PRIORIDAD_DESCARTE: TipoMesociclo[] = [
  "choque",
  "desarrollador_especifico",
  "precompetitivo",
  "estabilizador",
  "aproximacion",
  "desarrollador",
];

/**
 * Issurin sitúa los bloques en 2-4 semanas: los efectos residuales de un
 * bloque de acumulación duran 12-30 días, así que un bloque de 1 semana no
 * acumula nada. Antes, un macrociclo de 8 semanas generaba 8 bloques de 1
 * semana porque el repartidor solo garantizaba el mínimo de 1.
 */
export const SEMANAS_MINIMAS_BLOQUE = 2;
/** La semana de competencia sí puede ser única: es un evento, no un bloque. */
export const SEMANAS_MINIMAS_COMPETENCIA = 1;
/** Bompa: el transitorio dura 2-4 semanas, nunca más de 5. */
export const SEMANAS_TRANSITORIO = { min: 2, max: 4 } as const;

function secuencia(calendario: EstructuraCalendario): BloquePlantilla[] {
  switch (calendario) {
    case "sin_competencia":
      return [
        b("entrante", "prep", "preparatorio", "general", "resistencia_fuerza", 12),
        b("desarrollador", "prep", "preparatorio", "general", "hipertrofia", 26),
        b("desarrollador_especifico", "prep", "preparatorio", "especifica", "acumulacion", 24),
        b("estabilizador", "prep", "preparatorio", "especifica", "fuerza_maxima", 26),
        b("transitorio", "trans", "transitorio", "transitoria", "recuperacion", 12),
      ];

    case "pico_unico":
      return [
        b("entrante", "prep", "preparatorio", "general", "resistencia_fuerza", 10),
        b("desarrollador", "prep", "preparatorio", "general", "hipertrofia", 18),
        b("desarrollador_especifico", "prep", "preparatorio", "especifica", "acumulacion", 16),
        b("estabilizador", "prep", "preparatorio", "especifica", "fuerza_maxima", 16),
        b("precompetitivo", "comp", "competitivo", "precompetitiva", "realizacion", 12),
        b("choque", "comp", "competitivo", "precompetitiva", "potencia", 6),
        b("aproximacion", "comp", "competitivo", "competitiva", "realizacion", 10),
        b("competencia", "comp", "competitivo", "competitiva", "potencia", 6),
        b("transitorio", "trans", "transitorio", "transitoria", "recuperacion", 6),
      ];

    case "temporada_larga":
      return [
        b("entrante", "prep", "preparatorio", "general", "resistencia_fuerza", 8),
        b("desarrollador", "prep", "preparatorio", "general", "hipertrofia", 12),
        b("desarrollador_especifico", "prep", "preparatorio", "especifica", "acumulacion", 10),
        b("estabilizador", "prep", "preparatorio", "especifica", "fuerza_maxima", 8),
        b("precompetitivo", "comp", "competitivo", "precompetitiva", "realizacion", 8),
        b("competencia", "comp", "competitivo", "competitiva", "potencia", 30),
        // Mantenimiento intra-temporada: en una liga de 4-5 meses no se puede
        // competir sin volver a estimular la fuerza en algún momento.
        b("estabilizador_mantenimiento", "comp", "competitivo", "competitiva", "fuerza_maxima", 16, "estabilizador"),
        b("transitorio", "trans", "transitorio", "transitoria", "recuperacion", 8),
      ];

    case "doble_pico":
      return [
        b("entrante", "prep1", "preparatorio", "general", "resistencia_fuerza", 8),
        b("desarrollador", "prep1", "preparatorio", "general", "hipertrofia", 14),
        b("estabilizador", "prep1", "preparatorio", "especifica", "fuerza_maxima", 10),
        b("aproximacion_1", "comp1", "competitivo", "precompetitiva", "realizacion", 7, "aproximacion"),
        b("competencia_1", "comp1", "competitivo", "competitiva", "potencia", 5, "competencia"),
        b("transitorio_1", "trans1", "transitorio", "transitoria", "recuperacion", 4, "transitorio"),
        b("desarrollador_especifico", "prep2", "preparatorio", "especifica", "acumulacion", 14),
        b("precompetitivo", "prep2", "preparatorio", "especifica", "realizacion", 10),
        b("choque", "comp2", "competitivo", "precompetitiva", "potencia", 6),
        b("aproximacion_2", "comp2", "competitivo", "precompetitiva", "realizacion", 7, "aproximacion"),
        b("competencia_2", "comp2", "competitivo", "competitiva", "potencia", 6, "competencia"),
        b("transitorio_2", "trans2", "transitorio", "transitoria", "recuperacion", 9, "transitorio"),
      ];
  }
}

function b(
  id: string,
  periodoId: string,
  periodoTipo: TipoPeriodo,
  etapaTipo: TipoEtapa,
  objetivoBloque: ObjetivoBloque,
  peso: number,
  tipo?: TipoMesociclo,
): BloquePlantilla {
  return {
    id,
    tipo: (tipo ?? id) as TipoMesociclo,
    periodoId,
    periodoTipo,
    etapaTipo,
    objetivoBloque,
    peso,
  };
}

// ---------------------------------------------------------------------------
// Ajustes por capacidad dominante y nivel
// ---------------------------------------------------------------------------

/**
 * Multiplicadores sobre el peso de cada bloque según la capacidad dominante
 * del deporte. Son **convención del proyecto** derivada del principio de
 * especificidad (se concentra el tiempo en lo que el deporte demanda), no de
 * una tabla publicada — igual que ADR-17 con los porcentajes de Casas. Lo
 * que sí tiene respaldo es la estructura sobre la que actúan.
 */
const MULTIPLICADOR_CAPACIDAD: Record<
  CapacidadDominante,
  Partial<Record<ObjetivoBloque, number>>
> = {
  fuerza_potencia: {
    fuerza_maxima: 1.25,
    potencia: 1.25,
    resistencia_fuerza: 0.75,
    hipertrofia: 0.9,
  },
  resistencia: {
    resistencia_fuerza: 1.35,
    acumulacion: 1.2,
    hipertrofia: 1.05,
    potencia: 0.7,
    fuerza_maxima: 0.85,
  },
  mixto_intermitente: {
    potencia: 1.1,
    acumulacion: 1.05,
    resistencia_fuerza: 1.05,
  },
  tecnico_estetico: {
    resistencia_fuerza: 1.2,
    hipertrofia: 1.15,
    potencia: 0.8,
    fuerza_maxima: 0.9,
  },
};

function aplicarPerfil(
  bloques: BloquePlantilla[],
  perfil: PerfilDeportivo,
): { bloques: BloquePlantilla[]; avisos: string[] } {
  const avisos: string[] = [];
  const multiplicadores = MULTIPLICADOR_CAPACIDAD[perfil.capacidad];

  let ajustados = bloques.map((bloque) => ({
    ...bloque,
    peso: bloque.peso * (multiplicadores[bloque.objetivoBloque] ?? 1),
  }));

  // Nivel: la carga concentrada (choque) solo produce adaptación en atletas
  // que ya están cerca de su techo. En principiantes cualquier estímulo
  // ordenado funciona, así que ese bloque no compensa el riesgo.
  if (perfil.nivel === "beginner") {
    const tenia = ajustados.some((bloque) => bloque.tipo === "choque");
    if (tenia) {
      const pesoChoque = ajustados
        .filter((bloque) => bloque.tipo === "choque")
        .reduce((suma, bloque) => suma + bloque.peso, 0);

      ajustados = ajustados.filter((bloque) => bloque.tipo !== "choque");
      const desarrollador = ajustados.find(
        (bloque) => bloque.tipo === "desarrollador",
      );
      if (desarrollador) {
        desarrollador.peso += pesoChoque;
      }

      avisos.push(
        "Se omitió el bloque de choque: la carga concentrada solo aporta en atletas avanzados, y su tiempo se sumó al bloque desarrollador.",
      );
    }
  }

  if (perfil.nivel === "advanced") {
    ajustados = ajustados.map((bloque) =>
      bloque.tipo === "choque" ? { ...bloque, peso: bloque.peso * 1.2 } : bloque,
    );
  }

  return { bloques: ajustados, avisos };
}

// ---------------------------------------------------------------------------
// Estructura resultante
// ---------------------------------------------------------------------------

export type BloquePlan = {
  id: string;
  tipo: TipoMesociclo;
  nombre: string;
  descripcion: string;
  periodoId: string;
  periodoTipo: TipoPeriodo;
  etapaTipo: TipoEtapa;
  objetivoBloque: ObjetivoBloque;
  semanas: number;
  porcentaje: number;
  orden: number;
};

export type PeriodoPlan = {
  id: string;
  tipo: TipoPeriodo;
  semanas: number;
  porcentaje: number;
  orden: number;
  etapas: Array<{
    tipo: TipoEtapa;
    descripcion: string;
    semanas: number;
    porcentaje: number;
    orden: number;
  }>;
};

export type EstructuraPlan = {
  totalSemanas: number;
  bloques: BloquePlan[];
  periodos: PeriodoPlan[];
  /** Decisiones que el entrenador debe conocer (bloques omitidos, recortes). */
  avisos: string[];
  errores: string[];
};

/**
 * Objetivos de bloque que construyen capacidad. Un macrociclo que solo
 * reentrena y descansa no desarrolla nada: es un periodo de transición
 * disfrazado de plan, y conviene decirlo en vez de generarlo.
 */
const OBJETIVOS_DE_DESARROLLO: ObjetivoBloque[] = [
  "hipertrofia",
  "acumulacion",
  "fuerza_maxima",
  "realizacion",
  "potencia",
];

function desarrolla(bloque: { objetivoBloque: ObjetivoBloque }): boolean {
  return OBJETIVOS_DE_DESARROLLO.includes(bloque.objetivoBloque);
}

function minimoDe(bloque: BloquePlantilla): number {
  if (bloque.tipo === "competencia") return SEMANAS_MINIMAS_COMPETENCIA;
  if (bloque.tipo === "transitorio") return SEMANAS_TRANSITORIO.min;
  return SEMANAS_MINIMAS_BLOQUE;
}

/**
 * Construye la estructura completa del macrociclo desde el perfil y la
 * duración disponible.
 *
 * A diferencia del modelo anterior —donde periodos y mesociclos se repartían
 * como dos distribuciones porcentuales independientes sobre la misma línea de
 * tiempo, y podían no cuadrar entre sí— aquí los periodos y sus etapas se
 * **derivan** de la secuencia de bloques. Alinean por construcción.
 */
export function construirEstructura(
  perfil: PerfilDeportivo,
  totalSemanas: number,
): EstructuraPlan {
  const errores: string[] = [];

  if (!Number.isFinite(totalSemanas) || totalSemanas < 1) {
    return {
      totalSemanas: 0,
      bloques: [],
      periodos: [],
      avisos: [],
      errores: ["La duración del macrociclo debe ser de al menos una semana."],
    };
  }

  const { bloques: base, avisos } = aplicarPerfil(
    secuencia(perfil.calendario),
    perfil,
  );

  // 1 · El transitorio se reserva primero, en semanas absolutas: son 2-4 por
  // definición (Bompa), no un porcentaje de un plan que puede durar un año.
  const transitorios = base.filter((bloque) => bloque.tipo === "transitorio");
  const resto = base.filter((bloque) => bloque.tipo !== "transitorio");

  const semanasPorTransitorio = new Map<string, number>();
  let semanasReservadas = 0;

  for (const bloque of transitorios) {
    const proporcional = Math.round((totalSemanas * bloque.peso) / 100);
    const semanas = Math.max(
      SEMANAS_TRANSITORIO.min,
      Math.min(proporcional, SEMANAS_TRANSITORIO.max),
    );
    semanasPorTransitorio.set(bloque.id, semanas);
    semanasReservadas += semanas;
  }

  let disponibles = totalSemanas - semanasReservadas;

  // 2 · Si no queda nada para entrenar, el transitorio se recorta al mínimo
  // y, si aun así no cabe, se elimina: descansar sin haber entrenado no tiene
  // sentido.
  if (disponibles < resto.length && semanasReservadas > 0) {
    for (const bloque of transitorios) {
      semanasPorTransitorio.set(bloque.id, SEMANAS_TRANSITORIO.min);
    }
    semanasReservadas = transitorios.length * SEMANAS_TRANSITORIO.min;
    disponibles = totalSemanas - semanasReservadas;
  }

  if (disponibles < 1) {
    semanasPorTransitorio.clear();
    semanasReservadas = 0;
    disponibles = totalSemanas;
    avisos.push(
      "El macrociclo es demasiado corto para incluir un periodo transitorio. Considera alargarlo: terminar sin descanso activo acelera la pérdida de lo ganado.",
    );
  }

  // 3 · Se descartan bloques por prioridad hasta que cada superviviente pueda
  // recibir su mínimo de semanas.
  const activos = [...resto];
  const omitidos: BloquePlantilla[] = [];

  const cabe = () =>
    activos.reduce((suma, bloque) => suma + minimoDe(bloque), 0) <= disponibles;

  for (const tipoDescartable of PRIORIDAD_DESCARTE) {
    if (cabe()) break;

    for (let i = activos.length - 1; i >= 0; i -= 1) {
      if (cabe()) break;
      if (activos[i].tipo === tipoDescartable) {
        omitidos.push(activos[i]);
        activos.splice(i, 1);
      }
    }
  }

  if (cabe() && !activos.some(desarrolla)) {
    errores.push(
      `Con ${totalSemanas} semanas solo caben la reentrada y el descanso: no queda espacio para ningún bloque que desarrolle capacidad. Un macrociclo necesita al menos ${semanasMinimasPara(perfil)} semanas.`,
    );
    return { totalSemanas, bloques: [], periodos: [], avisos, errores };
  }

  if (!cabe()) {
    // Quedan solo bloques irrenunciables y siguen sin caber.
    errores.push(
      `Con ${totalSemanas} semanas no cabe una estructura mínima (${activos.length} bloques necesitan al menos ${activos.reduce((s, bl) => s + minimoDe(bl), 0)} semanas). Alarga el macrociclo.`,
    );
    return {
      totalSemanas,
      bloques: [],
      periodos: [],
      avisos,
      errores,
    };
  }

  for (const bloque of omitidos) {
    avisos.push(
      `Se omitió el bloque «${MESES_POR_TIPO_LABEL[bloque.tipo]}»: no caben ${SEMANAS_MINIMAS_BLOQUE} semanas para él sin dejar sin espacio a los bloques esenciales. Un bloque de una sola semana no produce adaptación.`,
    );
  }

  // 4 · Reparto del resto por peso, garantizando el mínimo de cada bloque.
  const semanasExtra =
    disponibles - activos.reduce((suma, bloque) => suma + minimoDe(bloque), 0);

  const distribuido =
    semanasExtra > 0
      ? distribuirSemanasPorMayorResto(
          semanasExtra,
          activos.map((bloque) => ({
            id: bloque.id,
            tipo: bloque.tipo,
            porcentaje: bloque.peso,
          })),
          { minimoPorItem: 0 },
        )
      : activos.map((bloque) => ({ id: bloque.id, tipo: bloque.tipo, semanas: 0 }));

  const extraPorId = new Map(
    distribuido.map((item) => [item.id ?? item.tipo, item.semanas]),
  );

  // 5 · Bloques finales, en el orden de la secuencia original.
  const bloques: BloquePlan[] = [];
  let orden = 0;

  for (const bloque of base) {
    if (omitidos.some((omitido) => omitido.id === bloque.id)) continue;

    const semanas =
      bloque.tipo === "transitorio"
        ? (semanasPorTransitorio.get(bloque.id) ?? 0)
        : minimoDe(bloque) + (extraPorId.get(bloque.id) ?? 0);

    if (semanas <= 0) continue;

    orden += 1;
    bloques.push({
      id: bloque.id,
      tipo: bloque.tipo,
      nombre: MESES_POR_TIPO_LABEL[bloque.tipo],
      descripcion: MESOCICLO_DESCRIPCION[bloque.tipo],
      periodoId: bloque.periodoId,
      periodoTipo: bloque.periodoTipo,
      etapaTipo: bloque.etapaTipo,
      objetivoBloque: bloque.objetivoBloque,
      semanas,
      porcentaje: Math.round((semanas / totalSemanas) * 1000) / 10,
      orden,
    });
  }

  // 6 · Periodos y etapas derivados de los bloques: alinean por construcción.
  const periodos: PeriodoPlan[] = [];

  for (const bloque of bloques) {
    let periodo = periodos.find((item) => item.id === bloque.periodoId);
    if (!periodo) {
      periodo = {
        id: bloque.periodoId,
        tipo: bloque.periodoTipo,
        semanas: 0,
        porcentaje: 0,
        orden: periodos.length + 1,
        etapas: [],
      };
      periodos.push(periodo);
    }

    periodo.semanas += bloque.semanas;

    let etapa = periodo.etapas.find((item) => item.tipo === bloque.etapaTipo);
    if (!etapa) {
      etapa = {
        tipo: bloque.etapaTipo,
        descripcion: ETAPA_DESCRIPCION[bloque.etapaTipo],
        semanas: 0,
        porcentaje: 0,
        orden: periodo.etapas.length + 1,
      };
      periodo.etapas.push(etapa);
    }
    etapa.semanas += bloque.semanas;
  }

  for (const periodo of periodos) {
    periodo.porcentaje = Math.round((periodo.semanas / totalSemanas) * 1000) / 10;
    for (const etapa of periodo.etapas) {
      etapa.porcentaje =
        periodo.semanas > 0
          ? Math.round((etapa.semanas / periodo.semanas) * 1000) / 10
          : 0;
    }
  }

  return { totalSemanas, bloques, periodos, avisos, errores };
}

/**
 * Duración mínima viable para un perfil, para poder avisar al entrenador
 * antes de que elija fechas imposibles.
 */
export function semanasMinimasPara(perfil: PerfilDeportivo): number {
  const { bloques } = aplicarPerfil(secuencia(perfil.calendario), perfil);
  const esenciales = bloques.filter(
    (bloque) => !PRIORIDAD_DESCARTE.includes(bloque.tipo),
  );

  const base = esenciales.reduce((suma, bloque) => suma + minimoDe(bloque), 0);

  // Si entre los bloques irrenunciables no hay ninguno que desarrolle, hay
  // que reservar sitio para el mejor candidato descartable.
  if (esenciales.some(desarrolla)) {
    return base;
  }

  const candidato = bloques
    .filter((bloque) => desarrolla(bloque) && PRIORIDAD_DESCARTE.includes(bloque.tipo))
    .sort((a, b) => b.peso - a.peso)[0];

  return base + (candidato ? minimoDe(candidato) : 0);
}

/**
 * ADR-39 · Un plan sin competencia trata sus fechas como hitos a medir, no
 * como días a defender.
 */
export function modoCalendarioDe(perfil: PerfilDeportivo) {
  return perfil.calendario === "sin_competencia"
    ? ("objetivo" as const)
    : ("competencia" as const);
}

export function isCapacidadDominante(
  value: unknown,
): value is CapacidadDominante {
  return CAPACIDADES.some((item) => item.value === value);
}

export function isEstructuraCalendario(
  value: unknown,
): value is EstructuraCalendario {
  return ESTRUCTURAS_CALENDARIO.some((item) => item.value === value);
}

export function isNivelAtleta(value: unknown): value is NivelAtleta {
  return NIVELES.some((item) => item.value === value);
}

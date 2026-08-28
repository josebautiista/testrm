// ADR-38 · Taper y semanas de evaluación dentro del macrociclo.
//
// El taper es, con diferencia, la intervención con mejor evidencia de toda la
// periodización: el meta-análisis de Bosquet (27 estudios) encontró que
// reducir el volumen entre un 41 % y un 60 % durante ~2 semanas, **sin tocar
// intensidad ni frecuencia**, mejora el rendimiento en torno a un 2,2 %.
// Recortar más de un 60 % empeora el resultado, y mantener la intensidad pesa
// más que mantener el volumen.
//
// Hasta ahora la app tenía mesociclos llamados "aproximación" y "competencia"
// pero nada que implementara la reducción: eran etiquetas.
//
// Este módulo también coloca las semanas de evaluación. `TipoMicrociclo`
// incluía "evaluacion" desde el principio, pero `asignarMicrociclos` no lo
// producía nunca: era un valor muerto del tipo.

import { DELOAD } from "@/lib/config/parametros";
import type { TipoMesociclo, TipoMicrociclo } from "@/lib/macrociclo";
import { asignarMicrociclos } from "./estructura";
import { SEMANAS_TRANSITORIO } from "./perfil";

/** Bosquet: la ventana óptima de taper es de 8 a 14 días. */
export const SEMANAS_TAPER = { min: 1, max: 2 } as const;

/**
 * Factor de volumen por semana de taper, de la más lejana a la más cercana a
 * competir. Corresponde a reducciones del 30 % y del 55 %: la segunda cae en
 * el centro de la ventana 41-60 % de Bosquet, y la progresión decreciente
 * reproduce el descenso exponencial que el meta-análisis encontró superior al
 * escalonado.
 */
export const FACTORES_VOLUMEN_TAPER = [0.7, 0.45] as const;

/**
 * La intensidad **no** se toca durante el taper. Es el hallazgo central de la
 * literatura y el error más común al afinar.
 */
export const FACTOR_INTENSIDAD_TAPER = 1;

/** Retest cada 8-12 semanas es la recomendación habitual de seguimiento. */
export const FRECUENCIA_EVALUACION_SEMANAS = 10;

/** Una semana de test no es una semana de carga: se descuenta volumen. */
export const FACTOR_VOLUMEN_EVALUACION = 0.6;

export type SemanaParaResolver = {
  numeroSemana: number;
  mesocicloTipo: TipoMesociclo;
  fechaInicio: Date;
  fechaFin: Date;
};

export type CompetenciaPlan = {
  fecha: Date;
  importancia: "principal" | "secundaria";
  nombre?: string;
};

/**
 * ADR-39 · Un plan de salud también tiene fechas que importan —un chequeo
 * médico, un viaje, una caminata larga— y merecen aparecer en el calendario.
 * Pero no son competencias, así que no se tratan igual:
 *
 * - `"competencia"`: la semana de la fecha es competitiva (se compite, no se
 *   entrena) y una fecha principal recibe las 2 semanas de taper completo.
 * - `"objetivo"`: la semana de la fecha es de **evaluación** (se mide justo
 *   cuando importa) y una fecha principal recibe **una** semana de
 *   afinamiento. Bajar algo el volumen antes de una fecha en la que quieres
 *   rendir tiene sentido aunque no compitas; un taper completo de dos
 *   semanas sería desproporcionado sin una competencia detrás.
 */
export type ModoCalendario = "competencia" | "objetivo";

export type MicrocicloResuelto = {
  numeroSemana: number;
  tipoMicrociclo: TipoMicrociclo;
  esDeload: boolean;
  factorVolumen: number;
  factorIntensidad: number;
  /** Por qué esta semana es lo que es. Se muestra tal cual en la interfaz. */
  motivo: string;
};

export type OpcionesMicrociclos = {
  frecuenciaDeload?: number;
  competencias?: CompetenciaPlan[];
  /** ADR-39 · Cómo tratar las fechas del calendario. Por defecto, competencias. */
  modoCalendario?: ModoCalendario;
  /** Desactiva la colocación automática de semanas de evaluación. */
  sinEvaluaciones?: boolean;
};

/** Semanas de afinamiento según el tipo de fecha y su importancia. */
export function semanasDeAfinamiento(
  importancia: CompetenciaPlan["importancia"],
  modo: ModoCalendario,
): number {
  if (modo === "objetivo") {
    return importancia === "principal" ? 1 : 0;
  }

  return importancia === "principal" ? SEMANAS_TAPER.max : SEMANAS_TAPER.min;
}

function diaDe(fecha: Date): number {
  return Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function diaDeFechaPlana(fecha: Date): number {
  return Date.UTC(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth(),
    fecha.getUTCDate(),
  );
}

/** Índice de la semana que contiene la fecha, o -1. */
function semanaDeFecha(
  semanas: SemanaParaResolver[],
  fecha: Date,
): number {
  const objetivo = diaDeFechaPlana(fecha);
  return semanas.findIndex(
    (semana) =>
      diaDe(semana.fechaInicio) <= objetivo && diaDe(semana.fechaFin) >= objetivo,
  );
}

const FACTOR_VOLUMEN_DELOAD =
  (DELOAD.volumenFactorMin + DELOAD.volumenFactorMax) / 2;
const FACTOR_INTENSIDAD_DELOAD =
  (DELOAD.intensidadFactorMin + DELOAD.intensidadFactorMax) / 2;

/**
 * Resuelve el tipo de cada semana del macrociclo y sus factores de carga.
 *
 * Precedencia, de mayor a menor: competencia > taper > evaluación > descarga
 * programada > tipo base del mesociclo. Una semana de competencia no se
 * convierte en descarga, y un taper no se pisa con un deload: el taper *es*
 * la reducción planificada.
 */
export function resolverMicrociclos(
  semanas: SemanaParaResolver[],
  opciones: OpcionesMicrociclos = {},
): MicrocicloResuelto[] {
  if (!Array.isArray(semanas) || semanas.length === 0) {
    return [];
  }

  const base = asignarMicrociclos(
    semanas.map((semana) => ({
      numeroSemana: semana.numeroSemana,
      mesocicloTipo: semana.mesocicloTipo,
    })),
    opciones.frecuenciaDeload,
  );

  const resultado: MicrocicloResuelto[] = base.map((item, indice) => ({
    numeroSemana: item.numeroSemana,
    tipoMicrociclo: item.tipoMicrociclo,
    esDeload: item.esDeload,
    factorVolumen: item.esDeload ? FACTOR_VOLUMEN_DELOAD : 1,
    factorIntensidad: item.esDeload ? FACTOR_INTENSIDAD_DELOAD : 1,
    motivo: item.esDeload
      ? "Semana de descarga programada: se reduce el volumen para asimilar lo entrenado antes de volver a cargar."
      : `Semana de trabajo del bloque ${semanas[indice].mesocicloTipo.replace(/_/g, " ")}.`,
  }));

  // --- Evaluaciones -------------------------------------------------------
  if (!opciones.sinEvaluaciones) {
    const indicesEvaluacion = new Set<number>([0]);

    for (
      let indice = FRECUENCIA_EVALUACION_SEMANAS;
      indice < semanas.length - 1;
      indice += FRECUENCIA_EVALUACION_SEMANAS
    ) {
      indicesEvaluacion.add(indice);
    }

    // Evaluación final: la última semana del plan, para poder comparar contra
    // la inicial y cerrar el macrociclo con un dato, no con una impresión.
    if (semanas.length > 1) {
      indicesEvaluacion.add(semanas.length - 1);
    }

    for (const indice of indicesEvaluacion) {
      const semana = resultado[indice];
      if (!semana) continue;

      const esInicial = indice === 0;
      const esFinal = indice === semanas.length - 1;

      semana.tipoMicrociclo = "evaluacion";
      semana.esDeload = false;
      semana.factorVolumen = FACTOR_VOLUMEN_EVALUACION;
      semana.factorIntensidad = 1;
      semana.motivo = esInicial
        ? "Evaluación inicial: se mide de dónde partes. Todas las cargas del plan salen de aquí."
        : esFinal
          ? "Evaluación final: se vuelve a medir para comparar con el punto de partida y decidir el siguiente macrociclo."
          : `Evaluación de control: se remide cada ${FRECUENCIA_EVALUACION_SEMANAS} semanas para ajustar las cargas a tu estado real.`;
    }
  }

  // --- Taper --------------------------------------------------------------
  const competencias = (opciones.competencias ?? []).filter(
    (competencia) =>
      competencia.fecha instanceof Date &&
      !Number.isNaN(competencia.fecha.getTime()),
  );

  const modo: ModoCalendario = opciones.modoCalendario ?? "competencia";

  for (const competencia of competencias) {
    const indiceCompetencia = semanaDeFecha(semanas, competencia.fecha);
    if (indiceCompetencia === -1) continue;

    // Solo las fechas principales justifican un afinamiento completo: afinar
    // para cada fecha secundaria de una temporada larga significa no entrenar
    // nunca.
    const semanasTaper = semanasDeAfinamiento(competencia.importancia, modo);

    for (let paso = 1; paso <= semanasTaper; paso += 1) {
      const indice = indiceCompetencia - paso;
      if (indice < 0) continue;

      const semana = resultado[indice];
      if (!semana || semana.tipoMicrociclo === "competitivo") continue;
      // Una evaluación inicial no se convierte en taper.
      if (indice === 0) continue;

      // `paso` cuenta hacia atrás desde la competencia: paso 1 es la semana
      // pegada a ella, y es la que lleva el recorte más agresivo. Por eso se
      // indexa desde el final del array.
      const factor =
        FACTORES_VOLUMEN_TAPER[
          Math.max(0, FACTORES_VOLUMEN_TAPER.length - paso)
        ];

      semana.tipoMicrociclo = "taper";
      semana.esDeload = false;
      semana.factorVolumen = factor;
      semana.factorIntensidad = FACTOR_INTENSIDAD_TAPER;
      semana.motivo = `Afinamiento a ${paso} ${
        paso === 1 ? "semana" : "semanas"
      } de ${
        competencia.nombre ?? (modo === "objetivo" ? "tu fecha objetivo" : "la competencia")
      }: el volumen baja un ${Math.round(
        (1 - factor) * 100,
      )} % y la intensidad se mantiene intacta. Vas a entrenar menos, no más suave.`;
    }

    const semanaFecha = resultado[indiceCompetencia];
    if (semanaFecha) {
      semanaFecha.esDeload = false;
      semanaFecha.factorIntensidad = 1;

      if (modo === "objetivo") {
        // La fecha objetivo se mide: es lo que la vuelve útil como hito.
        semanaFecha.tipoMicrociclo = "evaluacion";
        semanaFecha.factorVolumen = FACTOR_VOLUMEN_EVALUACION;
        semanaFecha.motivo = `Fecha objetivo: ${
          competencia.nombre ?? "tu meta"
        }. Se evalúa esta semana para que veas dónde llegaste justo cuando te importa.`;
      } else {
        semanaFecha.tipoMicrociclo = "competitivo";
        semanaFecha.factorVolumen = 0.4;
        semanaFecha.motivo = `Semana de ${
          competencia.nombre ?? "competencia"
        }: el entrenamiento solo sostiene la forma, no la construye.`;
      }
    }
  }

  return resultado;
}

/**
 * Comprueba que cada competencia principal tenga espacio real para afinar.
 * Devuelve avisos legibles, no errores: competir sin taper es subóptimo, no
 * inválido.
 */
export function revisarTaper(
  semanas: SemanaParaResolver[],
  competencias: CompetenciaPlan[],
  modo: ModoCalendario = "competencia",
): string[] {
  const avisos: string[] = [];
  const etiqueta = modo === "objetivo" ? "fecha objetivo" : "competencia";

  for (const competencia of competencias) {
    const indice = semanaDeFecha(semanas, competencia.fecha);
    const nombre = competencia.nombre ?? `la ${etiqueta}`;

    if (indice === -1) {
      avisos.push(
        `${nombre} cae fuera del rango de fechas del macrociclo, así que no se puede planificar nada alrededor de esa fecha.`,
      );
      continue;
    }

    const necesarias = semanasDeAfinamiento(competencia.importancia, modo);
    if (necesarias > 0 && indice < necesarias) {
      avisos.push(
        `${nombre} está en la semana ${indice + 1}: no hay espacio para ${necesarias} ${
          necesarias === 1 ? "semana" : "semanas"
        } de afinamiento antes. Se afinará con lo que haya.`,
      );
    }
  }

  return avisos;
}

/**
 * M-04/ADR-41 · El periodo transitorio va **después** de competir, no antes.
 *
 * El asistente igualaba la fecha final del macrociclo a la de la competencia,
 * así que el transitorio —que se reserva al final del plan— caía encima de
 * las semanas de taper y de la propia competencia: el bloque decía "descanso
 * activo" mientras la semana decía "afinar y competir". El resultado era que
 * un macrociclo de competencia nunca llegaba a tener transitorio real.
 *
 * Devuelve `null` si hay espacio suficiente.
 */
export function revisarEspacioTransitorio(
  fechaFin: Date,
  competencias: CompetenciaPlan[],
  modo: ModoCalendario = "competencia",
): { aviso: string; fechaFinSugerida: Date } | null {
  const principales = competencias.filter(
    (competencia) =>
      competencia.importancia === "principal" &&
      competencia.fecha instanceof Date &&
      !Number.isNaN(competencia.fecha.getTime()),
  );

  if (principales.length === 0) {
    return null;
  }

  const ultima = principales.reduce((maxima, competencia) =>
    competencia.fecha > maxima.fecha ? competencia : maxima,
  );

  const MS_SEMANA = 7 * 24 * 60 * 60 * 1000;
  // Se normalizan ambas fechas con el mismo criterio: el resultado es una
  // diferencia, así que cualquier desplazamiento de zona horaria se cancela
  // mientras las dos entradas vengan del mismo origen (las dos del formulario
  // o las dos de la base de datos).
  const semanasDespues = (diaDe(fechaFin) - diaDe(ultima.fecha)) / MS_SEMANA;

  if (semanasDespues >= SEMANAS_TRANSITORIO.min) {
    return null;
  }

  // Se sugiere el punto medio de la ventana 2-4 semanas de Bompa.
  const semanasSugeridas = Math.round(
    (SEMANAS_TRANSITORIO.min + SEMANAS_TRANSITORIO.max) / 2,
  );
  const fechaFinSugerida = new Date(
    diaDe(ultima.fecha) + semanasSugeridas * MS_SEMANA,
  );

  const etiqueta = modo === "objetivo" ? "tu fecha objetivo" : "tu competencia";

  return {
    fechaFinSugerida,
    aviso: `El macrociclo termina menos de ${SEMANAS_TRANSITORIO.min} semanas después de ${
      ultima.nombre ?? etiqueta
    }, así que no queda sitio para el periodo transitorio y este acabaría cayendo encima de las semanas de afinamiento. Alarga la fecha final hasta el ${fechaFinSugerida.toISOString().slice(0, 10)} para dejar ${semanasSugeridas} semanas de descanso activo después.`,
  };
}

/**
 * ADR-44 · Factores de carga que corresponden a un tipo de semana.
 *
 * `resolverMicrociclos` los calcula al decidir el tipo. Pero si el entrenador
 * cambia el tipo a mano, hay que poder derivarlos otra vez: una semana
 * marcada como taper con factor de volumen 1 no sería un taper, sería una
 * etiqueta — exactamente el problema que ADR-38 vino a corregir.
 */
export function factoresPorTipoMicrociclo(tipo: TipoMicrociclo): {
  factorVolumen: number;
  factorIntensidad: number;
  esDeload: boolean;
} {
  switch (tipo) {
    case "taper":
      // El recorte más agresivo de la ventana de Bosquet, que es el que se
      // aplica en la semana pegada a competir.
      return {
        factorVolumen: FACTORES_VOLUMEN_TAPER[FACTORES_VOLUMEN_TAPER.length - 1],
        factorIntensidad: FACTOR_INTENSIDAD_TAPER,
        esDeload: false,
      };
    case "recuperacion":
      return {
        factorVolumen: FACTOR_VOLUMEN_DELOAD,
        factorIntensidad: FACTOR_INTENSIDAD_DELOAD,
        esDeload: true,
      };
    case "evaluacion":
      return {
        factorVolumen: FACTOR_VOLUMEN_EVALUACION,
        factorIntensidad: 1,
        esDeload: false,
      };
    case "competitivo":
      return { factorVolumen: 0.4, factorIntensidad: 1, esDeload: false };
    default:
      return { factorVolumen: 1, factorIntensidad: 1, esDeload: false };
  }
}

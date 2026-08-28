export type ObjetivoTipo = "salud" | "competencia";
export type EstadoMacrociclo = "borrador" | "activo" | "cerrado" | "eliminado";
/**
 * ADR-37 · El plan anual estándar tiene **tres** periodos, no dos. El
 * transitorio (descanso activo tras competir) faltaba: sin él, terminar un
 * macrociclo era un corte seco, y el corte seco produce desentrenamiento
 * medible en menos de 4 semanas.
 */
export type TipoPeriodo = "preparatorio" | "competitivo" | "transitorio";
export type TipoEtapa =
  | "general"
  | "especifica"
  | "precompetitiva"
  | "competitiva"
  | "transitoria";
export type TipoMesociclo =
  | "entrante"
  | "desarrollador"
  | "desarrollador_especifico"
  | "estabilizador"
  | "precompetitivo"
  | "choque"
  | "aproximacion"
  | "competencia"
  | "transitorio";
export type TipoMicrociclo =
  | "evaluacion"
  | "corriente"
  | "competitivo"
  | "precompetitivo"
  | "choque"
  | "recuperacion"
  | "aproximacion"
  /** ADR-38 · Semana de afinamiento previa a competir: volumen recortado, intensidad intacta. */
  | "taper";
export type MetodoVo2max = "leger" | "cooper";
export type UserType = "persona" | "admin";

export const OBJETIVOS: { value: ObjetivoTipo; label: string }[] = [
  { value: "salud", label: "Salud" },
  { value: "competencia", label: "Competencia" },
];

export const TIPOS_PERIODO: { value: TipoPeriodo; label: string }[] = [
  { value: "preparatorio", label: "Preparatorio" },
  { value: "competitivo", label: "Competitivo" },
];

export const ETAPAS_POR_PERIODO: Record<TipoPeriodo, TipoEtapa[]> = {
  preparatorio: ["general", "especifica"],
  competitivo: ["precompetitiva", "competitiva"],
  transitorio: ["transitoria"],
};

export const MESES_POR_ETAPA_LABEL: Record<TipoEtapa, string> = {
  general: "General",
  especifica: "Específica",
  precompetitiva: "Precompetitiva",
  competitiva: "Competitiva",
  transitoria: "Transitoria",
};

/** Qué se persigue en cada etapa, en lenguaje de atleta. */
export const ETAPA_DESCRIPCION: Record<TipoEtapa, string> = {
  general:
    "Construir la base: mucho volumen, poca especificidad. Es la etapa que sostiene todo lo demás.",
  especifica:
    "El trabajo se parece cada vez más a tu deporte. Baja el volumen general y sube la intensidad.",
  precompetitiva:
    "Ajuste fino antes de competir. Se mantiene la intensidad y se recorta el volumen acumulado.",
  competitiva:
    "Periodo de competencias. El entrenamiento sostiene el rendimiento, ya no lo construye.",
  transitoria:
    "Descanso activo. Ni parar del todo ni seguir entrenando fuerte: se mantiene el 40-50 % del volumen para no perder lo ganado.",
};

export const MESES_POR_TIPO_LABEL: Record<TipoMesociclo, string> = {
  entrante: "Entrante",
  desarrollador: "Desarrollador",
  desarrollador_especifico: "Desarrollador específico",
  estabilizador: "Estabilizador",
  precompetitivo: "Precompetitivo",
  choque: "Choque",
  aproximacion: "Aproximación",
  competencia: "Competencia",
  transitorio: "Transitorio",
};

/** Para qué sirve cada bloque, en lenguaje de atleta. */
export const MESOCICLO_DESCRIPCION: Record<TipoMesociclo, string> = {
  entrante:
    "Reentrada. Volumen moderado y cargas bajas para volver a la rutina sin lesionarte.",
  desarrollador:
    "El bloque que más masa y capacidad de trabajo construye. Volumen alto.",
  desarrollador_especifico:
    "Mismo volumen alto, pero con ejercicios más parecidos a tu deporte.",
  estabilizador:
    "Se consolida lo ganado y sube la intensidad. Menos volumen, más carga.",
  precompetitivo:
    "Trabajo casi de competencia. Alta intensidad, volumen contenido.",
  choque:
    "Bloque de carga concentrada, deliberadamente exigente. Nunca dos semanas de choque seguidas.",
  aproximacion:
    "Afinamiento: se recorta volumen y se mantiene la intensidad para llegar fresco.",
  competencia: "Semanas de competir. El entrenamiento solo sostiene la forma.",
  transitorio:
    "Descanso activo después de competir. Mantiene un mínimo de actividad para no desentrenarte.",
};

export const ORDEN_MESES: TipoMesociclo[] = [
  "entrante",
  "desarrollador",
  "desarrollador_especifico",
  "estabilizador",
  "precompetitivo",
  "choque",
  "aproximacion",
  "competencia",
  "transitorio",
];

export const TIPOS_MICROCICLO: { value: TipoMicrociclo; label: string }[] = [
  { value: "evaluacion", label: "Evaluación" },
  { value: "corriente", label: "Corriente" },
  { value: "competitivo", label: "Competitivo" },
  { value: "precompetitivo", label: "Precompetitivo" },
  { value: "choque", label: "Choque" },
  { value: "recuperacion", label: "Recuperación" },
  { value: "aproximacion", label: "Aproximación" },
  { value: "taper", label: "Taper" },
];

/** Qué significa cada tipo de semana para quien la ejecuta. */
export const MICROCICLO_DESCRIPCION: Record<TipoMicrociclo, string> = {
  evaluacion:
    "Semana de medición: se testea para saber dónde estás, no para acumular carga.",
  corriente: "Semana de trabajo estándar del bloque.",
  competitivo: "Semana con competencia. La prioridad es competir, no entrenar.",
  precompetitivo: "Semana de ajuste previa a competir: alta intensidad, volumen bajo.",
  choque: "Semana deliberadamente dura, por encima de lo habitual.",
  recuperacion:
    "Semana de descarga: volumen e intensidad reducidos para asimilar lo entrenado.",
  aproximacion: "Semana de acercamiento a la competencia.",
  taper:
    "Afinamiento: se recorta el volumen entre 41 % y 60 % y se mantienen la intensidad y la frecuencia. Es lo que hace que llegues fresco sin perder forma.",
};

export type MedidasSnapshot = {
  metadata?: {
    nombre?: string;
    evaluador?: string;
    edad?: number;
    genero?: string;
    deporte?: string;
    fechaEvaluacion?: string;
  };
  medidasBasicas?: {
    masaCorporalKg?: number;
    tallaCm?: number;
    tallaSentadoCm?: number;
    envergaduraBrazosCm?: number;
  };
  pliegues?: {
    tricepsMm?: number;
    subescapularMm?: number;
    bicepsMm?: number;
    crestaIliacaMm?: number;
    supraespinalMm?: number;
    abdominalMm?: number;
    musloMm?: number;
    piernaMm?: number;
  };
  perimetros?: {
    brazoRelajadoCm?: number;
    brazoFlexionadoContraidoCm?: number;
    cinturaCm?: number;
    caderaCm?: number;
    musloMedioCm?: number;
    piernaCm?: number;
  };
  diametros?: {
    humeroCm?: number;
    biestiloideoCm?: number;
    femurCm?: number;
  };
  composicionCorporal?: {
    masaGrasaKg?: number;
    masaLibreGrasaKg?: number;
    tejidoAdiposoKg?: number;
    tejidoMuscularKg?: number;
    tejidoOseoKg?: number;
  };
  adiposidad?: {
    sumatorio6PlieguesMm?: number;
    sumatorio8PlieguesMm?: number;
  };
  distribucionAdiposoMuscular?: {
    masaGrasa?: {
      superiorPct?: number;
      centralPct?: number;
      inferiorPct?: number;
    };
    tejidoMuscular?: {
      brazoPct?: number;
      musloPct?: number;
      piernaPct?: number;
    };
  };
  indicesSalud?: {
    indiceCinturaCadera?: number;
    indiceConicidad?: number;
    indiceCinturaTalla?: number;
    imc?: number;
  };
  extractedDataRaw?: Record<string, unknown>;
};

export type Vo2maxSnapshot =
  | {
      metodo: "cooper";
      distanciaMetros: number;
      valor: number;
    }
  | {
      metodo: "leger";
      etapa: number;
      velocidadKmh: number;
      valor: number;
    };

export type PeriodoInput = {
  tipo: TipoPeriodo;
  porcentaje: number;
};

export type EtapaInput = {
  tipo: TipoEtapa;
  porcentaje: number;
};

export type MesocicloInput = {
  tipo: TipoMesociclo;
  porcentaje: number;
};

export type SemanaEjercicioInput = {
  ejercicioId: number;
  formulaRm: string;
  rm: number;
  peso: number;
  volumen: number;
};

export type SemanaInput = {
  numeroSemana: number;
  tipoMicrociclo: TipoMicrociclo;
  frecuencia: number;
  series: number;
  repeticiones: number;
  volumen: number;
  intensidad: number;
  notas?: string;
  ejercicios: SemanaEjercicioInput[];
};

export type PeriodoCalculado = {
  tipo: TipoPeriodo;
  porcentaje: number;
  fechaInicio: Date;
  fechaFin: Date;
  orden: number;
  etapas: EtapaCalculada[];
};

export type EtapaCalculada = {
  tipo: TipoEtapa;
  porcentaje: number;
  fechaInicio: Date;
  fechaFin: Date;
  orden: number;
};

export type MesocicloCalculado = {
  tipo: TipoMesociclo;
  porcentaje: number;
  fechaInicio: Date;
  fechaFin: Date;
  orden: number;
  semanas: SemanaCalculada[];
};

export type SemanaCalculada = {
  numeroSemana: number;
  mesCalendario: number;
  fechaInicio: Date;
  fechaFin: Date;
  tipoMicrociclo: TipoMicrociclo;
  frecuencia: number;
  series: number;
  repeticiones: number;
  volumen: number;
  intensidad: number;
  notas?: string;
  ejercicios: SemanaEjercicioInput[];

  // ADR-43 · Contexto derivado de la semana. Es lo que permite proponer su
  // configuración de carga en vez de pedirla campo a campo: sin saber a qué
  // bloque pertenece ni en qué posición del bloque está, no hay nada que
  // suponer.
  /** Objetivo del bloque al que pertenece (fuerza_maxima, hipertrofia, …). */
  objetivoBloque?: string;
  /** Posición dentro de su bloque, 1-indexada, y tamaño del bloque. */
  indiceEnBloque?: number;
  totalSemanasBloque?: number;
  /** Factores de carga ya resueltos (descarga, taper, evaluación). */
  factorVolumen?: number;
  factorIntensidad?: number;
  esDeload?: boolean;
};

export function isObjetivoTipo(value: string): value is ObjetivoTipo {
  return value === "salud" || value === "competencia";
}

export function isTipoPeriodo(value: string): value is TipoPeriodo {
  return (
    value === "preparatorio" ||
    value === "competitivo" ||
    value === "transitorio"
  );
}

export function isTipoEtapa(value: string): value is TipoEtapa {
  return [
    "general",
    "especifica",
    "precompetitiva",
    "competitiva",
    "transitoria",
  ].includes(value);
}

export function isTipoMesociclo(value: string): value is TipoMesociclo {
  return ORDEN_MESES.includes(value as TipoMesociclo);
}

export function isTipoMicrociclo(value: string): value is TipoMicrociclo {
  return TIPOS_MICROCICLO.some((item) => item.value === value);
}

export function isMetodoVo2max(value: string): value is MetodoVo2max {
  return ["leger", "cooper"].includes(value);
}

// Test de Léger (course-navette 20 m): la etapa 1 inicia en 8.5 km/h
// y cada etapa siguiente aumenta 0.5 km/h.
export function velocidadLegerKmh(etapa: number): number {
  return 8.5 + 0.5 * (etapa - 1);
}

// VO2max estimado (ml/kg/min) según Léger & Lambert.
export function calcularVo2maxLeger(etapa: number): number {
  const velocidad = velocidadLegerKmh(etapa);
  return 5.857 * velocidad - 19.458;
}

export function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function diasEntre(inicio: Date, fin: Date): number {
  const msPorDia = 1000 * 60 * 60 * 24;
  const inicioUtc = Date.UTC(
    inicio.getFullYear(),
    inicio.getMonth(),
    inicio.getDate(),
  );
  const finUtc = Date.UTC(fin.getFullYear(), fin.getMonth(), fin.getDate());
  return Math.floor((finUtc - inicioUtc) / msPorDia);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Pasos del asistente de macrociclo (ADR-42)
// ---------------------------------------------------------------------------

/**
 * Número de cada paso del asistente, en un único sitio.
 *
 * Estaban repetidos como literales en `actions/macrociclo.ts` (redirecciones),
 * `services/macrociclo.service.ts` (`pasoActual`), el propio asistente y la
 * página de edición. Al insertar el paso de Perfil y fusionar los tres de
 * porcentajes en uno (ADR-37), la numeración cambió y esos literales quedaron
 * apuntando al paso equivocado: guardar la sesión de RM devolvía al usuario al
 * paso anterior en vez de avanzar.
 */
export const PASO_WIZARD = {
  objetivo: 1,
  perfil: 2,
  rm: 3,
  vo2max: 4,
  estructura: 5,
  semanas: 6,
  carga: 7,
  revision: 8,
} as const;

export type PasoWizard = (typeof PASO_WIZARD)[keyof typeof PASO_WIZARD];

export const TOTAL_PASOS_WIZARD = Object.keys(PASO_WIZARD).length;

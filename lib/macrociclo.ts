export type ObjetivoTipo = "salud" | "competencia";
export type EstadoMacrociclo = "borrador" | "activo" | "cerrado" | "eliminado";
export type TipoPeriodo = "preparatorio" | "competitivo";
export type TipoEtapa =
  | "general"
  | "especifica"
  | "precompetitiva"
  | "competitiva";
export type TipoMesociclo =
  | "entrante"
  | "desarrollador"
  | "desarrollador_especifico"
  | "estabilizador"
  | "precompetitivo"
  | "choque"
  | "aproximacion"
  | "competencia";
export type TipoMicrociclo =
  | "evaluacion"
  | "corriente"
  | "competitivo"
  | "precompetitivo"
  | "choque"
  | "recuperacion"
  | "aproximacion";
export type MetodoVo2max = "leger" | "cooper" | "directo";
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
};

export const MESES_POR_PERIODO: Record<TipoPeriodo, string[]> = {
  preparatorio: ["general", "especifica"],
  competitivo: ["precompetitiva", "competitiva"],
};

export const MESES_POR_ETAPA_LABEL: Record<TipoEtapa, string> = {
  general: "General",
  especifica: "Específica",
  precompetitiva: "Precompetitiva",
  competitiva: "Competitiva",
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
];

export const TIPOS_MICROCICLO: { value: TipoMicrociclo; label: string }[] = [
  { value: "evaluacion", label: "Evaluación" },
  { value: "corriente", label: "Corriente" },
  { value: "competitivo", label: "Competitivo" },
  { value: "precompetitivo", label: "Precompetitivo" },
  { value: "choque", label: "Choque" },
  { value: "recuperacion", label: "Recuperación" },
  { value: "aproximacion", label: "Aproximación" },
];

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
      metodo: "directo";
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
};

export function isObjetivoTipo(value: string): value is ObjetivoTipo {
  return value === "salud" || value === "competencia";
}

export function isTipoPeriodo(value: string): value is TipoPeriodo {
  return value === "preparatorio" || value === "competitivo";
}

export function isTipoEtapa(value: string): value is TipoEtapa {
  return ["general", "especifica", "precompetitiva", "competitiva"].includes(
    value,
  );
}

export function isTipoMesociclo(value: string): value is TipoMesociclo {
  return ORDEN_MESES.includes(value as TipoMesociclo);
}

export function isTipoMicrociclo(value: string): value is TipoMicrociclo {
  return TIPOS_MICROCICLO.some((item) => item.value === value);
}

export function isMetodoVo2max(value: string): value is MetodoVo2max {
  return ["leger", "cooper", "directo"].includes(value);
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

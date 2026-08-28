// M5 · Motor de planificación — tipos compartidos del dominio puro.
// lib/planificacion/** no importa Prisma ni nada de services/**: recibe un
// ContextoPlanificacion y devuelve una PropuestaPlan (objeto puro, sin
// persistir). Ver §6.2 y §9.3 de docs/PLAN-MAESTRO.md.

import type {
  TipoEtapa,
  TipoMesociclo,
  TipoMicrociclo,
  TipoPeriodo,
} from "@/lib/macrociclo";
import type { ObjetivoBloque, ProgresionBloque } from "@/lib/config/parametros";
import type { PerfilDeportivo } from "./perfil";

export type NivelAtleta = "beginner" | "intermediate" | "advanced";
export type ConfianzaRm = "alta" | "media" | "baja";
export type ObjetivoTipo = "salud" | "competencia";

export type AtletaContexto = {
  nivel: NivelAtleta;
  sexo: string;
  edad: number;
  masaCorporal: number;
  mesesEntrenamiento: number;
  limitaciones?: string | null;
};

export type CompetenciaContexto = {
  fecha: Date;
  importancia: "principal" | "secundaria";
  nombre?: string;
};

export type ObjetivoContexto = {
  tipo: ObjetivoTipo;
  fechaInicio: Date;
  fechaFin: Date;
  fechaCompetencia?: Date | null;
  /**
   * ADR-37 · Perfil deportivo. Sin él, el motor usa un perfil por defecto
   * derivado de `tipo` (salud → sin competencia, competencia → pico único).
   */
  perfil?: PerfilDeportivo;
  /** ADR-38 · Calendario real de competencias, para colocar el taper. */
  competencias?: CompetenciaContexto[];
};

export type DisponibilidadContexto = {
  diasPorSemana: number;
  minutosPorSesion: number;
  /** Vacío = sin restricción de equipo (se asume todo disponible). */
  equipamiento: string[];
};

export type RmVigenteContexto = {
  rmVigenteId: number;
  ejercicioId: number;
  valorKg: number;
  confianza: ConfianzaRm;
  validoDesde: Date;
};

export type EjercicioCatalogo = {
  id: number;
  nombre: string;
  patron: string;
  musculoPrimario: string;
  equipamiento: string;
  incrementoMinimoKg: number;
  admitePorcentajeRm: boolean;
  esDeTiempo: boolean;
  esUnilateral: boolean;
  activo: boolean;
  enBateriaEvaluacion: boolean;
};

/** R-12: una prescripción ya publicada que el entrenador tocó queda anclada. */
export type OverridePrescripcion = {
  numeroSemana: number;
  ejercicioId: number;
  sesionOrden: number;
};

export type ContextoPlanificacion = {
  atleta: AtletaContexto;
  objetivo: ObjetivoContexto;
  disponibilidad: DisponibilidadContexto;
  rmVigentes: RmVigenteContexto[];
  catalogo: EjercicioCatalogo[];
  /** Regeneración parcial (§6.3): semanas con fechaFin < fechaCorte no se tocan. */
  fechaCorte?: Date;
  /** R-12: prescripciones ya ajustadas a mano que el motor no debe recalcular. */
  overrides?: OverridePrescripcion[];
};

export type EtapaPropuesta = {
  tipo: TipoEtapa;
  porcentaje: number;
  fechaInicio: Date;
  fechaFin: Date;
  orden: number;
};

export type PeriodoPropuesto = {
  tipo: TipoPeriodo;
  porcentaje: number;
  fechaInicio: Date;
  fechaFin: Date;
  orden: number;
  etapas: EtapaPropuesta[];
};

export type MesocicloPropuesto = {
  tipo: TipoMesociclo;
  porcentaje: number;
  fechaInicio: Date;
  fechaFin: Date;
  orden: number;
  objetivoBloque: ObjetivoBloque;
  progresion: ProgresionBloque;
  intensidadMinPct: number;
  intensidadMaxPct: number;
  repsMin: number;
  repsMax: number;
  rirObjetivo: number;
  seriesSemanalesPorPatron: Record<string, number>;
};

export type PrescripcionPropuesta = {
  ejercicioId: number;
  orden: number;
  series: number;
  repeticionesObjetivo: number;
  repsMin: number;
  repsMax: number;
  porcentajeRm: number | null;
  rirObjetivo: number;
  cargaKg: number | null;
  rmUsadoKg: number | null;
  rmVigenteId: number | null;
  formulaRm: string | null;
  descansoSeg: number;
  tonelaje: number;
  origen: "generado" | "ajustado_entrenador";
};

export type SesionPropuesta = {
  orden: number;
  enfoque: string;
  duracionEstimadaMin: number;
  prescripciones: PrescripcionPropuesta[];
};

export type SemanaPropuesta = {
  numeroSemana: number;
  mesocicloOrden: number;
  mesCalendario: number;
  fechaInicio: Date;
  fechaFin: Date;
  tipoMicrociclo: TipoMicrociclo;
  esDeload: boolean;
  factorVolumen: number;
  factorIntensidad: number;
  sesiones: SesionPropuesta[];
};

export type PropuestaPlan = {
  fechaInicio: Date;
  fechaFin: Date;
  totalSemanas: number;
  periodos: PeriodoPropuesto[];
  mesociclos: MesocicloPropuesto[];
  semanas: SemanaPropuesta[];
  /** R-15 y otros avisos no bloqueantes (RM caducado, ejercicio sin RM, etc.). */
  avisos: string[];
  /** R-16: violaciones de invariantes. Si no está vacío, el plan no se publica (ver validacion.ts). */
  errores: string[];
};

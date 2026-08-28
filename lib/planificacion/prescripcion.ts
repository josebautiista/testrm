// TASK-030 · Prescripción: selección de ejercicios, volumen, intensidad y
// carga (R-01 a R-07). El módulo más grande del motor — es deliberadamente
// una cadena de funciones pequeñas y puras para poder testear cada regla
// por separado (§16.1).
import {
  AJUSTE_UMBRALES,
  FRECUENCIA,
  RANGOS_VOLUMEN,
  redondearAIncremento,
  ZONAS_INTENSIDAD,
  type ObjetivoBloque,
  type ProgresionBloque,
  type ZonaIntensidad,
} from "@/lib/config/parametros";
import type {
  ConfianzaRm,
  DisponibilidadContexto,
  EjercicioCatalogo,
  PrescripcionPropuesta,
  RmVigenteContexto,
  SesionPropuesta,
} from "./tipos";

void AJUSTE_UMBRALES; // reservado para lib/progresion/reglas.ts (Bloque K)
void FRECUENCIA; // reservado para la división de sesiones (ver seleccionarPatronesPorSesion)

function lerp(min: number, max: number, ratio: number): number {
  const r = Math.min(1, Math.max(0, ratio));
  return min + (max - min) * r;
}

/** Posición relativa [0,1] de una semana dentro de su bloque (para R-08). */
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
  zona: ZonaIntensidad,
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

const ORDEN_CONFIANZA: Record<ConfianzaRm, number> = { alta: 3, media: 2, baja: 1 };

/**
 * R-01: selección de ejercicios por patrón de movimiento (no por nombre),
 * priorizando el de mayor confianza de RM vigente y equipamiento disponible.
 * "cardio" queda fuera del alcance de fuerza de este motor.
 */
export function seleccionarEjerciciosPorPatron(
  catalogo: EjercicioCatalogo[],
  equipamientoDisponible: string[],
  rmVigentes: RmVigenteContexto[],
): EjercicioCatalogo[] {
  const rmPorEjercicio = new Map(rmVigentes.map((r) => [r.ejercicioId, r]));
  const patrones = [...new Set(catalogo.map((e) => e.patron))].filter(
    (patron) => patron !== "cardio",
  );
  const seleccion: EjercicioCatalogo[] = [];

  for (const patron of patrones) {
    const candidatos = catalogo.filter(
      (e) =>
        e.patron === patron &&
        e.activo &&
        (equipamientoDisponible.length === 0 ||
          e.equipamiento === "peso_corporal" ||
          equipamientoDisponible.includes(e.equipamiento)),
    );

    if (candidatos.length === 0) continue;

    const ordenados = [...candidatos].sort((a, b) => {
      const confA = ORDEN_CONFIANZA[rmPorEjercicio.get(a.id)?.confianza ?? "baja"];
      const confB = ORDEN_CONFIANZA[rmPorEjercicio.get(b.id)?.confianza ?? "baja"];
      return confB - confA;
    });

    seleccion.push(ordenados[0]);
  }

  return seleccion;
}

/** Descanso por defecto según a qué zona de intensidad apunta el bloque. */
function descansoSegPorObjetivo(objetivoBloque: ObjetivoBloque): number {
  switch (objetivoBloque) {
    case "fuerza_maxima":
    case "realizacion":
    case "potencia":
      return 180;
    case "resistencia_fuerza":
      return 60;
    default:
      return 90;
  }
}

/** Punto medio de un rango de repeticiones, redondeado — usado como repeticionesObjetivo. */
function repeticionesObjetivo(repsMin: number, repsMax: number): number {
  return Math.round((repsMin + repsMax) / 2);
}

export type CalcularPrescripcionInput = {
  ejercicio: EjercicioCatalogo;
  orden: number;
  objetivoBloque: ObjetivoBloque;
  progresion: ProgresionBloque;
  indiceSemanaEnBloque: number;
  totalSemanasBloque: number;
  esDeload: boolean;
  factorVolumenDeload: number;
  factorIntensidadDeload: number;
  rmVigente: RmVigenteContexto | undefined;
};

/**
 * R-05/R-06/F-04: calcula una prescripción individual. Sin RM vigente (o si
 * el ejercicio no admite %1RM — esDeTiempo), se prescribe por reps/RIR sin
 * carga; nunca se extrapola el RM de otro ejercicio (R-06).
 */
export function calcularPrescripcion(input: CalcularPrescripcionInput): PrescripcionPropuesta {
  const zona = ZONAS_INTENSIDAD[input.objetivoBloque];
  const rango = RANGOS_VOLUMEN[input.objetivoBloque];

  let intensidadPct = calcularIntensidadObjetivoPct(
    zona,
    input.progresion,
    input.indiceSemanaEnBloque,
    input.totalSemanasBloque,
  );
  let series = calcularSeriesObjetivo(
    rango,
    input.progresion,
    input.indiceSemanaEnBloque,
    input.totalSemanasBloque,
  );

  if (input.esDeload) {
    intensidadPct *= input.factorIntensidadDeload;
    series = Math.max(1, Math.round(series * input.factorVolumenDeload));
  }

  const reps = repeticionesObjetivo(zona.repsMin, zona.repsMax);
  const rirObjetivo = Math.round((zona.rirMin + zona.rirMax) / 2);
  const descansoSeg = descansoSegPorObjetivo(input.objetivoBloque);

  const puedeUsarPorcentajeRm = input.ejercicio.admitePorcentajeRm && !input.ejercicio.esDeTiempo;
  const rmVigente = puedeUsarPorcentajeRm ? input.rmVigente : undefined;

  const cargaKg = rmVigente
    ? redondearAIncremento(
        (rmVigente.valorKg * intensidadPct) / 100,
        input.ejercicio.incrementoMinimoKg,
      )
    : null;

  return {
    ejercicioId: input.ejercicio.id,
    orden: input.orden,
    series,
    repeticionesObjetivo: reps,
    repsMin: Math.round(zona.repsMin),
    repsMax: Math.round(zona.repsMax),
    porcentajeRm: rmVigente ? Math.round(intensidadPct * 10) / 10 : null,
    rirObjetivo,
    cargaKg,
    rmUsadoKg: rmVigente ? rmVigente.valorKg : null,
    rmVigenteId: rmVigente ? rmVigente.rmVigenteId : null,
    formulaRm: rmVigente ? "epley" : null,
    descansoSeg,
    tonelaje: cargaKg !== null ? series * reps * cargaKg : 0,
    origen: "generado",
  };
}

/**
 * R-02: reparte los ejercicios seleccionados en `diasPorSemana` sesiones.
 * <=2 días -> cuerpo completo (todas las sesiones cubren todos los
 * patrones); 3-4 -> división simple torso/pierna; >=5 -> una sesión por
 * patrón dominante. Heurística intencionalmente simple — se revisa con
 * datos reales del entrenador (Q-05).
 */
function agruparPorDia(
  ejercicios: EjercicioCatalogo[],
  diasPorSemana: number,
): EjercicioCatalogo[][] {
  const dias = Math.max(1, Math.min(7, Math.round(diasPorSemana)));

  if (dias <= FRECUENCIA.diasParaCuerpoCompleto) {
    return Array.from({ length: dias }, () => ejercicios);
  }

  const patronesPierna = new Set(["sentadilla", "bisagra"]);
  const pierna = ejercicios.filter((e) => patronesPierna.has(e.patron));
  const torso = ejercicios.filter((e) => !patronesPierna.has(e.patron));

  if (dias <= FRECUENCIA.diasParaTorsoPierna) {
    return Array.from({ length: dias }, (_, i) => (i % 2 === 0 ? torso : pierna));
  }

  // División por patrón: se reparten los ejercicios entre las sesiones en
  // round-robin, asegurando que cada patrón aparezca en el ciclo semanal.
  const grupos: EjercicioCatalogo[][] = Array.from({ length: dias }, () => []);
  ejercicios.forEach((ejercicio, index) => {
    grupos[index % dias].push(ejercicio);
  });
  return grupos.map((grupo) => (grupo.length > 0 ? grupo : ejercicios));
}

/** Estimación gruesa de minutos por serie (trabajo + descanso). Reutilizada por validacion.ts (invariante #8). */
export const MINUTOS_POR_SERIE_ESTIMADO = 4;

const PATRONES_ACCESORIOS = new Set(["accesorio", "core"]);

/** R-14: si el volumen no cabe en el presupuesto de minutos, se recorta primero el trabajo accesorio (nunca por debajo de 1 serie), y solo después el principal. */
function ajustarAlPresupuestoDeTiempo(
  prescripciones: PrescripcionPropuesta[],
  ejerciciosPorOrden: Map<number, EjercicioCatalogo>,
  minutosPorSesion: number,
): PrescripcionPropuesta[] {
  const presupuestoSeries = Math.floor(minutosPorSesion / MINUTOS_POR_SERIE_ESTIMADO);
  let totalSeries = prescripciones.reduce((sum, p) => sum + p.series, 0);

  if (totalSeries <= presupuestoSeries) {
    return prescripciones;
  }

  const ajustadas = prescripciones.map((p) => ({ ...p }));
  const esAccesorio = (p: PrescripcionPropuesta) =>
    PATRONES_ACCESORIOS.has(ejerciciosPorOrden.get(p.orden)?.patron ?? "");

  for (const soloAccesorios of [true, false]) {
    for (const p of ajustadas) {
      while (
        totalSeries > presupuestoSeries &&
        p.series > 1 &&
        esAccesorio(p) === soloAccesorios
      ) {
        p.series -= 1;
        p.tonelaje = p.cargaKg !== null ? p.series * p.repeticionesObjetivo * p.cargaKg : 0;
        totalSeries -= 1;
      }
      if (totalSeries <= presupuestoSeries) break;
    }
    if (totalSeries <= presupuestoSeries) break;
  }

  return ajustadas;
}

export type GenerarSesionesSemanaInput = {
  ejerciciosSeleccionados: EjercicioCatalogo[];
  disponibilidad: DisponibilidadContexto;
  objetivoBloque: ObjetivoBloque;
  progresion: ProgresionBloque;
  indiceSemanaEnBloque: number;
  totalSemanasBloque: number;
  esDeload: boolean;
  factorVolumenDeload: number;
  factorIntensidadDeload: number;
  rmVigentes: RmVigenteContexto[];
};

export function generarSesionesSemana(
  input: GenerarSesionesSemanaInput,
): SesionPropuesta[] {
  const rmPorEjercicio = new Map(input.rmVigentes.map((r) => [r.ejercicioId, r]));
  const grupos = agruparPorDia(input.ejerciciosSeleccionados, input.disponibilidad.diasPorSemana);

  return grupos.map((grupo, index) => {
    const ejerciciosPorOrden = new Map(grupo.map((ejercicio, i) => [i + 1, ejercicio]));
    const prescripciones = grupo.map((ejercicio, orden) =>
      calcularPrescripcion({
        ejercicio,
        orden: orden + 1,
        objetivoBloque: input.objetivoBloque,
        progresion: input.progresion,
        indiceSemanaEnBloque: input.indiceSemanaEnBloque,
        totalSemanasBloque: input.totalSemanasBloque,
        esDeload: input.esDeload,
        factorVolumenDeload: input.factorVolumenDeload,
        factorIntensidadDeload: input.factorIntensidadDeload,
        rmVigente: rmPorEjercicio.get(ejercicio.id),
      }),
    );

    const ajustadas = ajustarAlPresupuestoDeTiempo(
      prescripciones,
      ejerciciosPorOrden,
      input.disponibilidad.minutosPorSesion,
    );

    return {
      orden: index + 1,
      enfoque: input.objetivoBloque,
      duracionEstimadaMin: input.disponibilidad.minutosPorSesion,
      prescripciones: ajustadas,
    };
  });
}

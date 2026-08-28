// TASK-032 · Motor de planificación: función pura, sin Prisma.
// contexto -> propuesta. Orquesta plantillas + estructura + prescripción +
// validación. Ver §6.2 y acceptance de FASE 4: un plan de 16 semanas se
// genera en menos de 2 s y cumple los 10 invariantes de R-16.
import { calcularPeriodizacion, contarSemanas } from "@/lib/macrociclo-periodizacion";
import { diasEntre } from "@/lib/macrociclo";
import { DELOAD } from "@/lib/config/parametros";
import {
  CADUCIDAD_SEMANAS_AVISO,
  evaluarVigencia,
} from "@/lib/rm/vigente";
import {
  OBJETIVO_BLOQUE_POR_MESOCICLO,
  obtenerEstructura,
  obtenerProgresionBloque,
  obtenerZonaBloque,
} from "./plantillas";
import { modoCalendarioDe, type PerfilDeportivo } from "./perfil";
import { generarSesionesSemana, seleccionarEjerciciosPorPatron } from "./prescripcion";
import { validarPlan } from "./validacion";
import type {
  ContextoPlanificacion,
  MesocicloPropuesto,
  PeriodoPropuesto,
  PropuestaPlan,
  SemanaPropuesta,
} from "./tipos";

export class PlanificacionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanificacionError";
  }
}

function planVacio(
  fechaInicio: Date,
  fechaFin: Date,
  errores: string[],
): PropuestaPlan {
  return {
    fechaInicio,
    fechaFin,
    totalSemanas: 0,
    periodos: [],
    mesociclos: [],
    semanas: [],
    avisos: [],
    errores,
  };
}

/**
 * Genera una propuesta de plan completa a partir del contexto del atleta.
 * Nunca lanza por datos de negocio inválidos (fechas, duración insuficiente,
 * etc.): esos casos vuelven en `errores` (E-06/E-08/E-17). Solo lanza
 * PlanificacionError ante contradicciones de programación imposibles de
 * recuperar (no debería ocurrir con un ContextoPlanificacion bien formado).
 */
export function generarPlan(contexto: ContextoPlanificacion): PropuestaPlan {
  const { fechaInicio, fechaFin } = contexto.objetivo;

  // E-17: fecha de competencia (o de fin) anterior a la de inicio.
  if (diasEntre(fechaInicio, fechaFin) < 0) {
    return planVacio(fechaInicio, fechaFin, [
      "La fecha de fin debe ser posterior a la fecha de inicio.",
    ]);
  }
  if (
    contexto.objetivo.fechaCompetencia &&
    diasEntre(fechaInicio, contexto.objetivo.fechaCompetencia) < 0
  ) {
    return planVacio(fechaInicio, fechaFin, [
      "La fecha de competencia no puede ser anterior a la fecha de inicio.",
    ]);
  }

  // ADR-37: la forma del plan sale del perfil deportivo. Si el contexto no lo
  // trae (plan antiguo o llamada sin perfil), se deriva del objetivo: salud
  // no tiene competencia, y competencia asume un pico único.
  const perfil: PerfilDeportivo = contexto.objetivo.perfil ?? {
    capacidad: "mixto_intermitente",
    calendario:
      contexto.objetivo.tipo === "competencia" ? "pico_unico" : "sin_competencia",
    nivel: contexto.atleta.nivel,
  };

  const totalSemanasPlan = contarSemanas(fechaInicio, fechaFin);
  const estructura = obtenerEstructura(perfil, totalSemanasPlan);

  const competencias =
    contexto.objetivo.competencias ??
    (contexto.objetivo.fechaCompetencia
      ? [
          {
            fecha: contexto.objetivo.fechaCompetencia,
            importancia: "principal" as const,
          },
        ]
      : []);

  const calculado = calcularPeriodizacion({
    fechaInicio,
    fechaFin,
    estructura,
    competencias,
    modoCalendario: modoCalendarioDe(perfil),
    frecuenciaDeload:
      contexto.atleta.nivel === "advanced"
        ? DELOAD.frecuenciaSemanasAvanzado
        : DELOAD.frecuenciaSemanasEstandar,
  });

  // E-06/E-08: menos semanas que bloques, o macrociclo demasiado corto.
  if (calculado.errores.length > 0) {
    return planVacio(calculado.fechaInicio, calculado.fechaFin, calculado.errores);
  }

  // calcularMesociclos preserva el orden de entrada 1:1 -> el mesociclo
  // calculado[i] corresponde a plantilla.mesociclos[i] por posición, no por
  // tipo (evita cualquier ambigüedad si en el futuro una plantilla repite
  // un mismo tipo de mesociclo, D-09).
  const mesociclosPropuestos: MesocicloPropuesto[] = calculado.mesociclos.map((m, index) => {
    const bloque = estructura.bloques[index];
    const objetivoBloque =
      bloque?.objetivoBloque ?? OBJETIVO_BLOQUE_POR_MESOCICLO[m.tipo];
    const zona = obtenerZonaBloque(objetivoBloque);
    return {
      tipo: m.tipo,
      porcentaje: m.porcentaje,
      fechaInicio: m.fechaInicio,
      fechaFin: m.fechaFin,
      orden: m.orden,
      objetivoBloque,
      progresion: obtenerProgresionBloque(objetivoBloque),
      intensidadMinPct: zona.intensidadMinPct,
      intensidadMaxPct: zona.intensidadMaxPct,
      repsMin: zona.repsMin,
      repsMax: zona.repsMax,
      rirObjetivo: Math.round((zona.rirMin + zona.rirMax) / 2),
      seriesSemanalesPorPatron: {},
    };
  });

  // R-01: selección inicial de ejercicios por patrón (el entrenador decide
  // luego qué ejercicios entran realmente, R-16 tabla §1.8).
  const ejerciciosActivos = contexto.catalogo.filter((e) => e.activo && e.patron !== "cardio");
  const seleccionados = seleccionarEjerciciosPorPatron(
    ejerciciosActivos,
    contexto.disponibilidad.equipamiento,
    contexto.rmVigentes,
  );

  // ADR-38: el tipo de cada semana (incluidos taper y evaluación) ya lo
  // resolvió calcularPeriodizacion contra el calendario de competencias.
  const microciclosPorNumero = new Map(
    calculado.semanas.map((s) => [
      s.numeroSemana,
      { tipoMicrociclo: s.tipoMicrociclo, esDeload: s.tipoMicrociclo === "recuperacion" },
    ]),
  );

  const avisos: string[] = [];

  // R-15: RM caducado.
  for (const rm of contexto.rmVigentes) {
    const estado = evaluarVigencia(rm, fechaInicio);
    if (estado.caducado) {
      avisos.push(
        `El RM del ejercicio ${rm.ejercicioId} tiene más de ${CADUCIDAD_SEMANAS_AVISO} semanas: se recomienda reevaluar (confianza efectiva: ${estado.confianzaEfectiva}).`,
      );
    }
  }

  // E-09: ejercicios seleccionados sin RM vigente -> se prescriben por reps/RIR.
  const ejerciciosConRm = new Set(contexto.rmVigentes.map((r) => r.ejercicioId));
  for (const ejercicio of seleccionados) {
    if (
      ejercicio.admitePorcentajeRm &&
      !ejercicio.esDeTiempo &&
      !ejerciciosConRm.has(ejercicio.id)
    ) {
      avisos.push(
        `"${ejercicio.nombre}" no tiene RM vigente: se prescribe por repeticiones y RIR hasta la primera evaluación.`,
      );
    }
  }

  const factorVolumenDeload = (DELOAD.volumenFactorMin + DELOAD.volumenFactorMax) / 2;
  const factorIntensidadDeload = DELOAD.intensidadFactorMin;

  const semanasPropuestas: SemanaPropuesta[] = [];
  for (const mesociclo of mesociclosPropuestos) {
    const semanasDelBloque = calculado.semanas.filter(
      (s) => s.fechaInicio >= mesociclo.fechaInicio && s.fechaInicio <= mesociclo.fechaFin,
    );

    semanasDelBloque.forEach((semanaCalculada, indexEnBloque) => {
      const micro = microciclosPorNumero.get(semanaCalculada.numeroSemana);
      const esDeload = micro?.esDeload ?? false;

      const sesiones = generarSesionesSemana({
        ejerciciosSeleccionados: seleccionados,
        disponibilidad: contexto.disponibilidad,
        objetivoBloque: mesociclo.objetivoBloque,
        progresion: mesociclo.progresion,
        indiceSemanaEnBloque: indexEnBloque + 1,
        totalSemanasBloque: semanasDelBloque.length,
        esDeload,
        factorVolumenDeload,
        factorIntensidadDeload,
        rmVigentes: contexto.rmVigentes,
      });

      semanasPropuestas.push({
        numeroSemana: semanaCalculada.numeroSemana,
        mesocicloOrden: mesociclo.orden,
        mesCalendario: semanaCalculada.mesCalendario,
        fechaInicio: semanaCalculada.fechaInicio,
        fechaFin: semanaCalculada.fechaFin,
        tipoMicrociclo: micro?.tipoMicrociclo ?? "corriente",
        esDeload,
        factorVolumen: esDeload ? factorVolumenDeload : 1,
        factorIntensidad: esDeload ? factorIntensidadDeload : 1,
        sesiones,
      });
    });
  }

  semanasPropuestas.sort((a, b) => a.numeroSemana - b.numeroSemana);

  const periodosPropuestos: PeriodoPropuesto[] = calculado.periodos.map((p) => ({
    tipo: p.tipo,
    porcentaje: p.porcentaje,
    fechaInicio: p.fechaInicio,
    fechaFin: p.fechaFin,
    orden: p.orden,
    etapas: p.etapas.map((e) => ({
      tipo: e.tipo,
      porcentaje: e.porcentaje,
      fechaInicio: e.fechaInicio,
      fechaFin: e.fechaFin,
      orden: e.orden,
    })),
  }));

  const propuesta: PropuestaPlan = {
    fechaInicio: calculado.fechaInicio,
    fechaFin: calculado.fechaFin,
    totalSemanas: calculado.totalSemanas,
    periodos: periodosPropuestos,
    mesociclos: mesociclosPropuestos,
    semanas: semanasPropuestas,
    avisos,
    errores: [],
  };

  const erroresValidacion = validarPlan(propuesta, contexto.catalogo);

  return { ...propuesta, errores: erroresValidacion };
}

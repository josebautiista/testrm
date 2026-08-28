"use client";

import { useMemo } from "react";

import { Aviso, ComoFunciona } from "@/components/rm/ComoFunciona";
import {
  ETAPA_DESCRIPCION,
  MESES_POR_ETAPA_LABEL,
  MESOCICLO_DESCRIPCION,
  MICROCICLO_DESCRIPCION,
  type TipoEtapa,
  type TipoMicrociclo,
} from "@/lib/macrociclo";
import {
  construirEstructura,
  modoCalendarioDe,
  type PerfilDeportivo,
} from "@/lib/planificacion/perfil";
import { revisarTaper, SEMANAS_TAPER } from "@/lib/planificacion/taper";
import {
  calcularPeriodizacion,
  contarSemanas,
} from "@/lib/macrociclo-periodizacion";

type Props = {
  perfil: PerfilDeportivo;
  fechaInicio: string;
  fechaFin: string;
  competencias: Array<{
    nombre: string;
    fecha: string;
    importancia: "principal" | "secundaria";
  }>;
};

const PERIODO_LABEL: Record<string, string> = {
  preparatorio: "Preparatorio",
  competitivo: "Competitivo",
  transitorio: "Transitorio",
};

const PERIODO_EXPLICACION: Record<string, string> = {
  preparatorio:
    "Se construye la capacidad. Es el periodo más largo cuando hay una sola competencia importante, y el más corto en una liga.",
  competitivo:
    "Se compite y se sostiene lo construido. El entrenamiento pasa a segundo plano.",
  transitorio:
    "Descanso activo después de competir. Dura entre 2 y 4 semanas y no es opcional: cortar en seco produce pérdida medible en menos de un mes.",
};

const COLOR_MICROCICLO: Record<TipoMicrociclo, string> = {
  evaluacion: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  corriente: "bg-bg-subtle text-text-secondary",
  competitivo: "bg-accent/20 text-accent",
  precompetitivo: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  choque: "bg-red-500/15 text-red-700 dark:text-red-300",
  recuperacion: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  aproximacion: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  taper: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

function parseFecha(valor: string): Date | null {
  if (!valor) return null;
  const fecha = new Date(`${valor}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

const formatoCorto = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
});

export function PasoEstructura({
  perfil,
  fechaInicio,
  fechaFin,
  competencias,
}: Props) {
  const inicio = parseFecha(fechaInicio);
  const fin = parseFecha(fechaFin);

  const resultado = useMemo(() => {
    if (!inicio || !fin) return null;

    const totalSemanas = contarSemanas(inicio, fin);
    const estructura = construirEstructura(perfil, totalSemanas);

    const competenciasPlan = competencias
      .map((competencia) => {
        const fecha = parseFecha(competencia.fecha);
        return fecha
          ? {
              fecha,
              importancia: competencia.importancia,
              nombre: competencia.nombre || "la competencia",
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const plan = calcularPeriodizacion({
      fechaInicio: inicio,
      fechaFin: fin,
      estructura,
      competencias: competenciasPlan,
      modoCalendario: modoCalendarioDe(perfil),
      frecuenciaDeload: perfil.nivel === "advanced" ? 3 : 4,
    });

    const avisosTaper = revisarTaper(
      plan.semanas.map((semana) => ({
        numeroSemana: semana.numeroSemana,
        mesocicloTipo: "desarrollador" as const,
        fechaInicio: semana.fechaInicio,
        fechaFin: semana.fechaFin,
      })),
      competenciasPlan,
      modoCalendarioDe(perfil),
    );

    return { estructura, plan, avisosTaper, totalSemanas };
  }, [competencias, fin, inicio, perfil]);

  if (!inicio || !fin) {
    return (
      <Aviso tono="alerta">
        Define las fechas de inicio y fin del macrociclo para poder calcular la
        estructura.
      </Aviso>
    );
  }

  if (!resultado) return null;

  const { estructura, plan, avisosTaper, totalSemanas } = resultado;
  const hayError = plan.errores.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary dark:text-white">
          Estructura del macrociclo
        </h2>
        <p className="text-sm text-text-secondary">
          {totalSemanas} semanas, calculadas a partir de tu perfil. No hay
          porcentajes que cuadrar: los periodos salen de los bloques.
        </p>
      </div>

      <ComoFunciona
        titulo="Cómo se arma tu plan"
        resumen="Un macrociclo se divide en periodos, cada periodo en etapas y cada etapa en bloques de 2 a 4 semanas. Cada bloque persigue un objetivo distinto, y el orden importa: primero se construye base, después se hace específico, y al final se afina para competir."
        pasos={[
          {
            titulo: "Periodos",
            detalle:
              "Preparatorio (construir), competitivo (competir) y transitorio (descansar). Los tres, siempre, en ese orden.",
          },
          {
            titulo: "Bloques de 2 a 4 semanas",
            detalle:
              "Menos de dos semanas no alcanza para producir adaptación: los efectos de un bloque tardan entre 12 y 30 días en consolidarse. Si tu macrociclo es corto, se quitan bloques antes que acortarlos.",
          },
          {
            titulo: "Semanas de descarga",
            detalle:
              "Cada 3 o 4 semanas se baja el volumen para asimilar. No es perder tiempo: es cuando se produce la adaptación.",
          },
          {
            titulo: "Semanas de afinamiento",
            detalle:
              modoCalendarioDe(perfil) === "objetivo"
                ? "Antes de cada fecha objetivo principal se recorta una semana de volumen manteniendo la intensidad, para que llegues descansado sin perder forma."
                : `Antes de cada competencia principal se recortan ${SEMANAS_TAPER.max} semanas de volumen manteniendo la intensidad. Es la parte del plan con más respaldo científico.`,
          },
          {
            titulo: "Semanas de evaluación",
            detalle:
              "Al principio, cada 10 semanas y al final. Sin medir no se puede ajustar la carga ni saber si el plan funcionó.",
          },
        ]}
        porQue="El orden general → específico y la alternancia carga/descarga son lo único que todos los modelos de periodización comparten. Lo que cambia entre modelos es el detalle, y la evidencia no señala un ganador claro. Por eso la app se apoya en lo compartido."
        fuente="Bompa & Haff (estructura anual); Issurin (duración de bloques y efectos residuales); Bosquet (taper)."
      />

      {hayError ? (
        <Aviso tono="error" titulo="No se puede construir el plan">
          {plan.errores.join(" ")}
        </Aviso>
      ) : null}

      {estructura.avisos.map((aviso) => (
        <Aviso key={aviso} tono="alerta">
          {aviso}
        </Aviso>
      ))}

      {avisosTaper.map((aviso) => (
        <Aviso key={aviso} tono="alerta">
          {aviso}
        </Aviso>
      ))}

      {!hayError ? (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary dark:text-white">
              Periodos
            </h3>
            <div className="space-y-3">
              {plan.periodos.map((periodo) => (
                <article
                  key={`${periodo.tipo}-${periodo.orden}`}
                  className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-base font-semibold text-text-primary dark:text-white">
                      {PERIODO_LABEL[periodo.tipo] ?? periodo.tipo}
                    </h4>
                    <p className="text-xs tabular-nums text-text-tertiary">
                      {formatoCorto.format(periodo.fechaInicio)} –{" "}
                      {formatoCorto.format(periodo.fechaFin)} ·{" "}
                      {periodo.porcentaje}% del plan
                    </p>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    {PERIODO_EXPLICACION[periodo.tipo]}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {periodo.etapas.map((etapa) => (
                      <li
                        key={`${etapa.tipo}-${etapa.orden}`}
                        className="text-sm leading-6"
                      >
                        <span className="font-medium text-text-primary dark:text-white">
                          {MESES_POR_ETAPA_LABEL[etapa.tipo as TipoEtapa]}:
                        </span>{" "}
                        <span className="text-text-secondary">
                          {ETAPA_DESCRIPCION[etapa.tipo as TipoEtapa]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary dark:text-white">
              Bloques
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-bg-subtle text-xs uppercase tracking-[0.14em] text-text-tertiary">
                  <tr>
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Bloque</th>
                    <th className="px-4 py-3 font-medium">Semanas</th>
                    <th className="px-4 py-3 font-medium">Fechas</th>
                    <th className="px-4 py-3 font-medium">Para qué sirve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {plan.mesociclos.map((mesociclo, indice) => (
                    <tr key={`${mesociclo.tipo}-${mesociclo.orden}`}>
                      <td className="px-4 py-3 tabular-nums text-text-tertiary">
                        {mesociclo.orden}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary dark:text-white">
                        {estructura.bloques[indice]?.nombre ?? mesociclo.tipo}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-text-secondary">
                        {mesociclo.semanas.length}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-text-secondary">
                        {formatoCorto.format(mesociclo.fechaInicio)} –{" "}
                        {formatoCorto.format(mesociclo.fechaFin)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {MESOCICLO_DESCRIPCION[mesociclo.tipo]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary dark:text-white">
              Semana a semana
            </h3>
            <p className="text-sm leading-6 text-text-secondary">
              Cada semana lleva escrito por qué es lo que es. Pasa el cursor o
              lee la columna de la derecha.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-bg-subtle text-xs uppercase tracking-[0.14em] text-text-tertiary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Semana</th>
                    <th className="px-4 py-3 font-medium">Fechas</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Por qué</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {plan.semanas.map((semana) => (
                    <tr key={semana.numeroSemana}>
                      <td className="px-4 py-2.5 tabular-nums text-text-primary dark:text-white">
                        {semana.numeroSemana}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-text-secondary">
                        {formatoCorto.format(semana.fechaInicio)} –{" "}
                        {formatoCorto.format(semana.fechaFin)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={[
                            "inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                            COLOR_MICROCICLO[semana.tipoMicrociclo] ??
                              "bg-bg-subtle text-text-secondary",
                          ].join(" ")}
                          title={MICROCICLO_DESCRIPCION[semana.tipoMicrociclo]}
                        >
                          {semana.tipoMicrociclo}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {semana.notas}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

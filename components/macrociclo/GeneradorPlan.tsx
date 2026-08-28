"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  generarPropuestaAction,
  publicarPlanAction,
} from "@/actions/planificacion";
import type { PropuestaPlan, SemanaPropuesta } from "@/lib/planificacion/tipos";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { MetricRow } from "@/components/ui/MetricRow";
import { Section } from "@/components/ui/Section";

function formatFecha(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const OBJETIVO_BLOQUE_LABEL: Record<string, string> = {
  fuerza_maxima: "Fuerza máxima",
  hipertrofia: "Hipertrofia",
  resistencia_fuerza: "Resistencia de fuerza",
  potencia: "Potencia",
  acumulacion: "Acumulación",
  realizacion: "Realización",
  recuperacion: "Recuperación",
};

function SemanaRow({ semana }: { semana: SemanaPropuesta }) {
  const [abierta, setAbierta] = useState(false);
  const totalSeries = semana.sesiones.reduce(
    (sum, s) => sum + s.prescripciones.reduce((s2, p) => s2 + p.series, 0),
    0,
  );

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-bg-subtle"
        onClick={() => setAbierta((v) => !v)}
      >
        <td className="px-3 py-2 text-text-primary dark:text-white">
          {semana.numeroSemana}
        </td>
        <td className="px-3 py-2 text-text-secondary">
          {formatFecha(semana.fechaInicio)} – {formatFecha(semana.fechaFin)}
        </td>
        <td className="px-3 py-2 text-text-secondary capitalize">
          {semana.tipoMicrociclo}
        </td>
        <td className="px-3 py-2 text-text-secondary">
          {semana.esDeload ? "Sí" : "No"}
        </td>
        <td className="px-3 py-2 text-text-secondary">
          {semana.sesiones.length}
        </td>
        <td className="px-3 py-2 text-text-secondary">{totalSeries}</td>
      </tr>
      {abierta ? (
        <tr>
          <td colSpan={6} className="bg-bg-soft px-3 py-3">
            <div className="space-y-3">
              {semana.sesiones.map((sesion) => (
                <div key={sesion.orden} className="rounded-xl border border-gray-200 p-3 dark:border-white/10">
                  <p className="text-sm font-semibold text-text-primary dark:text-white">
                    Sesión {sesion.orden} · {sesion.duracionEstimadaMin} min
                  </p>
                  <div className="mt-2 space-y-1">
                    {sesion.prescripciones.map((p) => (
                      <p key={p.orden} className="text-xs text-text-secondary">
                        Ejercicio #{p.ejercicioId} — {p.series}×{p.repeticionesObjetivo} @{" "}
                        {p.cargaKg !== null ? `${p.cargaKg} kg` : "sin RM (por RIR)"}
                        {p.porcentajeRm ? ` (${p.porcentajeRm}% RM)` : ""} · RIR {p.rirObjetivo}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function GeneradorPlan({
  cc,
  macrocicloId,
  yaGenerado,
}: {
  cc: string;
  macrocicloId: number;
  yaGenerado: boolean;
}) {
  const router = useRouter();
  const [propuesta, setPropuesta] = useState<PropuestaPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publicado, setPublicado] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generar() {
    setError(null);
    setPublicado(false);
    startTransition(async () => {
      const resultado = await generarPropuestaAction(cc, macrocicloId);
      if (!resultado.ok) {
        setError(resultado.error);
        setPropuesta(null);
        return;
      }
      setPropuesta(resultado.propuesta);
    });
  }

  function publicar() {
    if (!propuesta) return;
    setError(null);
    startTransition(async () => {
      const resultado = await publicarPlanAction(cc, macrocicloId, propuesta);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setPublicado(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <PrimaryButton onClick={generar} disabled={isPending}>
          {isPending ? "Generando..." : yaGenerado ? "Regenerar propuesta" : "Generar propuesta"}
        </PrimaryButton>
        {propuesta && propuesta.errores.length === 0 ? (
          <PrimaryButton
            onClick={publicar}
            disabled={isPending}
            className="border-transparent bg-accent text-white hover:opacity-90"
          >
            {isPending ? "Publicando..." : "Publicar plan"}
          </PrimaryButton>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {publicado ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200">
          Plan publicado. Las semanas ya ejecutadas y las prescripciones
          ajustadas a mano no se tocaron.
        </div>
      ) : null}

      {propuesta ? (
        <div className="space-y-6">
          {propuesta.errores.length > 0 ? (
            <Section title="El plan no se puede publicar" className="space-y-2">
              <ul className="space-y-1">
                {propuesta.errores.map((e, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {propuesta.avisos.length > 0 ? (
            <Section title="Avisos" className="space-y-2">
              <ul className="space-y-1">
                {propuesta.avisos.map((a, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Resumen" className="space-y-2">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
              <MetricRow label="Total de semanas" value={String(propuesta.totalSemanas)} compact />
              <MetricRow label="Mesociclos" value={String(propuesta.mesociclos.length)} compact />
              <MetricRow
                label="Descargas programadas"
                value={String(propuesta.semanas.filter((s) => s.esDeload).length)}
                compact
              />
            </div>
          </Section>

          <Section title="Mesociclos" className="space-y-2">
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-text-tertiary">
                  <tr>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Objetivo de bloque</th>
                    <th className="px-3 py-2 font-medium">Rango</th>
                    <th className="px-3 py-2 font-medium">Zona %1RM</th>
                    <th className="px-3 py-2 font-medium">Reps</th>
                    <th className="px-3 py-2 font-medium">RIR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {propuesta.mesociclos.map((m) => (
                    <tr key={m.orden}>
                      <td className="px-3 py-2 capitalize text-text-primary dark:text-white">
                        {m.tipo.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {OBJETIVO_BLOQUE_LABEL[m.objetivoBloque] ?? m.objetivoBloque}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {formatFecha(m.fechaInicio)} – {formatFecha(m.fechaFin)}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {m.intensidadMinPct}–{m.intensidadMaxPct}%
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {m.repsMin}–{m.repsMax}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{m.rirObjetivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Semanas" className="space-y-2">
            <p className="text-xs text-text-tertiary">
              Toca una semana para ver sus sesiones y prescripciones.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-text-tertiary">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Fechas</th>
                    <th className="px-3 py-2 font-medium">Microciclo</th>
                    <th className="px-3 py-2 font-medium">Descarga</th>
                    <th className="px-3 py-2 font-medium">Sesiones</th>
                    <th className="px-3 py-2 font-medium">Series totales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {propuesta.semanas.map((semana) => (
                    <SemanaRow key={semana.numeroSemana} semana={semana} />
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      ) : null}
    </div>
  );
}

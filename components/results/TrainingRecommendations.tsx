"use client";

import { useEffect, useState } from "react";

import InfoTooltip from "@/components/ui/InfoTooltip";
import { USER_LEVEL_OVERRIDE_EVENT } from "@/components/ui/UserLevelSelector";
import {
  calculateTrainingWeight,
  getRecommendedGoalsForPhase,
  getTrainingPlan,
  type TrainingFase,
  type TrainingGoal,
  type TrainingLevel,
} from "@/lib/training";
import {
  isUserLevel,
  resolveUserLevel,
  type UserLevel,
} from "@/lib/user-level";

/**
 * Resumen serializable de la fase activa, resuelta en el servidor desde el
 * mesociclo del macrociclo abierto que contiene la fecha de hoy
 * (`lib/planificacion/fase.ts`, ADR-36).
 */
export type FaseActivaResumen = {
  fase: TrainingFase;
  objetivoBloque: string;
  /** Nombre legible del mesociclo, p. ej. "Estabilizador". */
  mesociclo: string;
  posicion: number;
  total: number;
  diasRestantes: number;
  fechaFin: string;
  macrocicloId: number | null;
  esBorrador: boolean;
};

type TrainingRecommendationsProps = {
  rm: number;
  autoLevel: TrainingLevel;
  initialOverride: UserLevel | null;
  faseActiva?: FaseActivaResumen | null;
  /** Distingue "no tienes plan" de "tu plan no cubre la fecha de hoy". */
  tieneMacrocicloAbierto?: boolean;
};

const goals: Array<{ id: TrainingGoal; label: string }> = [
  { id: "strength", label: "Fuerza" },
  { id: "hypertrophy", label: "Hipertrofia" },
  { id: "endurance", label: "Resistencia" },
];

const FASE_LABELS: Record<TrainingFase, string> = {
  resistencia: "Resistencia",
  fuerza: "Fuerza máxima",
  hipertrofia: "Hipertrofia",
};

const OBJETIVO_BLOQUE_LABELS: Record<string, string> = {
  fuerza_maxima: "fuerza máxima",
  realizacion: "realización",
  potencia: "potencia",
  hipertrofia: "hipertrofia",
  acumulacion: "acumulación",
  resistencia_fuerza: "resistencia a la fuerza",
  recuperacion: "recuperación",
};

const references = [
  {
    label: "Schoenfeld (2010)",
    href: "https://pubmed.ncbi.nlm.nih.gov/20847704/",
  },
  {
    label: "ACSM (2009)",
    href: "https://www.acsm.org/wp-content/uploads/2025/01/Progression-Models-in-Resistance-Training-for-Healthy-Adults.pdf",
  },
  {
    label: "NSCA guidelines",
    href: "https://www.nsca.com/education/articles/kinetic-select/intensity-or-resistance/",
  },
];

function formatWeight(value: number) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercentage(value: number) {
  return Math.round(value * 100);
}

export function TrainingRecommendations({
  rm,
  autoLevel,
  initialOverride,
  faseActiva,
  tieneMacrocicloAbierto = false,
}: TrainingRecommendationsProps) {
  const [overrideLevel, setOverrideLevel] = useState<UserLevel | null>(
    initialOverride,
  );
  const resolvedLevel = resolveUserLevel(autoLevel, overrideLevel);

  useEffect(() => {
    function handleOverrideChange(event: Event) {
      const customEvent = event as CustomEvent<{ level: UserLevel | null }>;
      setOverrideLevel(
        isUserLevel(customEvent.detail?.level) ? customEvent.detail.level : null,
      );
    }

    window.addEventListener(USER_LEVEL_OVERRIDE_EVENT, handleOverrideChange);

    return () => {
      window.removeEventListener(USER_LEVEL_OVERRIDE_EVENT, handleOverrideChange);
    };
  }, []);

  if (!Number.isFinite(rm) || rm <= 0) {
    return null;
  }

  const activeGoals = new Set(
    getRecommendedGoalsForPhase(faseActiva?.fase ?? null),
  );

  const rows = goals.map((goal) => {
    const plan = getTrainingPlan(goal.id, resolvedLevel);
    const minWeight = calculateTrainingWeight(rm, plan.percentageRange.min);
    const maxWeight = calculateTrainingWeight(rm, plan.percentageRange.max);

    return {
      ...goal,
      percentageLabel: `${formatPercentage(plan.percentageRange.min)}-${formatPercentage(plan.percentageRange.max)}%`,
      weightLabel: `${formatWeight(minWeight)}-${formatWeight(maxWeight)} kg`,
      repLabel: `${plan.repRange.min}-${plan.repRange.max} repeticiones`,
    };
  });

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h3 className="text-sm uppercase tracking-wide text-text-secondary">
          Resultados y Aplicación Práctica
        </h3>
        <p className="text-sm text-text-secondary">
          Según tu fuerza actual, estos son los pesos recomendados para entrenar
          según tu objetivo
        </p>
        <p className="flex items-center text-xs text-text-tertiary">
          Basado en tu 1RM estimado
          <InfoTooltip text="Es el peso máximo que puedes levantar una sola vez" />
        </p>
        {faseActiva ? (
          <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-3">
            <p className="text-sm font-medium text-accent">
              Tu fase actual es: {FASE_LABELS[faseActiva.fase]}
            </p>
            <p className="text-sm leading-6 text-text-secondary">
              Sale de tu plan, no de un valor fijo: hoy estás en el mesociclo{" "}
              <strong className="font-semibold text-text-primary dark:text-white">
                {faseActiva.mesociclo}
              </strong>{" "}
              ({faseActiva.posicion} de {faseActiva.total} de tu macrociclo),
              cuyo objetivo de bloque es{" "}
              {OBJETIVO_BLOQUE_LABELS[faseActiva.objetivoBloque] ??
                faseActiva.objetivoBloque}
              . Ese objetivo es el que define la orientación del entrenamiento.
            </p>
            <p className="text-xs leading-5 text-text-tertiary">
              {faseActiva.diasRestantes > 0 ? (
                <>
                  El bloque termina el {faseActiva.fechaFin} (faltan{" "}
                  {faseActiva.diasRestantes}{" "}
                  {faseActiva.diasRestantes === 1 ? "día" : "días"}). Cuando
                  empiece el siguiente mesociclo, la fase cambia sola: no hay
                  nada que ajustar a mano.
                </>
              ) : (
                <>
                  Hoy es el último día del bloque ({faseActiva.fechaFin}). La
                  fase cambiará con el siguiente mesociclo del plan.
                </>
              )}
              {faseActiva.esBorrador ? (
                <>
                  {" "}
                  Tu macrociclo todavía está en borrador, así que estas fechas
                  pueden moverse.
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <div className="space-y-1 rounded-xl border border-gray-200 bg-bg-subtle px-3 py-3 dark:border-white/10">
            <p className="text-sm font-medium text-text-primary dark:text-white">
              No tienes una fase activa
            </p>
            <p className="text-sm leading-6 text-text-secondary">
              {tieneMacrocicloAbierto
                ? "Tienes un macrociclo abierto, pero la fecha de hoy no cae dentro de ninguno de sus mesociclos. Revisa las fechas del plan."
                : "La fase de entrenamiento sale del mesociclo activo de tu macrociclo. Sin un macrociclo en curso no hay una orientación que destacar, así que abajo se muestran los tres objetivos sin resaltar ninguno."}
            </p>
          </div>
        )}
      </header>

      <div className="rounded-xl border border-gray-200 bg-bg-main dark:border-white/6 dark:bg-bg-soft">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-subtle text-xs uppercase text-text-tertiary">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">
                Objetivo
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                <span className="inline-flex items-center">
                  % de fuerza
                  <InfoTooltip text="Es una forma de ajustar el peso según tu capacidad actual" />
                </span>
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Peso sugerido
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Repeticiones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/6">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={
                  activeGoals.has(row.id)
                    ? "bg-accent/10"
                    : undefined
                }
              >
                <td className="px-3 py-3 font-medium text-text-primary dark:text-white">
                  {row.label}
                  {activeGoals.has(row.id) ? (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                      Actual
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-text-secondary">
                  {row.percentageLabel}
                </td>
                <td className="px-3 py-3 text-text-secondary">
                  {row.weightLabel}
                </td>
                <td className="px-3 py-3 text-text-secondary">
                  {row.repLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {faseActiva ? (
        <p className="text-xs leading-5 text-text-tertiary">
          La fila marcada como <strong>Actual</strong> es la que corresponde al
          objetivo de tu bloque de hoy. Las otras dos siguen visibles para que
          veas con qué cargas trabajarías en cada orientación.
        </p>
      ) : null}

      <div className="space-y-2 text-xs text-text-tertiary">
        <h4 className="font-semibold text-text-secondary">
          Respaldo científico
        </h4>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {references.map((reference) => (
            <a
              key={reference.href}
              href={reference.href}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline-offset-4 hover:underline"
            >
              {reference.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

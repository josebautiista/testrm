"use client";

import { useEffect, useState } from "react";

import InfoTooltip from "@/components/ui/InfoTooltip";
import {
  USER_LEVEL_OVERRIDE_EVENT,
  USER_LEVEL_OVERRIDE_KEY,
} from "@/components/ui/UserLevelSelector";
import {
  calculateTrainingWeight,
  getTrainingPlan,
  type TrainingGoal,
  type TrainingLevel,
} from "@/lib/training";
import {
  isUserLevel,
  resolveUserLevel,
  type UserLevel,
} from "@/lib/user-level";

type TrainingRecommendationsProps = {
  rm: number;
  level: TrainingLevel;
};

const goals: Array<{ id: TrainingGoal; label: string }> = [
  { id: "strength", label: "Fuerza" },
  { id: "hypertrophy", label: "Hipertrofia" },
  { id: "endurance", label: "Resistencia" },
];

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

function readOverrideLevel(): UserLevel | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedLevel = window.localStorage.getItem(USER_LEVEL_OVERRIDE_KEY);
  return isUserLevel(storedLevel) ? storedLevel : null;
}

export function TrainingRecommendations({
  rm,
  level,
}: TrainingRecommendationsProps) {
  const [overrideLevel, setOverrideLevel] = useState<UserLevel | null>(() =>
    readOverrideLevel(),
  );
  const resolvedLevel = resolveUserLevel(level, overrideLevel);

  useEffect(() => {
    function handleOverrideChange(event: Event) {
      const customEvent = event as CustomEvent<{ level: UserLevel | null }>;
      setOverrideLevel(
        isUserLevel(customEvent.detail?.level) ? customEvent.detail.level : null,
      );
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key === USER_LEVEL_OVERRIDE_KEY) {
        setOverrideLevel(isUserLevel(event.newValue) ? event.newValue : null);
      }
    }

    window.addEventListener(USER_LEVEL_OVERRIDE_EVENT, handleOverrideChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(USER_LEVEL_OVERRIDE_EVENT, handleOverrideChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  if (!Number.isFinite(rm) || rm <= 0) {
    return null;
  }

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
              <tr key={row.id}>
                <td className="px-3 py-3 font-medium text-text-primary dark:text-white">
                  {row.label}
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

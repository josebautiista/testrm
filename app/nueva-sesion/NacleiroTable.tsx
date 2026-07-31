"use client";

import { useEffect, useState } from "react";

import { calculateInitialWeight, calculateKIES, generateSeries } from "@/lib/nacleiro";

type Props = {
  bodyWeight: number;
  formatWeight: (value: number) => string;
};

type NacleiroGroup = {
  name: string;
  type: "base" | "intermedio" | "fuerte";
  weightLabel: string;
  targetWeight: number;
  reps: string;
  timerSeconds: number;
};

function toNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function NacleiroTable({ bodyWeight, formatWeight }: Props) {
  const [exerciseName, setExerciseName] = useState("");
  const [estimatedRM, setEstimatedRM] = useState("");
  const [activeGroup, setActiveGroup] = useState(0);
  const [actualReps, setActualReps] = useState<string[]>(
    Array.from({ length: 6 }).map(() => ""),
  );
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(0);
  const [timerLabel, setTimerLabel] = useState("");

  const rm = toNumber(estimatedRM);
  const safeBodyWeight = Number.isFinite(bodyWeight) && bodyWeight > 0 ? bodyWeight : 0;
  const relativeStrength = safeBodyWeight > 0 ? rm / safeBodyWeight : 0;
  const initialWeight = rm > 0 && safeBodyWeight > 0 ? calculateInitialWeight(rm, safeBodyWeight) : 0;
  const kies = rm > 0 && initialWeight > 0 ? calculateKIES(rm, initialWeight, 8) : 0;
  const generatedSeries =
    rm > 0 && safeBodyWeight > 0
      ? generateSeries(rm, safeBodyWeight, 8)
      : [];

  const baseGroups = [
    { name: "Series 1 a 2", from: 0, to: 1, timerSeconds: 120 },
    { name: "Series 3 y 4", from: 2, to: 3, timerSeconds: 120 },
    { name: "Series 5 y 6", from: 4, to: 5, timerSeconds: 300 },
    { name: "Series 7 y 8", from: 6, to: 7, timerSeconds: 300 },
  ];
  const groups: NacleiroGroup[] =
    generatedSeries.length === 0
      ? []
      : [
          ...baseGroups.map((group) => {
            const first = generatedSeries[group.from];
            const last = generatedSeries[group.to];

            return {
              name: group.name,
              type: "base" as const,
              weightLabel: `${formatWeight(first.peso)}-${formatWeight(last.peso)} kg`,
              targetWeight: last.peso,
              reps:
                first.reps === last.reps
                  ? String(first.reps)
                  : `${first.reps}-${last.reps}`,
              timerSeconds: group.timerSeconds,
            };
          }),
          {
            name: "Repeticiones intermedias",
            type: "intermedio",
            weightLabel: `${formatWeight(Math.round(rm * 1.025))}-${formatWeight(
              Math.round(rm * 1.076890625),
            )} kg`,
            targetWeight: Math.round(rm * 1.076890625),
            reps: "1",
            timerSeconds: 300,
          },
          {
            name: "Repeticiones fuertes",
            type: "fuerte",
            weightLabel: `${formatWeight(Math.round(rm * 1.05))}-${formatWeight(
              Math.round(rm * 1.157625),
            )} kg`,
            targetWeight: Math.round(rm * 1.157625),
            reps: "1",
            timerSeconds: 300,
          },
        ];

  useEffect(() => {
    if (timerSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimerSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [timerSecondsLeft]);

  const series = groups.map((group, index) => ({
    ...group,
    group: index + 1,
    actualReps: toNumber(actualReps[index] ?? ""),
  }));
  const finalRM = series.reduce((max, serie) => {
    return serie.actualReps > 0 ? Math.max(max, serie.targetWeight) : max;
  }, 0);
  const current = series[activeGroup];
  const timerMinutes = Math.floor(timerSecondsLeft / 60);
  const timerSeconds = String(timerSecondsLeft % 60).padStart(2, "0");
  const timerProgress =
    timerTotalSeconds > 0 ? (timerSecondsLeft / timerTotalSeconds) * 100 : 0;
  const protocolData = {
    method: "nacleiro",
    exerciseName,
    bodyWeight: safeBodyWeight,
    estimatedRM: rm,
    relativeStrength,
    initialWeight,
    kies,
    finalRM,
    series,
  };

  function startRestTimer(group: NacleiroGroup) {
    setTimerSecondsLeft(group.timerSeconds);
    setTimerTotalSeconds(group.timerSeconds);
    setTimerLabel(group.name);
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="protocolData" value={JSON.stringify(protocolData)} />
      <input type="hidden" name="estimatedRM" value={rm} />
      <input type="hidden" name="finalRM" value={finalRM || rm} />
      <input type="hidden" name="protocolExerciseName" value={exerciseName} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-sm font-medium text-text-primary dark:text-white">
            Ejercicio usado como base
          </span>
          <input
            name="protocolExerciseNameInput"
            type="text"
            value={exerciseName}
            onChange={(event) => setExerciseName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
            placeholder="Ej. Sentadilla"
            required
          />
        </label>
        <label>
          <span className="text-sm font-medium text-text-primary dark:text-white">
            RM estimado
          </span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={estimatedRM}
            onChange={(event) => setEstimatedRM(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
            placeholder="Ej. 100"
            required
          />
        </label>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-bg-main p-4 sm:grid-cols-4 dark:border-white/10 dark:bg-bg-subtle">
        <Metric label="Fuerza relativa" value={relativeStrength ? relativeStrength.toFixed(2) : "-"} />
        <Metric label="Peso inicial" value={initialWeight ? `${formatWeight(initialWeight)} kg` : "-"} />
        <Metric label="KIES" value={kies ? `${formatWeight(kies)} kg` : "-"} />
        <Metric label="RM detectado" value={finalRM ? `${formatWeight(finalRM)} kg` : "pendiente"} />
      </div>

      {current ? (
        <article className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle">
          <header className="space-y-1">
            <p className="text-base font-semibold text-text-primary dark:text-white">
              Grupo {activeGroup + 1} de {series.length}: {current.name}
            </p>
            <p className="text-sm text-text-secondary">
              Peso sugerido: {current.weightLabel} · Reps objetivo: {current.reps}
            </p>
          </header>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-text-primary dark:text-white">
              Reps reales
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={actualReps[activeGroup] ?? ""}
              onBlur={() => {
                if (toNumber(actualReps[activeGroup] ?? "") > 0) {
                  startRestTimer(current);
                }
              }}
              onChange={(event) =>
                setActualReps((currentReps) =>
                  currentReps.map((reps, repsIndex) =>
                    repsIndex === activeGroup ? event.target.value : reps,
                  ),
                )
              }
              className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
              placeholder={current.reps}
            />
          </label>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setActiveGroup((group) => Math.max(group - 1, 0))}
              disabled={activeGroup === 0}
              className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-white"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveGroup((group) => Math.min(group + 1, series.length - 1))
              }
              disabled={activeGroup === series.length - 1}
              className="rounded-2xl border border-transparent bg-text-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
            >
              Siguiente grupo
            </button>
            <p className="text-sm text-text-secondary sm:ml-auto">
              RM detectado: {finalRM ? `${formatWeight(finalRM)} kg` : "pendiente"}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-sm dark:border-white/10 dark:bg-bg-main">
            <p className="font-semibold text-text-primary dark:text-white">
              Temporizador
            </p>
            <p className="mt-1 text-text-secondary">
              {timerSecondsLeft > 0
                ? `${timerLabel} en descanso`
                : "Ingresa las reps reales y sal del campo para iniciar el descanso."}
            </p>
          </div>
        </article>
      ) : null}

      {timerSecondsLeft > 0 ? (
        <div
          className="fixed bottom-5 right-5 z-50 grid h-24 w-24 place-items-center rounded-full shadow-2xl shadow-accent/30"
          style={{
            background: `conic-gradient(var(--accent) ${timerProgress}%, var(--bg-subtle) 0)`,
          }}
          aria-label={`Temporizador ${timerMinutes}:${timerSeconds}`}
        >
          <div className="grid h-20 w-20 place-items-center rounded-full bg-bg-main ring-1 ring-black/5 dark:bg-bg-soft dark:ring-white/10">
            <span className="font-mono text-2xl font-semibold tabular-nums text-text-primary dark:text-white">
              {timerMinutes}:{timerSeconds}
            </span>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-bg-main dark:border-white/10 dark:bg-bg-subtle">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-text-tertiary">
            <tr>
              <th className="px-4 py-3 font-medium">Grupo</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Peso</th>
              <th className="px-4 py-3 font-medium">Reps objetivo</th>
              <th className="px-4 py-3 font-medium">Reps reales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {series.map((serie, index) => (
              <tr key={serie.group}>
                <td className="px-4 py-3 text-text-primary dark:text-white">
                  {serie.name}
                </td>
                <td className="px-4 py-3 text-text-secondary">{serie.type}</td>
                <td className="px-4 py-3 text-text-primary dark:text-white">
                  {serie.weightLabel}
                </td>
                <td className="px-4 py-3 text-text-secondary">{serie.reps}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={actualReps[index] ?? ""}
                    onBlur={() => {
                      if (toNumber(actualReps[index] ?? "") > 0) {
                        startRestTimer(serie);
                      }
                    }}
                    onChange={(event) =>
                      setActualReps((current) =>
                        current.map((reps, repsIndex) =>
                          repsIndex === index ? event.target.value : reps,
                        ),
                      )
                    }
                    className="w-24 rounded-2xl border border-gray-200 bg-bg-soft px-3 py-2 text-right text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {generatedSeries.length === 0 ? (
          <p className="px-4 py-4 text-sm text-text-secondary">
            Ingresa el RM estimado para generar las series.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-text-primary dark:text-white">
        {value}
      </p>
    </div>
  );
}

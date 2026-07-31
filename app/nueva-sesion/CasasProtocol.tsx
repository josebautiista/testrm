"use client";

import { useEffect, useMemo, useState } from "react";

type CasasStep = {
  name: string;
  percentageLabel: string;
  minPercentage: number;
  maxPercentage: number;
  rest: string;
  timerSeconds: number;
  type: "base" | "intermedio" | "fuerte";
};

type Props = {
  formatWeight: (value: number) => string;
};

const CASAS_STEPS: CasasStep[] = [
  {
    name: "Fase especifica",
    percentageLabel: "40% al 60%",
    minPercentage: 0.4,
    maxPercentage: 0.6,
    rest: "Descanso 1 minuto",
    timerSeconds: 60,
    type: "base",
  },
  {
    name: "Preparacion articular",
    percentageLabel: "70% al 80%",
    minPercentage: 0.7,
    maxPercentage: 0.8,
    rest: "Descanso 3 minutos",
    timerSeconds: 180,
    type: "base",
  },
  {
    name: "Preparacion neuromuscular",
    percentageLabel: "85% al 90%",
    minPercentage: 0.85,
    maxPercentage: 0.9,
    rest: "Descanso 5 minutos",
    timerSeconds: 300,
    type: "base",
  },
  {
    name: "Maxima activacion",
    percentageLabel: "95%",
    minPercentage: 0.95,
    maxPercentage: 0.95,
    rest: "Descanso 2 minutos",
    timerSeconds: 120,
    type: "base",
  },
  {
    name: "Busqueda del RM",
    percentageLabel: "100%",
    minPercentage: 1,
    maxPercentage: 1,
    rest: "Descanso 5 minutos",
    timerSeconds: 300,
    type: "base",
  },
  {
    name: "Repeticion 1 intermedia",
    percentageLabel: "102.5%",
    minPercentage: 1.025,
    maxPercentage: 1.025,
    rest: "Descanso 5 minutos",
    timerSeconds: 300,
    type: "intermedio",
  },
  {
    name: "Repeticion 2 intermedia",
    percentageLabel: "105.1%",
    minPercentage: 1.050625,
    maxPercentage: 1.050625,
    rest: "Descanso 5 minutos",
    timerSeconds: 300,
    type: "intermedio",
  },
  {
    name: "Repeticion 3 intermedia",
    percentageLabel: "107.7%",
    minPercentage: 1.076890625,
    maxPercentage: 1.076890625,
    rest: "Descanso 5 minutos",
    timerSeconds: 300,
    type: "intermedio",
  },
  {
    name: "Repeticion 1 fuerte",
    percentageLabel: "105%",
    minPercentage: 1.05,
    maxPercentage: 1.05,
    rest: "Descanso 5 minutos",
    timerSeconds: 300,
    type: "fuerte",
  },
  {
    name: "Repeticion 2 fuerte",
    percentageLabel: "110.3%",
    minPercentage: 1.1025,
    maxPercentage: 1.1025,
    rest: "Descanso 5 minutos",
    timerSeconds: 300,
    type: "fuerte",
  },
  {
    name: "Repeticion 3 fuerte",
    percentageLabel: "115.8%",
    minPercentage: 1.157625,
    maxPercentage: 1.157625,
    rest: "Descanso 5 minutos",
    timerSeconds: 300,
    type: "fuerte",
  },
];

function toNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function CasasProtocol({ formatWeight }: Props) {
  const [exerciseName, setExerciseName] = useState("");
  const [referenceRM, setReferenceRM] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [actualWeights, setActualWeights] = useState<string[]>(
    CASAS_STEPS.map(() => ""),
  );
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(0);
  const [timerLabel, setTimerLabel] = useState("");

  const reference = toNumber(referenceRM);
  const calculatedSteps = useMemo(
    () =>
      CASAS_STEPS.map((step, index) => ({
        ...step,
        step: index + 1,
        targetWeightMin: Math.round(reference * step.minPercentage),
        targetWeightMax: Math.round(reference * step.maxPercentage),
        targetWeightLabel:
          step.minPercentage === step.maxPercentage
            ? `${Math.round(reference * step.maxPercentage)}`
            : `${Math.round(reference * step.minPercentage)}-${Math.round(
                reference * step.maxPercentage,
              )}`,
        actualWeight: toNumber(actualWeights[index] ?? ""),
      })),
    [actualWeights, reference],
  );
  const finalRM = Math.max(
    ...calculatedSteps.map((step) => step.actualWeight || step.targetWeightMax),
    0,
  );
  const current = calculatedSteps[activeStep];
  const timerMinutes = Math.floor(timerSecondsLeft / 60);
  const timerSeconds = String(timerSecondsLeft % 60).padStart(2, "0");
  const timerProgress =
    timerTotalSeconds > 0 ? (timerSecondsLeft / timerTotalSeconds) * 100 : 0;
  const protocolData = {
    method: "casas",
    exerciseName,
    referenceRM: reference,
    finalRM,
    steps: calculatedSteps,
  };

  useEffect(() => {
    if (timerSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimerSecondsLeft((currentSeconds) => Math.max(currentSeconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [timerSecondsLeft]);

  function startRestTimer(step: CasasStep) {
    setTimerSecondsLeft(step.timerSeconds);
    setTimerTotalSeconds(step.timerSeconds);
    setTimerLabel(step.name);
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="protocolData" value={JSON.stringify(protocolData)} />
      <input type="hidden" name="estimatedRM" value={reference} />
      <input type="hidden" name="finalRM" value={finalRM} />
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
            placeholder="Ej. Press banca"
            required
          />
        </label>
        <label>
          <span className="text-sm font-medium text-text-primary dark:text-white">
            RM de referencia
          </span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={referenceRM}
            onChange={(event) => setReferenceRM(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-subtle dark:text-white"
            placeholder="Ej. 100"
            required
          />
        </label>
      </div>

      <article className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle">
        <header className="space-y-1">
          <p className="text-base font-semibold text-text-primary dark:text-white">
            Grupo {current.step} de {calculatedSteps.length}: {current.name}
          </p>
          <p className="text-sm text-text-secondary">
            Peso sugerido: {current.targetWeightLabel} kg · {current.rest}
          </p>
        </header>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-text-primary dark:text-white">
            Peso usado
          </span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={actualWeights[activeStep] ?? ""}
            onBlur={() => {
              if (toNumber(actualWeights[activeStep] ?? "") > 0) {
                startRestTimer(current);
              }
            }}
            onChange={(event) =>
              setActualWeights((currentWeights) =>
                currentWeights.map((weight, index) =>
                  index === activeStep ? event.target.value : weight,
                ),
              )
            }
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
            placeholder={`${formatWeight(current.targetWeightMax)} kg`}
          />
        </label>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setActiveStep((step) => Math.max(step - 1, 0))}
            disabled={activeStep === 0}
            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-white"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveStep((step) => Math.min(step + 1, CASAS_STEPS.length - 1))
            }
            disabled={activeStep === CASAS_STEPS.length - 1}
            className="rounded-2xl border border-transparent bg-text-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
          >
            Siguiente grupo
          </button>
          <p className="text-sm text-text-secondary sm:ml-auto">
            RM final: {finalRM > 0 ? `${formatWeight(finalRM)} kg` : "pendiente"}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-sm dark:border-white/10 dark:bg-bg-main">
          <p className="font-semibold text-text-primary dark:text-white">
            Temporizador
          </p>
          <p className="mt-1 text-text-secondary">
            {timerSecondsLeft > 0
              ? `${timerLabel} en descanso`
              : "Ingresa el peso usado y sal del campo para iniciar el descanso."}
          </p>
        </div>
      </article>

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
              <th className="px-4 py-3 font-medium">% del RM</th>
              <th className="px-4 py-3 font-medium">Sugerido</th>
              <th className="px-4 py-3 font-medium">Usado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {calculatedSteps.map((step) => (
              <tr key={step.step}>
                <td className="px-4 py-3 text-text-primary dark:text-white">
                  {step.name}
                </td>
                <td className="px-4 py-3 text-text-secondary">{step.type}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {step.percentageLabel}
                </td>
                <td className="px-4 py-3 text-text-primary dark:text-white">
                  {step.targetWeightLabel} kg
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={actualWeights[step.step - 1] ?? ""}
                    onBlur={() => {
                      if (toNumber(actualWeights[step.step - 1] ?? "") > 0) {
                        startRestTimer(step);
                      }
                    }}
                    onChange={(event) =>
                      setActualWeights((currentWeights) =>
                        currentWeights.map((weight, index) =>
                          index === step.step - 1 ? event.target.value : weight,
                        ),
                      )
                    }
                    className="w-24 rounded-2xl border border-gray-200 bg-bg-soft px-3 py-2 text-right text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                    placeholder={step.targetWeightLabel}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

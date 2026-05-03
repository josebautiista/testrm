"use client";

import { useMemo, useState } from "react";

type Ejercicio = {
  id: number;
  nombre: string;
  porcentajeMasaHombre: number;
  porcentajeMasaMujer: number;
};

export type CasasPhase = {
  name: string;
  percentage: [number, number];
  reps: string;
  rest: string;
};

type Props = {
  ejercicios: Ejercicio[];
  getSuggestedWeight: (ejercicio: Ejercicio) => number;
  formatWeight: (value: number) => string;
};

const CASAS_PHASES: CasasPhase[] = [
  { name: "Activación", percentage: [40, 60], reps: "6-8 reps", rest: "1-2 min" },
  { name: "Preparación", percentage: [70, 80], reps: "3-5 reps", rest: "2-3 min" },
  { name: "Aproximación", percentage: [85, 90], reps: "2 reps", rest: "3 min" },
  { name: "Intento submáximo", percentage: [95, 95], reps: "1 rep", rest: "3-5 min" },
  { name: "1RM", percentage: [100, 100], reps: "1RM attempts", rest: "3-5 min" },
];

type CasasState = Record<number, { activePhase: number; weights: string[] }>;

function createInitialState(ejercicios: Ejercicio[]): CasasState {
  return Object.fromEntries(
    ejercicios.map((ejercicio) => [
      ejercicio.id,
      { activePhase: 0, weights: CASAS_PHASES.map(() => "") },
    ]),
  );
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function CasasProtocol({
  ejercicios,
  getSuggestedWeight,
  formatWeight,
}: Props) {
  const [state, setState] = useState<CasasState>(() =>
    createInitialState(ejercicios),
  );

  const protocolData = useMemo(
    () => ({
      method: "casas",
      phases: CASAS_PHASES,
      ejercicios: ejercicios.map((ejercicio) => {
        const item = state[ejercicio.id];
        const weights = item?.weights ?? [];
        const finalRM = Math.max(...weights.map(toNumber), 0);

        return {
          ejercicioId: ejercicio.id,
          nombre: ejercicio.nombre,
          activePhase: item?.activePhase ?? 0,
          finalRM,
          phases: CASAS_PHASES.map((phase, index) => ({
            ...phase,
            weight: toNumber(weights[index] ?? ""),
          })),
        };
      }),
    }),
    [ejercicios, state],
  );

  function updateWeight(ejercicioId: number, phaseIndex: number, value: string) {
    setState((current) => ({
      ...current,
      [ejercicioId]: {
        activePhase: current[ejercicioId]?.activePhase ?? 0,
        weights: (current[ejercicioId]?.weights ?? CASAS_PHASES.map(() => "")).map(
          (weight, index) => (index === phaseIndex ? value : weight),
        ),
      },
    }));
  }

  function advance(ejercicioId: number) {
    setState((current) => {
      const item = current[ejercicioId];
      if (!item) return current;

      return {
        ...current,
        [ejercicioId]: {
          ...item,
          activePhase: Math.min(item.activePhase + 1, CASAS_PHASES.length - 1),
        },
      };
    });
  }

  function goBack(ejercicioId: number) {
    setState((current) => {
      const item = current[ejercicioId];
      if (!item) return current;

      return {
        ...current,
        [ejercicioId]: {
          ...item,
          activePhase: Math.max(item.activePhase - 1, 0),
        },
      };
    });
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="protocolData" value={JSON.stringify(protocolData)} />
      {ejercicios.map((ejercicio) => {
        const item = state[ejercicio.id];
        const activePhase = item?.activePhase ?? 0;
        const phase = CASAS_PHASES[activePhase];
        const weight = item?.weights[activePhase] ?? "";
        const finalRM = Math.max(...(item?.weights ?? []).map(toNumber), 0);
        const suggested = getSuggestedWeight(ejercicio);
        const minWeight = suggested * (phase.percentage[0] / 100);
        const maxWeight = suggested * (phase.percentage[1] / 100);

        return (
          <article
            key={ejercicio.id}
            className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle"
          >
            <input type="hidden" name={`carga_${ejercicio.id}`} value={finalRM || suggested} />
            <input type="hidden" name={`repeticiones_${ejercicio.id}`} value="1" />
            <input type="hidden" name={`casas_${ejercicio.id}`} value={finalRM} />
            <header className="space-y-1">
              <p className="text-base font-semibold text-text-primary dark:text-white">
                {ejercicio.nombre}
              </p>
              <p className="text-sm text-text-secondary">
                Paso {activePhase + 1} de {CASAS_PHASES.length}: {phase.name}
              </p>
            </header>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
                  Intensidad
                </p>
                <p className="mt-1 text-sm text-text-primary dark:text-white">
                  {phase.percentage[0] === phase.percentage[1]
                    ? `${phase.percentage[0]}%`
                    : `${phase.percentage[0]}-${phase.percentage[1]}%`}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
                  Repeticiones
                </p>
                <p className="mt-1 text-sm text-text-primary dark:text-white">
                  {phase.reps}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
                  Descanso
                </p>
                <p className="mt-1 text-sm text-text-primary dark:text-white">
                  {phase.rest}
                </p>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-text-primary dark:text-white">
                Peso usado en este paso
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={weight}
                onChange={(event) =>
                  updateWeight(ejercicio.id, activePhase, event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-white/10 dark:bg-bg-main dark:text-white"
                placeholder={`${formatWeight(minWeight)}-${formatWeight(maxWeight)} kg`}
              />
            </label>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => goBack(ejercicio.id)}
                disabled={activePhase === 0}
                className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-white"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => advance(ejercicio.id)}
                disabled={activePhase === CASAS_PHASES.length - 1 || !weight}
                className="rounded-2xl border border-transparent bg-text-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
              >
                Siguiente paso
              </button>
              <p className="text-sm text-text-secondary sm:ml-auto sm:self-center">
                RM final: {finalRM > 0 ? `${formatWeight(finalRM)} kg` : "pendiente"}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

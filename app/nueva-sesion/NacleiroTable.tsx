"use client";

import { useMemo, useState } from "react";

import { generateSeries } from "@/lib/nacleiro";

type Ejercicio = {
  id: number;
  nombre: string;
  porcentajeMasaHombre: number;
  porcentajeMasaMujer: number;
};

type Props = {
  ejercicios: Ejercicio[];
  bodyWeight: number;
  getSuggestedRM: (ejercicio: Ejercicio) => number;
  formatWeight: (value: number) => string;
};

type NacleiroState = Record<
  number,
  {
    rm: string;
    reps: string[];
  }
>;

function createInitialState(
  ejercicios: Ejercicio[],
  getSuggestedRM: (ejercicio: Ejercicio) => number,
): NacleiroState {
  return Object.fromEntries(
    ejercicios.map((ejercicio) => [
      ejercicio.id,
      {
        rm: String(Math.round(getSuggestedRM(ejercicio))),
        reps: Array.from({ length: 8 }).map(() => ""),
      },
    ]),
  );
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function NacleiroTable({
  ejercicios,
  bodyWeight,
  getSuggestedRM,
  formatWeight,
}: Props) {
  const [state, setState] = useState<NacleiroState>(() =>
    createInitialState(ejercicios, getSuggestedRM),
  );

  const protocolData = useMemo(
    () => ({
      method: "nacleiro",
      ejercicios: ejercicios.map((ejercicio) => {
        const rm = toNumber(state[ejercicio.id]?.rm ?? "");
        const series = generateSeries(rm, bodyWeight);
        const reps = state[ejercicio.id]?.reps ?? [];
        const finalRM = series.reduce((max, serie, index) => {
          const actualReps = toNumber(reps[index] ?? "");
          return actualReps > 0 ? Math.max(max, serie.peso) : max;
        }, 0);

        return {
          ejercicioId: ejercicio.id,
          nombre: ejercicio.nombre,
          targetRM: rm,
          finalRM,
          series: series.map((serie, index) => ({
            ...serie,
            actualReps: toNumber(reps[index] ?? ""),
          })),
        };
      }),
    }),
    [bodyWeight, ejercicios, state],
  );

  function updateRM(ejercicioId: number, value: string) {
    setState((current) => ({
      ...current,
      [ejercicioId]: {
        rm: value,
        reps: current[ejercicioId]?.reps ?? Array.from({ length: 8 }).map(() => ""),
      },
    }));
  }

  function updateReps(ejercicioId: number, index: number, value: string) {
    setState((current) => {
      const item = current[ejercicioId];
      if (!item) return current;

      return {
        ...current,
        [ejercicioId]: {
          ...item,
          reps: item.reps.map((reps, repsIndex) =>
            repsIndex === index ? value : reps,
          ),
        },
      };
    });
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="protocolData" value={JSON.stringify(protocolData)} />
      {ejercicios.map((ejercicio) => {
        const item = state[ejercicio.id];
        const rm = toNumber(item?.rm ?? "");
        const series = generateSeries(rm, bodyWeight);
        const finalRM = series.reduce((max, serie, index) => {
          const actualReps = toNumber(item?.reps[index] ?? "");
          return actualReps > 0 ? Math.max(max, serie.peso) : max;
        }, 0);

        return (
          <article
            key={ejercicio.id}
            className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-subtle"
          >
            <input type="hidden" name={`carga_${ejercicio.id}`} value={finalRM || rm} />
            <input type="hidden" name={`repeticiones_${ejercicio.id}`} value="1" />
            <input type="hidden" name={`nacleiro_${ejercicio.id}`} value={finalRM} />
            <header className="grid gap-3 sm:grid-cols-[1fr_12rem] sm:items-end">
              <div>
                <p className="text-base font-semibold text-text-primary dark:text-white">
                  {ejercicio.nombre}
                </p>
                <p className="text-sm text-text-secondary">
                  Test progresivo para usuarios con experiencia
                </p>
              </div>
              <label>
                <span className="text-sm font-medium text-text-primary dark:text-white">
                  RM estimado base
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={item?.rm ?? ""}
                  onChange={(event) => updateRM(ejercicio.id, event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-white/10 dark:bg-bg-main dark:text-white"
                />
              </label>
            </header>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-text-tertiary">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Serie</th>
                    <th className="py-2 pr-3 font-medium">Peso</th>
                    <th className="py-2 pr-3 font-medium">Reps objetivo</th>
                    <th className="py-2 font-medium">Reps reales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {series.map((serie, index) => (
                    <tr key={serie.serie}>
                      <td className="py-2 pr-3 text-text-primary dark:text-white">
                        {serie.serie}
                      </td>
                      <td className="py-2 pr-3 text-text-primary dark:text-white">
                        {formatWeight(serie.peso)} kg
                      </td>
                      <td className="py-2 pr-3 text-text-secondary">
                        {serie.reps}
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item?.reps[index] ?? ""}
                          onChange={(event) =>
                            updateReps(ejercicio.id, index, event.target.value)
                          }
                          className="w-24 rounded-2xl border border-gray-200 bg-bg-soft px-3 py-2 text-right text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-text-secondary">
              RM detectado: {finalRM > 0 ? `${formatWeight(finalRM)} kg` : "pendiente"}
            </p>
          </article>
        );
      })}
    </div>
  );
}

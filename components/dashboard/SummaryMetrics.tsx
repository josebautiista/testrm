"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  actualizarMedidasBasicasAction,
  type MedidasBasicasState,
} from "@/actions/persona";
import { MetricRow } from "@/components/ui/MetricRow";

type SummaryMetricsProps = {
  cc: string;
  masaCorporal: number;
  talla: number;
};

const initialState: MedidasBasicasState = {
  error: null,
  success: false,
  masaCorporal: null,
  talla: null,
};

function formatValue(value: number, unit?: string) {
  const formatted = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

  return unit ? `${formatted} ${unit}` : formatted;
}

export function SummaryMetrics({
  cc,
  masaCorporal,
  talla,
}: SummaryMetricsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState({ masaCorporal, talla });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await actualizarMedidasBasicasAction(
        initialState,
        formData,
      );

      if (
        result.success &&
        result.masaCorporal !== null &&
        result.talla !== null
      ) {
        setValues({ masaCorporal: result.masaCorporal, talla: result.talla });
        setIsEditing(false);
        router.refresh();
        return;
      }

      setError(result.error ?? "No fue posible actualizar los datos.");
    });
  }

  if (isEditing) {
    return (
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl border border-gray-200 bg-bg-main px-4 py-3 dark:border-white/10 dark:bg-bg-soft"
      >
        <input type="hidden" name="cc" value={cc} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="masaCorporal"
              className="text-sm text-text-secondary"
            >
              Peso (kg)
            </label>
            <input
              id="masaCorporal"
              name="masaCorporal"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              defaultValue={values.masaCorporal}
              required
              className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/10 dark:text-white dark:focus:border-white/15"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="talla" className="text-sm text-text-secondary">
              Talla (m)
            </label>
            <input
              id="talla"
              name="talla"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              defaultValue={values.talla}
              required
              className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/10 dark:text-white dark:focus:border-white/15"
            />
          </div>
        </div>
        <p className="text-xs text-text-tertiary">
          Si ingresas libras o centímetros, se convierten automáticamente a kg y
          metros.
        </p>
        {error ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-bg-soft px-4 py-2 text-sm font-medium tracking-tight text-text-primary shadow-sm transition duration-200 active:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/6 dark:text-white dark:shadow-none"
          >
            {isPending ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm text-text-secondary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-1 rounded-xl border border-gray-200 bg-bg-main px-4 py-3 sm:grid-cols-3 sm:gap-4 dark:border-white/10 dark:bg-bg-soft">
        <MetricRow label="Identificación" value={cc} compact />
        <MetricRow
          label="Peso"
          value={formatValue(values.masaCorporal, "kg")}
          compact
        />
        <MetricRow label="Talla" value={formatValue(values.talla, "m")} compact />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-sm text-text-secondary underline-offset-4 hover:underline"
        >
          Editar peso y talla
        </button>
      </div>
    </div>
  );
}

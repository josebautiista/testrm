"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  actualizarDisponibilidadAction,
  type DisponibilidadState,
} from "@/actions/persona";
import { MetricRow } from "@/components/ui/MetricRow";

type DisponibilidadCardProps = {
  cc: string;
  mesesEntrenamiento: number;
  diasDisponibles: number;
  minutosPorSesion: number;
  equipamiento: string[];
  limitaciones: string | null;
};

const initialState: DisponibilidadState = { error: null, success: false };

export function DisponibilidadCard({
  cc,
  mesesEntrenamiento,
  diasDisponibles,
  minutosPorSesion,
  equipamiento,
  limitaciones,
}: DisponibilidadCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState({
    mesesEntrenamiento,
    diasDisponibles,
    minutosPorSesion,
    equipamiento,
    limitaciones,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await actualizarDisponibilidadAction(initialState, formData);

      if (result.success) {
        setValues({
          mesesEntrenamiento: Number(formData.get("mesesEntrenamiento")),
          diasDisponibles: Number(formData.get("diasDisponibles")),
          minutosPorSesion: Number(formData.get("minutosPorSesion")),
          equipamiento: String(formData.get("equipamiento") || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          limitaciones: String(formData.get("limitaciones") || "") || null,
        });
        setIsEditing(false);
        router.refresh();
        return;
      }

      setError(result.error ?? "No fue posible actualizar la disponibilidad.");
    });
  }

  if (isEditing) {
    return (
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl border border-gray-200 bg-bg-main px-4 py-3 dark:border-white/10 dark:bg-bg-soft"
      >
        <input type="hidden" name="cc" value={cc} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="mesesEntrenamiento" className="text-sm text-text-secondary">
              Meses entrenando
            </label>
            <input
              id="mesesEntrenamiento"
              name="mesesEntrenamiento"
              type="number"
              min="0"
              step="1"
              defaultValue={values.mesesEntrenamiento}
              required
              className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-gray-300 dark:border-white/10 dark:text-white dark:focus:border-white/15"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="diasDisponibles" className="text-sm text-text-secondary">
              Días/semana (1–7)
            </label>
            <input
              id="diasDisponibles"
              name="diasDisponibles"
              type="number"
              min="1"
              max="7"
              step="1"
              defaultValue={values.diasDisponibles}
              required
              className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-gray-300 dark:border-white/10 dark:text-white dark:focus:border-white/15"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="minutosPorSesion" className="text-sm text-text-secondary">
              Minutos/sesión (20–240)
            </label>
            <input
              id="minutosPorSesion"
              name="minutosPorSesion"
              type="number"
              min="20"
              max="240"
              step="5"
              defaultValue={values.minutosPorSesion}
              required
              className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-gray-300 dark:border-white/10 dark:text-white dark:focus:border-white/15"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="equipamiento" className="text-sm text-text-secondary">
            Equipamiento disponible (separado por comas)
          </label>
          <input
            id="equipamiento"
            name="equipamiento"
            type="text"
            defaultValue={values.equipamiento.join(", ")}
            placeholder="barra, mancuerna, maquina, polea"
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-gray-300 dark:border-white/10 dark:text-white dark:focus:border-white/15"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="limitaciones" className="text-sm text-text-secondary">
            Limitaciones o lesiones
          </label>
          <textarea
            id="limitaciones"
            name="limitaciones"
            defaultValue={values.limitaciones ?? ""}
            rows={2}
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-gray-300 dark:border-white/10 dark:text-white dark:focus:border-white/15"
          />
        </div>
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
        <MetricRow label="Meses entrenando" value={String(values.mesesEntrenamiento)} compact />
        <MetricRow label="Días/semana" value={String(values.diasDisponibles)} compact />
        <MetricRow label="Minutos/sesión" value={String(values.minutosPorSesion)} compact />
      </div>
      {values.equipamiento.length > 0 ? (
        <p className="px-1 text-xs text-text-tertiary">
          Equipamiento: {values.equipamiento.join(", ")}
        </p>
      ) : null}
      {values.limitaciones ? (
        <p className="px-1 text-xs text-text-tertiary">
          Limitaciones: {values.limitaciones}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-sm text-text-secondary underline-offset-4 hover:underline"
        >
          Editar disponibilidad
        </button>
      </div>
    </div>
  );
}

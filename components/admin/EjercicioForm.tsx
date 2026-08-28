"use client";

import { useActionState } from "react";

import {
  PATRONES_MOVIMIENTO,
  TIPOS_EQUIPAMIENTO,
} from "@/lib/ejercicio-catalogo";
import { Select } from "@/components/ui/Select";
import type { EjercicioFormState } from "@/actions/ejercicio";

type EjercicioDefaults = {
  nombre: string;
  patron: string;
  musculoPrimario: string;
  musculosSecundarios: string[];
  equipamiento: string;
  incrementoMinimoKg: number;
  porcentajeMasaHombre: number;
  porcentajeMasaMujer: number;
  admitePorcentajeRm: boolean;
  esDeTiempo: boolean;
  esUnilateral: boolean;
  enBateriaEvaluacion: boolean;
  activo: boolean;
};

const DEFAULTS: EjercicioDefaults = {
  nombre: "",
  patron: "accesorio",
  musculoPrimario: "",
  musculosSecundarios: [],
  equipamiento: "otro",
  incrementoMinimoKg: 2.5,
  porcentajeMasaHombre: 0.5,
  porcentajeMasaMujer: 0.4,
  admitePorcentajeRm: true,
  esDeTiempo: false,
  esUnilateral: false,
  enBateriaEvaluacion: false,
  activo: true,
};

export function EjercicioForm({
  action,
  ejercicio,
  submitLabel,
}: {
  action: (state: EjercicioFormState, formData: FormData) => Promise<EjercicioFormState>;
  ejercicio?: Partial<EjercicioDefaults>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });
  const values = { ...DEFAULTS, ...ejercicio };

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-text-primary dark:text-white">Nombre</span>
          <input
            name="nombre"
            defaultValue={values.nombre}
            required
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary dark:border-white/10 dark:text-white"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-text-primary dark:text-white">Patrón de movimiento</span>
          <Select
            name="patron"
            defaultValue={values.patron}
            className="py-2.5 text-sm capitalize"
            ariaLabel="Patrón de movimiento"
            options={PATRONES_MOVIMIENTO.map((p) => ({
              value: p,
              label: p.replace(/_/g, " "),
            }))}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-text-primary dark:text-white">Músculo primario</span>
          <input
            name="musculoPrimario"
            defaultValue={values.musculoPrimario}
            required
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary dark:border-white/10 dark:text-white"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-text-primary dark:text-white">Músculos secundarios (separados por comas)</span>
          <input
            name="musculosSecundarios"
            defaultValue={values.musculosSecundarios.join(", ")}
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary dark:border-white/10 dark:text-white"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-text-primary dark:text-white">Equipamiento</span>
          <Select
            name="equipamiento"
            defaultValue={values.equipamiento}
            className="py-2.5 text-sm capitalize"
            ariaLabel="Equipamiento"
            options={TIPOS_EQUIPAMIENTO.map((e) => ({
              value: e,
              label: e.replace(/_/g, " "),
            }))}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-text-primary dark:text-white">Incremento mínimo (kg)</span>
          <input
            type="number"
            step="0.5"
            min="0.5"
            name="incrementoMinimoKg"
            defaultValue={values.incrementoMinimoKg}
            required
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary dark:border-white/10 dark:text-white"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-text-primary dark:text-white">% masa corporal (hombre) — calibración del test</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="porcentajeMasaHombre"
            defaultValue={values.porcentajeMasaHombre}
            required
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary dark:border-white/10 dark:text-white"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-text-primary dark:text-white">% masa corporal (mujer) — calibración del test</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="porcentajeMasaMujer"
            defaultValue={values.porcentajeMasaMujer}
            required
            className="w-full rounded-xl border border-gray-200 bg-bg-soft px-3 py-2 text-sm text-text-primary dark:border-white/10 dark:text-white"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-text-primary dark:text-white">
          <input type="checkbox" name="admitePorcentajeRm" defaultChecked={values.admitePorcentajeRm} />
          Admite prescripción por %1RM
        </label>
        <label className="flex items-center gap-2 text-sm text-text-primary dark:text-white">
          <input type="checkbox" name="esDeTiempo" defaultChecked={values.esDeTiempo} />
          Es de tiempo (no carga)
        </label>
        <label className="flex items-center gap-2 text-sm text-text-primary dark:text-white">
          <input type="checkbox" name="esUnilateral" defaultChecked={values.esUnilateral} />
          Es unilateral
        </label>
        <label className="flex items-center gap-2 text-sm text-text-primary dark:text-white">
          <input type="checkbox" name="enBateriaEvaluacion" defaultChecked={values.enBateriaEvaluacion} />
          En batería de evaluación
        </label>
        <label className="flex items-center gap-2 text-sm text-text-primary dark:text-white">
          <input type="checkbox" name="activo" defaultChecked={values.activo} />
          Activo
        </label>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl border border-transparent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { getPorcentajeMasa } from "@/helpers/calculations";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";
import { createSesionAction } from "@/actions/sesion";

function formatWeight(value: number) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

type Ejercicio = {
  id: number;
  nombre: string;
  porcentajeMasaHombre: number;
  porcentajeMasaMujer: number;
};

type Persona = {
  id: number;
  masaCorporal: number;
  sexo: string;
};

interface Props {
  cc: string;
  requestId: string;
  persona: Persona;
  ejercicios: Ejercicio[];
  error?: string;
}

export function NuevaSesionForm({ cc, requestId, persona, ejercicios, error }: Props) {
  const [pesoActual, setPesoActual] = useState<number | "">(persona.masaCorporal);

  function getCargaBase(ejercicio: Ejercicio) {
    const masa = typeof pesoActual === "number" ? pesoActual : 0;
    return masa * getPorcentajeMasa(persona, ejercicio);
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-xl border border-gray-200 bg-bg-soft px-4 py-3 text-sm text-text-secondary dark:border-white/6">
          {error}
        </p>
      ) : null}

      <form action={createSesionAction} className="space-y-8">
        <input type="hidden" name="cc" value={cc} />
        <input type="hidden" name="requestId" value={requestId} />

        <Section title="Datos de la sesion">
          <label className="flex flex-col gap-2 py-4">
            <span className="text-sm font-medium text-text-primary dark:text-white">
              Peso actual (kg)
            </span>
            <input
              type="number"
              name="peso"
              min="0"
              step="0.1"
              value={pesoActual}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setPesoActual(isNaN(val) ? "" : val);
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-white/10 dark:bg-bg-soft dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-400"
              required
            />
          </label>
        </Section>

        <Section title="Ejercicios">
          <div className="divide-y divide-gray-200 dark:divide-white/6">
            {ejercicios.map((ejercicio) => (
              <label
                key={ejercicio.id}
                htmlFor={`repeticiones_${ejercicio.id}`}
                className="flex items-end justify-between gap-4 py-4"
              >
                <div className="space-y-1">
                  <p className="text-base text-text-primary dark:text-white">
                    {ejercicio.nombre}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-text-tertiary">
                    carga base {formatWeight(getCargaBase(ejercicio))} kg
                  </p>
                </div>

                <div className="text-right">
                  <input
                    id={`repeticiones_${ejercicio.id}`}
                    name={`repeticiones_${ejercicio.id}`}
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                    inputMode="numeric"
                    className="w-20 border-0 bg-transparent p-0 text-right text-3xl font-semibold leading-none tracking-tight text-text-primary outline-none dark:text-white"
                  />
                  <p className="mt-1 text-xs uppercase tracking-wide text-text-tertiary">
                    reps
                  </p>
                </div>

                <input type="hidden" name="ejercicioIds" value={ejercicio.id} />
              </label>
            ))}
          </div>
        </Section>

        <PrimaryButton type="submit">Guardar sesion</PrimaryButton>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { startNuevaSesionTour, hasSeenTour } from "@/lib/onboarding";
import { getPorcentajeMasa } from "@/helpers/calculations";
import { getAvailableRMMethods } from "@/lib/training-flow";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { Section } from "@/components/ui/Section";
import { createSesionAction } from "@/actions/sesion";
import { CasasProtocol } from "./CasasProtocol";
import { NacleiroTable } from "./NacleiroTable";

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

type RMMethod = "estimation" | "casas" | "nacleiro";

interface Props {
  cc: string;
  requestId: string;
  persona: Persona;
  ejercicios: Ejercicio[];
  error?: string;
}

export function NuevaSesionForm({
  cc,
  requestId,
  persona,
  ejercicios,
  error,
}: Props) {
  const [pesoActual, setPesoActual] = useState<number | "">(
    persona.masaCorporal,
  );
  const [trainingMonthsInput, setTrainingMonthsInput] = useState("");
  const [trainingMonths, setTrainingMonths] = useState<number | null>(null);
  const [rmMethod, setRMMethod] = useState<RMMethod>("estimation");

  const availableRMMethods = useMemo(
    () =>
      trainingMonths === null ? [] : getAvailableRMMethods(trainingMonths),
    [trainingMonths],
  );
  const canUseAdvancedMethods = availableRMMethods.includes("casas");

  useEffect(() => {
    if (trainingMonths !== null && trainingMonths >= 4) {
      const key = "nueva-sesion-tour-seen";
      if (!hasSeenTour(key)) {
        startNuevaSesionTour().catch(() => {});
      }
    }
  }, [trainingMonths]);

  function getCargaBase(ejercicio: Ejercicio) {
    const masa = typeof pesoActual === "number" ? pesoActual : 0;
    return masa * getPorcentajeMasa(persona, ejercicio);
  }

  function getSuggestedRM(ejercicio: Ejercicio) {
    return getCargaBase(ejercicio) * 1.25;
  }

  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  }

  function handleTrainingMonthsSubmit() {
    const parsed = Number(trainingMonthsInput);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setTrainingMonths(0);
      setTrainingMonthsInput("0");
      setRMMethod("estimation");
      return;
    }

    const normalizedMonths = Math.floor(parsed);
    setTrainingMonths(normalizedMonths);
    setTrainingMonthsInput(String(normalizedMonths));
    setRMMethod("estimation");
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {trainingMonths === null ? (
        <section className="rounded-2xl border border-gray-200 bg-bg-soft p-6 text-center dark:border-white/10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-text-secondary">
            Primera pregunta
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-text-primary dark:text-white">
            ¿Cuánto tiempo llevas entrenando?
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Usaremos tu experiencia para mostrar automáticamente los métodos de
            fuerza más adecuados para ti.
          </p>
          <div className="mx-auto mt-6 max-w-sm space-y-3">
            <label className="block text-left">
              <span className="text-sm font-medium text-text-primary dark:text-white">
                Meses entrenando
              </span>
              <input
                type="number"
                name="trainingMonths"
                min="0"
                step="1"
                inputMode="numeric"
                value={trainingMonthsInput}
                onChange={(e) => setTrainingMonthsInput(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-main px-4 py-4 text-lg text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-white/10 dark:bg-bg-subtle dark:text-white"
                placeholder="Ej. 3"
              />
            </label>
            <button
              type="button"
              onClick={handleTrainingMonthsSubmit}
              className="w-full rounded-2xl border border-transparent bg-text-primary px-4 py-4 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-black dark:hover:opacity-80"
            >
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {trainingMonths !== null ? (
        <form
          action={createSesionAction}
          className="space-y-8"
          onKeyDown={handleFormKeyDown}
        >
          <input type="hidden" name="cc" value={cc} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="trainingMonths" value={trainingMonths} />
          <input type="hidden" name="rmMethod" value={rmMethod} />

          <Section title="Datos de la sesión">
            <label className="flex flex-col gap-2 py-4">
              <span className="text-sm font-medium text-text-primary dark:text-white">
                Tu peso actual (kg)
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
                className="session-weight-field rounded-2xl border border-gray-300 bg-white px-4 py-4 text-lg text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-white/10 dark:bg-bg-soft dark:text-white dark:focus:border-accent dark:focus:ring-accent/40"
                required
                placeholder="Ej. 78.5"
              />
            </label>
            {!canUseAdvancedMethods ? (
              <div className="rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-sm text-text-secondary dark:border-white/10">
                Elige un peso que puedas controlar durante 5-8 repeticiones con
                buena técnica. No necesitas levantar al límite.
              </div>
            ) : null}
          </Section>

          <section className="rounded-2xl border border-gray-200 bg-bg-soft p-5 dark:border-white/10">
            {!canUseAdvancedMethods ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary dark:text-white">
                    Estimación de fuerza
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Calcula tu fuerza de forma segura sin esfuerzo máximo
                  </p>
                </div>
                <p className="text-sm leading-6 text-text-secondary">
                  Para tu nivel actual, es más seguro estimar tu fuerza sin
                  realizar pruebas máximas
                </p>
                <div className="rounded-2xl border border-gray-200 bg-bg-main px-4 py-3 text-sm text-text-secondary dark:border-white/10 dark:bg-bg-subtle">
                  Los tests de fuerza máxima requieren experiencia previa para
                  evitar lesiones
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary dark:text-white">
                    Evaluación de fuerza
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Puedes usar métodos avanzados para obtener una medición más
                    precisa
                  </p>
                </div>
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold text-text-primary dark:text-white">
                    ¿Cómo quieres evaluar tu fuerza?
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <RMMethodOption
                      checked={rmMethod === "estimation"}
                      label="Estimación"
                      description="Calcula tu fuerza de forma segura sin esfuerzo máximo"
                      onSelect={() => setRMMethod("estimation")}
                    />
                    <RMMethodOption
                      checked={rmMethod === "casas"}
                      label="Protocolo Casas"
                      description="Te guía paso a paso para encontrar tu peso máximo"
                      onSelect={() => setRMMethod("casas")}
                    />
                    <RMMethodOption
                      checked={rmMethod === "nacleiro"}
                      label="Test Nacleiro"
                      description="Test progresivo para usuarios con experiencia"
                      onSelect={() => setRMMethod("nacleiro")}
                    />
                  </div>
                </fieldset>
              </div>
            )}
          </section>

          {rmMethod === "estimation" ? (
            <Section title="Estimación">
              <input
                type="hidden"
                name="protocolData"
                value={JSON.stringify({ method: "estimation" })}
              />
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                  Ingresa el peso levantado y las repeticiones realizadas. El
                  sistema calculará tu 1RM con Epley y Brzycki.
                </p>
                <div className="divide-y divide-gray-200 dark:divide-white/6">
                  {ejercicios.map((ejercicio) => (
                    <div
                      key={ejercicio.id}
                      className="grid gap-3 py-4 sm:grid-cols-[1fr_9rem_9rem]"
                    >
                      <div>
                        <p className="text-base font-semibold text-text-primary dark:text-white">
                          {ejercicio.nombre}
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
                          Sugerido: {formatWeight(getCargaBase(ejercicio))} kg
                        </p>
                      </div>
                      <label>
                        <span className="text-sm font-medium text-text-primary dark:text-white">
                          Peso levantado
                        </span>
                        <input
                          name={`carga_${ejercicio.id}`}
                          type="number"
                          min="0"
                          step="0.5"
                          defaultValue={formatWeight(getCargaBase(ejercicio))}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-right text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                        />
                      </label>
                      <label>
                        <span className="text-sm font-medium text-text-primary dark:text-white">
                          Repeticiones
                        </span>
                        <input
                          name={`repeticiones_${ejercicio.id}`}
                          type="number"
                          min="0"
                          step="1"
                          defaultValue="0"
                          inputMode="numeric"
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-bg-soft px-4 py-3 text-right text-text-primary outline-none transition focus:border-accent dark:border-white/10 dark:bg-bg-main dark:text-white"
                        />
                      </label>
                      <input
                        type="hidden"
                        name="ejercicioIds"
                        value={ejercicio.id}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          ) : null}

          {rmMethod === "casas" && canUseAdvancedMethods ? (
            <Section title="Protocolo Casas">
              <CasasProtocol
                ejercicios={ejercicios}
                getSuggestedWeight={getCargaBase}
                formatWeight={formatWeight}
              />
              {ejercicios.map((ejercicio) => (
                <input
                  key={ejercicio.id}
                  type="hidden"
                  name="ejercicioIds"
                  value={ejercicio.id}
                />
              ))}
            </Section>
          ) : null}

          {rmMethod === "nacleiro" && canUseAdvancedMethods ? (
            <Section title="Test Nacleiro">
              <NacleiroTable
                ejercicios={ejercicios}
                bodyWeight={typeof pesoActual === "number" ? pesoActual : 0}
                getSuggestedRM={getSuggestedRM}
                formatWeight={formatWeight}
              />
              {ejercicios.map((ejercicio) => (
                <input
                  key={ejercicio.id}
                  type="hidden"
                  name="ejercicioIds"
                  value={ejercicio.id}
                />
              ))}
            </Section>
          ) : null}

          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-bg-soft px-4 py-3 text-sm text-text-secondary dark:border-white/10 dark:bg-bg-main">
              <p className="font-semibold text-text-primary dark:text-white">
                Consejo rápido
              </p>
              <p>
                Al guardar, quedará registrada la evaluación y verás los
                resultados de 1RM en tu historial.
              </p>
            </div>
            <div className="session-save-button">
              <FormSubmitButton pendingLabel="Guardando sesión...">
                Guardar sesión
              </FormSubmitButton>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function RMMethodOption({
  checked,
  label,
  description,
  onSelect,
}: {
  checked: boolean;
  label: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <label className="cursor-pointer rounded-2xl border border-gray-200 bg-bg-main p-4 transition has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/20 dark:border-white/10 dark:bg-bg-subtle">
      <input
        type="radio"
        name="rmMethodOption"
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="text-sm font-semibold text-text-primary dark:text-white">
        {label}
      </span>
      <span className="mt-1 block text-sm text-text-secondary">
        {description}
      </span>
    </label>
  );
}

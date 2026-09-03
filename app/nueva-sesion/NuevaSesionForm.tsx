"use client";

import { useEffect, useMemo, useState } from "react";

import { startNuevaSesionTour, hasSeenTour } from "@/lib/onboarding";
import { getPorcentajeMasa } from "@/helpers/calculations";
import { EXERCISE_NOTES } from "@/lib/ejercicios-config";
import { getAvailableRMMethods } from "@/lib/training-flow";
import { Aviso, ComoFunciona } from "@/components/rm/ComoFunciona";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { Section } from "@/components/ui/Section";
import { createSesionAction } from "@/actions/sesion";
import { EstimacionEjercicios } from "./EstimacionEjercicios";
import { ProtocoloDirecto, type ProtocoloId } from "./ProtocoloDirecto";

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
  esDeTiempo: boolean;
  patron: string;
  incrementoMinimoKg: number;
  rmVigenteKg: number | null;
  rmVigenteFecha: string | null;
};

type Persona = {
  id: number;
  masaCorporal: number;
  sexo: string;
};

type RMMethod = "estimation" | ProtocoloId;

interface Props {
  cc: string;
  requestId: string;
  persona: Persona;
  ejercicios: Ejercicio[];
  error?: string;
  macrocicloId?: string;
  returnTo?: string;
}

/**
 * ADR-33 — cribado antes de un test máximo.
 *
 * Los meses de entrenamiento son autorreportados y no discriminan riesgo: la
 * revisión sistemática de fiabilidad del 1RM (Grgic 2020) muestra que el test
 * es seguro y fiable incluso sin familiarización previa. Lo que sí importa es
 * la competencia técnica en ese ejercicio concreto y el cribado de salud, que
 * es lo que las guías clínicas piden antes de un esfuerzo máximo.
 */
const CRIBADO_SEGURIDAD = [
  {
    id: "cardio",
    texto:
      "No tengo un diagnóstico cardiovascular ni tensión arterial alta sin controlar.",
  },
  {
    id: "lesion",
    texto:
      "No tengo una lesión activa ni dolor en el movimiento que voy a evaluar.",
  },
  {
    id: "tecnica",
    texto:
      "Domino la técnica de este ejercicio y ya he entrenado con cargas altas en él.",
  },
  {
    id: "asistencia",
    texto:
      "Voy a hacerlo con alguien que pueda asistirme, o con topes de seguridad puestos.",
  },
  {
    id: "respiracion",
    texto:
      "Sé que debo exhalar durante el esfuerzo y no aguantar la respiración.",
  },
] as const;

export function NuevaSesionForm({
  cc,
  requestId,
  persona,
  ejercicios,
  error,
  macrocicloId,
  returnTo,
}: Props) {
  const [pesoActual, setPesoActual] = useState<number | "">(
    persona.masaCorporal,
  );
  const [trainingMonthsInput, setTrainingMonthsInput] = useState("");
  const [trainingMonths, setTrainingMonths] = useState<number | null>(null);
  const [rmMethod, setRMMethod] = useState<RMMethod>("estimation");
  const [protocolFinalRM, setProtocolFinalRM] = useState(0);
  const [cribado, setCribado] = useState<Record<string, boolean>>({});

  const availableRMMethods = useMemo(
    () => (trainingMonths === null ? [] : getAvailableRMMethods(trainingMonths)),
    [trainingMonths],
  );
  const experienciaSuficiente = availableRMMethods.includes("casas");
  const cribadoCompleto = CRIBADO_SEGURIDAD.every((item) => cribado[item.id]);
  const canUseAdvancedMethods = experienciaSuficiente && cribadoCompleto;

  useEffect(() => {
    if (trainingMonths !== null && trainingMonths >= 4) {
      const key = "nueva-sesion-tour-seen";
      if (!hasSeenTour(key)) {
        startNuevaSesionTour().catch(() => {});
      }
    }
  }, [trainingMonths]);

  // Si el cribado deja de estar completo, el método efectivo vuelve a
  // estimación sin tocar la selección del atleta: desmarcar un punto del
  // cribado no debe borrar en silencio lo que había elegido, solo bloquearlo.
  const metodoEfectivo: RMMethod = canUseAdvancedMethods
    ? rmMethod
    : "estimation";

  const ejerciciosEstimacion = useMemo(() => {
    const masa = typeof pesoActual === "number" ? pesoActual : 0;

    return ejercicios.map((ejercicio) => ({
      id: ejercicio.id,
      nombre: ejercicio.nombre,
      patron: ejercicio.patron,
      incrementoMinimoKg: ejercicio.incrementoMinimoKg,
      esDeTiempo: ejercicio.esDeTiempo,
      cargaSugerida: masa * getPorcentajeMasa(persona, ejercicio),
      nota: EXERCISE_NOTES[ejercicio.id],
    }));
  }, [ejercicios, persona, pesoActual]);

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

  function handleTrainingMonthsKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTrainingMonthsSubmit();
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {trainingMonths === null ? (
        <section className="space-y-4">
          <ComoFunciona
            titulo="Qué es un test de RM y por qué empezamos aquí"
            resumen="El RM (repetición máxima) es el peso máximo que puedes levantar una sola vez en un ejercicio. Es el número del que se derivan todas tus cargas de entrenamiento, así que vale la pena medirlo bien. Hay dos caminos: estimarlo con una serie submáxima, o medirlo directamente subiendo peso hasta tu límite."
            pasos={[
              {
                titulo: "Nos dices cuánto llevas entrenando",
                detalle:
                  "Sirve para saber qué métodos ofrecerte de entrada. Puedes cambiar de método después.",
              },
              {
                titulo: "Eliges cómo evaluar",
                detalle:
                  "Estimación (segura, sin esfuerzo máximo) o un protocolo directo (más preciso, exige experiencia y cribado de seguridad).",
              },
              {
                titulo: "La app te guía paso a paso",
                detalle:
                  "Pesos, repeticiones, descansos y cronómetro. Solo tienes que registrar lo que pasó de verdad.",
              },
              {
                titulo: "El resultado queda por ejercicio",
                detalle:
                  "No existe un 'RM general': tu fuerza en sentadilla no dice nada de tu press de banca. Cada ejercicio guarda el suyo.",
              },
            ]}
            porQue="Un RM mal medido no es un dato con un poco de ruido: es un número que se propaga a todas las sesiones de tu plan. Por eso la app prefiere pedirte que repitas un intento antes que guardar una estimación pobre."
          />

          <div className="rounded-2xl border border-gray-200 bg-bg-soft p-6 text-center dark:border-white/10">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-text-secondary">
              Primera pregunta
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-text-primary dark:text-white">
              ¿Cuánto tiempo llevas entrenando?
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Con menos de 4 meses te mostramos solo la estimación, que no
              requiere levantar tu peso máximo.
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
                  onKeyDown={handleTrainingMonthsKeyDown}
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
          <input type="hidden" name="rmMethod" value={metodoEfectivo} />
          {macrocicloId ? (
            <input type="hidden" name="macrocicloId" value={macrocicloId} />
          ) : null}
          {returnTo ? (
            <input type="hidden" name="returnTo" value={returnTo} />
          ) : null}

          <Section title="Datos de la sesión">
            <label className="flex flex-col gap-2 py-4">
              <span className="text-sm font-medium text-text-primary dark:text-white">
                Tu peso actual (kg)
              </span>
              <span className="text-xs text-text-tertiary">
                Se usa para calcular los pesos de partida de la estimación y
                para tu relación fuerza/peso.
              </span>
              <input
                type="number"
                name="peso"
                min="0"
                step="0.1"
                inputMode="decimal"
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
          </Section>

          <Section title="Cómo quieres evaluar tu fuerza">
            <div className="space-y-4 pt-2">
              {!experienciaSuficiente ? (
                <Aviso tono="info" titulo="Vas a usar la estimación">
                  Con menos de 4 meses de entrenamiento registrado, la app te
                  propone estimar tu fuerza a partir de una serie submáxima. No
                  tienes que levantar tu peso máximo: haces repeticiones con un
                  peso moderado y la fórmula calcula el resto. Los protocolos
                  directos se desbloquean a partir de los 4 meses.
                </Aviso>
              ) : (
                <>
                  <div className="rounded-2xl border border-gray-200 bg-bg-soft p-4 dark:border-white/10 dark:bg-bg-subtle">
                    <p className="text-sm font-semibold text-text-primary dark:text-white">
                      Antes de un test máximo
                    </p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      Los protocolos Casas y Naclerio te llevan hasta tu límite
                      real. Confirma estos cinco puntos para habilitarlos. Si no
                      puedes marcar alguno, usa la estimación: es igual de útil
                      para planificar y no te expone.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {CRIBADO_SEGURIDAD.map((item) => (
                        <li key={item.id}>
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={cribado[item.id] ?? false}
                              onChange={(evento) =>
                                setCribado((actual) => ({
                                  ...actual,
                                  [item.id]: evento.target.checked,
                                }))
                              }
                              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                            />
                            <span className="text-sm leading-6 text-text-secondary">
                              {item.texto}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    {!cribadoCompleto ? (
                      <p className="mt-3 text-xs leading-5 text-text-tertiary">
                        Faltan puntos por confirmar. Mientras tanto solo está
                        disponible la estimación.
                      </p>
                    ) : null}
                  </div>

                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-text-primary dark:text-white">
                      Método de evaluación
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <RMMethodOption
                        checked={rmMethod === "estimation"}
                        label="Estimación"
                        description="Una serie submáxima y una fórmula. Sin esfuerzo máximo, ~10 min."
                        onSelect={() => {
                          setRMMethod("estimation");
                          setProtocolFinalRM(0);
                        }}
                      />
                      <RMMethodOption
                        checked={rmMethod === "casas"}
                        label="Protocolo Casas"
                        description="Test directo por escalones hasta tu peso máximo real. ~30 min, un ejercicio."
                        disabled={!canUseAdvancedMethods}
                        onSelect={() => {
                          setRMMethod("casas");
                          setProtocolFinalRM(0);
                        }}
                      />
                      <RMMethodOption
                        checked={rmMethod === "naclerio"}
                        label="Test de Naclerio"
                        description="8 series de 2-3 reps a máxima velocidad, con esfuerzo percibido. ~40 min, un ejercicio."
                        disabled={!canUseAdvancedMethods}
                        onSelect={() => {
                          setRMMethod("naclerio");
                          setProtocolFinalRM(0);
                        }}
                      />
                    </div>
                    <p className="text-xs leading-5 text-text-tertiary">
                      La estimación evalúa varios ejercicios de una vez; los
                      protocolos directos miden un solo ejercicio con mucha más
                      precisión.
                    </p>
                  </fieldset>
                </>
              )}
            </div>
          </Section>

          {metodoEfectivo === "estimation" ? (
            <Section title="Estimación">
              <input
                type="hidden"
                name="protocolData"
                value={JSON.stringify({ metodo: "estimacion" })}
              />
              <div className="pt-2">
                <EstimacionEjercicios
                  ejercicios={ejerciciosEstimacion}
                  formatWeight={formatWeight}
                />
              </div>
            </Section>
          ) : null}

          {metodoEfectivo !== "estimation" ? (
            <Section
              title={
                metodoEfectivo === "casas"
                  ? "Protocolo Casas"
                  : "Test de Naclerio"
              }
            >
              <div className="pt-2">
                <ProtocoloDirecto
                  protocolo={metodoEfectivo}
                  formatWeight={formatWeight}
                  onRmMedidoChange={setProtocolFinalRM}
                />
              </div>
            </Section>
          ) : null}

          <div className="space-y-4">
            <Aviso tono="info" titulo="Al guardar">
              Cada ejercicio con una estimación utilizable pasa a ser tu RM
              vigente para ese ejercicio, y desde ahí se calculan las cargas de
              tu plan. Los intentos fuera de rango quedan guardados como
              historial pero no reemplazan nada.
            </Aviso>
            <div className="session-save-button">
              <FormSubmitButton
                pendingLabel="Guardando sesión..."
                disabled={metodoEfectivo !== "estimation" && protocolFinalRM <= 0}
              >
                Guardar sesión
              </FormSubmitButton>
            </div>
            {metodoEfectivo !== "estimation" && protocolFinalRM <= 0 ? (
              <p className="text-xs leading-5 text-text-tertiary">
                El botón se habilita cuando haya al menos un levantamiento
                registrado con peso real y marcado como completado.
              </p>
            ) : null}
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
  disabled = false,
}: {
  checked: boolean;
  label: string;
  description: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={[
        "rounded-2xl border border-gray-200 bg-bg-main p-4 transition dark:border-white/10 dark:bg-bg-subtle",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/20",
      ].join(" ")}
    >
      <input
        type="radio"
        name="rmMethodOption"
        checked={checked}
        disabled={disabled}
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

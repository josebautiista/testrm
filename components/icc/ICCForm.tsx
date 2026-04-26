"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  calculateICC,
  getICCClassification,
  HealthClassification,
} from "@/helpers/calculations";
import {
  CIRCUMFERENCE_MAX_CM,
  CIRCUMFERENCE_MIN_CM,
  MedidasValidationErrors,
} from "@/helpers/validators";

type ICCFormProps = {
  cc: string;
  initialCintura?: number | null;
  initialCadera?: number | null;
  onSuccess: (data: {
    cintura: number;
    cadera: number;
    icc: number;
    classification: HealthClassification;
  }) => void;
};

type ICCApiErrorResponse = {
  error?: string;
  fieldErrors?: MedidasValidationErrors;
};

function parseNumericInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getFieldError(label: string, value: number): string | null {
  if (!Number.isFinite(value)) {
    return `Ingresa ${label} en centimetros.`;
  }

  if (value < CIRCUMFERENCE_MIN_CM || value > CIRCUMFERENCE_MAX_CM) {
    return `${label} debe estar entre ${CIRCUMFERENCE_MIN_CM} y ${CIRCUMFERENCE_MAX_CM} cm.`;
  }

  return null;
}

export function ICCForm({
  cc,
  initialCintura,
  initialCadera,
  onSuccess,
}: ICCFormProps) {
  const [cintura, setCintura] = useState(
    typeof initialCintura === "number" ? String(initialCintura) : "",
  );
  const [cadera, setCadera] = useState(
    typeof initialCadera === "number" ? String(initialCadera) : "",
  );
  const [errors, setErrors] = useState<MedidasValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const liveICC = useMemo(() => {
    const cinturaValue = parseNumericInput(cintura);
    const caderaValue = parseNumericInput(cadera);

    if (
      !Number.isFinite(cinturaValue) ||
      !Number.isFinite(caderaValue) ||
      caderaValue <= 0
    ) {
      return null;
    }

    const value = calculateICC(cinturaValue, caderaValue);
    return {
      value,
      classification: getICCClassification(value),
    };
  }, [cadera, cintura]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cinturaValue = parseNumericInput(cintura);
    const caderaValue = parseNumericInput(cadera);

    const nextErrors: MedidasValidationErrors = {
      cintura: getFieldError("La cintura", cinturaValue) ?? undefined,
      cadera: getFieldError("La cadera", caderaValue) ?? undefined,
    };

    if (nextErrors.cintura || nextErrors.cadera) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch(
        `/api/persona/medidas?cc=${encodeURIComponent(cc)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cintura: cinturaValue,
            cadera: caderaValue,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json()) as ICCApiErrorResponse;
        setErrors({
          ...payload.fieldErrors,
          form:
            payload.error ??
            payload.fieldErrors?.form ??
            "No fue posible guardar las medidas.",
        });
        return;
      }

      const payload = (await response.json()) as {
        cintura: number;
        cadera: number;
        icc: number;
        classification: HealthClassification;
      };

      onSuccess(payload);
    } catch {
      setErrors({
        form: "No fue posible conectar con el servidor.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="cintura" className="text-sm text-text-secondary">
          Cintura (cm)
        </label>
        <input
          id="cintura"
          name="cintura"
          type="number"
          step="0.1"
          min={CIRCUMFERENCE_MIN_CM}
          max={CIRCUMFERENCE_MAX_CM}
          inputMode="decimal"
          value={cintura}
          onChange={(event) => setCintura(event.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-3 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/10 dark:text-white dark:focus:border-white/15"
          placeholder="Ej: 78"
        />
        {errors.cintura ? (
          <p className="text-xs text-red-300">{errors.cintura}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="cadera" className="text-sm text-text-secondary">
          Cadera (cm)
        </label>
        <input
          id="cadera"
          name="cadera"
          type="number"
          step="0.1"
          min={CIRCUMFERENCE_MIN_CM}
          max={CIRCUMFERENCE_MAX_CM}
          inputMode="decimal"
          value={cadera}
          onChange={(event) => setCadera(event.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-bg-soft px-4 py-3 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:border-gray-300 dark:border-white/10 dark:text-white dark:focus:border-white/15"
          placeholder="Ej: 95"
        />
        {errors.cadera ? (
          <p className="text-xs text-red-300">{errors.cadera}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 bg-bg-soft px-4 py-3 dark:border-white/10">
        <p className="text-xs uppercase tracking-wide text-text-tertiary">
          ICC
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-text-primary dark:text-white">
          {liveICC ? liveICC.value.toFixed(2) : "--"}
        </p>
        {liveICC ? (
          <p className="mt-1 text-sm text-text-secondary">
            {liveICC.classification.label}
          </p>
        ) : (
          <p className="mt-1 text-sm text-text-secondary">
            Ingresa ambos valores para calcular tu indice.
          </p>
        )}
      </div>

      {errors.form ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errors.form}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-bg-soft px-4 py-3 text-base font-medium tracking-tight text-text-primary shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/6 dark:text-white dark:shadow-none"
      >
        {isSubmitting ? "Guardando..." : "Guardar medidas y calcular ICC"}
      </button>
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import {
  calculateICC,
  getICCClassification,
  HealthClassification,
} from "@/helpers/calculations";
import { ICCBottomSheet } from "@/components/icc/ICCBottomSheet";
import { ICCForm } from "@/components/icc/ICCForm";

type ICCSectionProps = {
  cc: string;
  cintura: number | null;
  cadera: number | null;
};

const badgeColorClass: Record<HealthClassification["color"], string> = {
  verde: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  amarillo: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  rojo: "bg-red-500/20 text-red-300 border-red-500/30",
};

export function ICCSection({ cc, cintura, cadera }: ICCSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedMeasures, setSavedMeasures] = useState({
    cintura,
    cadera,
  });

  const iccSummary = useMemo(() => {
    if (
      typeof savedMeasures.cintura !== "number" ||
      typeof savedMeasures.cadera !== "number" ||
      savedMeasures.cadera <= 0
    ) {
      return null;
    }

    const icc = calculateICC(savedMeasures.cintura, savedMeasures.cadera);
    return {
      icc,
      classification: getICCClassification(icc),
    };
  }, [savedMeasures.cadera, savedMeasures.cintura]);

  return (
    <section className="space-y-3">
      <h2 className="text-sm uppercase tracking-wide text-text-secondary">
        ICC
      </h2>

      {!iccSummary ? (
        <div className="rounded-2xl border border-gray-200 bg-bg-soft p-5 dark:border-white/8">
          <h3 className="text-lg font-semibold tracking-tight text-text-primary dark:text-white">
            Calcula tu indice cintura-cadera (ICC)
          </h3>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-bg-main px-4 py-3 text-base font-medium tracking-tight text-text-primary shadow-sm dark:border-white/6 dark:text-white dark:shadow-none"
          >
            Calcular
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-bg-soft p-5 dark:border-white/8">
          <p className="text-xs uppercase tracking-[0.12em] text-text-tertiary">
            Indice cintura-cadera
          </p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-5xl font-semibold leading-none tracking-tight text-text-primary dark:text-white">
              {iccSummary.icc.toFixed(2)}
            </p>
            <span
              className={[
                "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
                badgeColorClass[iccSummary.classification.color],
              ].join(" ")}
            >
              {iccSummary.classification.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="mt-4 text-sm text-text-secondary underline-offset-4 hover:underline"
          >
            Actualizar medidas
          </button>
        </div>
      )}

      <ICCBottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Calcular ICC"
      >
        <div className="space-y-6">
          <article className="space-y-2 rounded-xl border border-gray-200 bg-bg-soft p-4 dark:border-white/8">
            <p className="text-xs uppercase tracking-wide text-text-tertiary">
              Paso 1
            </p>
            <h4 className="text-base font-semibold text-text-primary dark:text-white">
              Como medir tu cintura
            </h4>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
              <Image
                src="/cintura.png"
                alt="Instructivo de como medir la cintura con cinta metrica"
                width={960}
                height={640}
                className="h-auto w-full"
                sizes="(max-width: 768px) 100vw, 640px"
                priority={false}
              />
            </div>
          </article>

          <article className="space-y-2 rounded-xl border border-gray-200 bg-bg-soft p-4 dark:border-white/8">
            <p className="text-xs uppercase tracking-wide text-text-tertiary">
              Paso 2
            </p>
            <h4 className="text-base font-semibold text-text-primary dark:text-white">
              Como medir tu cadera
            </h4>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
              <Image
                src="/cadera.png"
                alt="Instructivo de como medir la cadera con cinta metrica"
                width={960}
                height={640}
                className="h-auto w-full"
                sizes="(max-width: 768px) 100vw, 640px"
                priority={false}
              />
            </div>
          </article>

          <article className="space-y-3 rounded-xl border border-gray-200 bg-bg-soft p-4 dark:border-white/8">
            <p className="text-xs uppercase tracking-wide text-text-tertiary">
              Paso 3
            </p>
            <h4 className="text-base font-semibold text-text-primary dark:text-white">
              Ingresa tus medidas
            </h4>
            <ICCForm
              cc={cc}
              initialCintura={savedMeasures.cintura}
              initialCadera={savedMeasures.cadera}
              onSuccess={(data) => {
                setSavedMeasures({
                  cintura: data.cintura,
                  cadera: data.cadera,
                });
                setIsOpen(false);
              }}
            />
          </article>
        </div>
      </ICCBottomSheet>
    </section>
  );
}

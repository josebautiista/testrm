"use client";

import { useMemo } from "react";
import InfoTooltip from "@/components/ui/InfoTooltip";

type SexoInput = "hombre" | "mujer" | "masculino" | "femenino";

type ICCRow = {
  min: number;
  max: number | null;
  rangeLabel: string;
  label: string;
  color: "verde" | "amarillo" | "rojo";
};

const ICC_TABLE_DATA: Record<"hombre" | "mujer", ICCRow[]> = {
  hombre: [
    { min: 0, max: 0.9, rangeLabel: "< 0.90", label: "Bajo riesgo", color: "verde" },
    { min: 0.9, max: 1, rangeLabel: "0.90 - 0.99", label: "Riesgo moderado", color: "amarillo" },
    { min: 1, max: null, rangeLabel: "≥ 1.00", label: "Alto riesgo", color: "rojo" },
  ],
  mujer: [
    { min: 0, max: 0.8, rangeLabel: "< 0.80", label: "Bajo riesgo", color: "verde" },
    { min: 0.8, max: 0.85, rangeLabel: "0.80 - 0.84", label: "Riesgo moderado", color: "amarillo" },
    { min: 0.85, max: null, rangeLabel: "≥ 0.85", label: "Alto riesgo", color: "rojo" },
  ],
};

const RISK_BADGE_CLASS: Record<ICCRow["color"], string> = {
  verde: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amarillo: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  rojo: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

type ICCTableProps = {
  sexo?: SexoInput | null;
  icc?: number | null;
};

function getHighlightedIndex(
  icc: number | null | undefined,
  sexo: SexoInput,
): number {
  if (icc === null || icc === undefined || !Number.isFinite(icc)) {
    return -1;
  }

  const normalized = sexo.toLowerCase().trim();
  const key =
    normalized === "hombre" || normalized === "masculino" || normalized === "m"
      ? "hombre"
      : "mujer";

  const rows = ICC_TABLE_DATA[key];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.max === null) {
      if (icc >= row.min) return i;
    } else if (icc >= row.min && icc < row.max) {
      return i;
    }
  }

  return -1;
}

export function ICCTable({ sexo, icc }: ICCTableProps) {
  const normalizedSexo = useMemo(() => {
    if (!sexo) return null;
    const normalized = sexo.toLowerCase().trim();
    if (
      normalized === "hombre" ||
      normalized === "masculino" ||
      normalized === "m"
    ) {
      return "hombre";
    }
    if (
      normalized === "mujer" ||
      normalized === "femenino" ||
      normalized === "f"
    ) {
      return "mujer";
    }
    return null;
  }, [sexo]);

  const highlightedIndex = useMemo(() => {
    if (!normalizedSexo) return -1;
    return getHighlightedIndex(icc, normalizedSexo);
  }, [icc, normalizedSexo]);

  if (!normalizedSexo) {
    return (
      <div className="w-full rounded-lg border border-gray-200 bg-bg-soft p-4 dark:border-white/10">
        <p className="text-center text-sm text-text-secondary">
          Selecciona tu sexo para ver la clasificación OMS del ICC.
        </p>
      </div>
    );
  }

  const rows = ICC_TABLE_DATA[normalizedSexo];

  return (
    <div className="w-full">
      <div className="mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary sm:text-lg md:text-xl dark:text-white">
            Clasificación OMS - Índice Cintura-Cadera
          </h3>
          <InfoTooltip text="Relación entre cintura y cadera" />
        </div>
        <p className="text-sm text-text-secondary">
          Según tu sexo:{" "}
          <span className="font-medium capitalize text-text-primary dark:text-white">
            {normalizedSexo}
          </span>
        </p>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
        <table className="w-full min-w-[320px] text-sm sm:min-w-0 sm:text-base">
          <thead className="bg-bg-subtle">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-text-secondary sm:px-4 sm:py-3">
                Rango ICC
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-text-secondary sm:px-4 sm:py-3">
                Clasificación
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-center font-medium text-text-secondary sm:px-4 sm:py-3">
                Riesgo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {rows.map((row, index) => {
              const isHighlighted = index === highlightedIndex;

              return (
                <tr
                  key={index}
                  className={
                    isHighlighted
                      ? "bg-bg-subtle"
                      : "bg-bg-main transition-colors hover:bg-bg-subtle dark:bg-transparent"
                  }
                >
                  <td className="px-3 py-2 font-mono text-xs text-text-primary sm:px-4 sm:py-3 sm:text-sm dark:text-white">
                    {row.rangeLabel}
                  </td>
                  <td className="px-3 py-2 text-xs text-text-secondary sm:px-4 sm:py-3 sm:text-sm">
                    <span className="block sm:inline">{row.label}</span>
                    {isHighlighted && icc !== null && icc !== undefined && (
                      <span className="ml-1 text-xs text-text-tertiary sm:ml-2">
                        (tu valor: {icc.toFixed(2)})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center sm:px-4 sm:py-3">
                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-1 text-xs font-medium",
                        isHighlighted
                          ? RISK_BADGE_CLASS[row.color]
                          : "border-gray-200 bg-bg-soft text-text-tertiary dark:border-white/10",
                      ].join(" ")}
                    >
                      {isHighlighted ? "Actual" : "Referencia"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {icc !== null && icc !== undefined && highlightedIndex >= 0 && (
        <p className="mt-2 text-center text-xs text-text-tertiary">
          La fila resaltada corresponde a tu ICC actual ({icc.toFixed(2)}).
        </p>
      )}
    </div>
  );
}

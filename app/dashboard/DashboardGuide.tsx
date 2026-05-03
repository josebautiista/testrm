"use client";

import { useEffect } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { startDashboardTour, hasSeenTour } from "@/lib/onboarding";

type DashboardGuideProps = {
  cc: string;
  hasSessions: boolean;
};

export function DashboardGuide({ cc, hasSessions }: DashboardGuideProps) {
  useEffect(() => {
    const key = "dashboard-tour-seen";
    if (!hasSeenTour(key)) {
      // fire-and-forget
      startDashboardTour(hasSessions).catch(() => {});
    }
  }, [hasSessions]);

  return (
    <div className="rounded-3xl border border-gray-200 bg-white/95 p-5 shadow-sm dark:border-white/10 dark:bg-bg-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-text-secondary dark:text-text-secondary">
            Siguiente paso
          </p>
          <p className="mt-2 text-lg font-semibold text-text-primary dark:text-white">
            Registra tu próxima sesión.
          </p>
          <p className="mt-1 text-sm leading-6 text-text-secondary dark:text-text-secondary">
            Lleva tu repetición máxima (1RM) al siguiente nivel con resultados
            prácticos.
          </p>
        </div>
        <PrimaryButton
          href={`/nueva-sesion?cc=${encodeURIComponent(cc)}`}
          className="dashboard-new-session-btn max-w-[220px]"
        >
          + Nueva sesión
        </PrimaryButton>
      </div>
    </div>
  );
}

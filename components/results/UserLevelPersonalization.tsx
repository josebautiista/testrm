"use client";

import { useCallback, useState } from "react";

import InfoTooltip from "@/components/ui/InfoTooltip";
import { UserLevelBadge } from "@/components/ui/UserLevelBadge";
import { UserLevelSelector } from "@/components/ui/UserLevelSelector";
import {
  getUserLevelLabel,
  resolveUserLevel,
  type UserLevel,
} from "@/lib/user-level";

type UserLevelPersonalizationProps = {
  autoLevel: UserLevel;
  initialOverride: UserLevel | null;
  cc: string;
};

const levelMessages: Record<UserLevel, string> = {
  beginner:
    "Empieza con pesos moderados y enfócate en aprender la técnica correcta",
  intermediate:
    "Puedes aumentar progresivamente el peso y trabajar en mejorar tu rendimiento",
  advanced:
    "Puedes entrenar con cargas altas y ajustar tu volumen para maximizar resultados",
};

export function UserLevelPersonalization({
  autoLevel,
  initialOverride,
  cc,
}: UserLevelPersonalizationProps) {
  const [level, setLevel] = useState<UserLevel>(() =>
    resolveUserLevel(autoLevel, initialOverride),
  );
  const handleResolvedLevelChange = useCallback((nextLevel: UserLevel) => {
    setLevel(nextLevel);
  }, []);

  return (
    <section className="space-y-4 rounded-2xl border-2 border-accent/30 bg-bg-soft p-5 dark:border-accent/20">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center text-base font-semibold uppercase tracking-wide text-text-primary dark:text-white">
            Personalización y Nivel del Usuario
            <InfoTooltip text="Este nivel se calcula según tu fuerza en relación con tu peso corporal" />
          </h2>
          <UserLevelBadge level={level} />
        </div>
        <p className="text-sm text-text-secondary">
          Nivel actual:{" "}
          <span className="font-semibold text-text-primary dark:text-white">
            {getUserLevelLabel(level)}
          </span>
        </p>
        <p className="text-sm text-text-secondary">{levelMessages[level]}</p>
        <p className="text-sm font-medium text-accent">
          Sugerencia: inicia en Principiante y ve practicando con los pesos
          sugeridos por la app hasta llegar a Avanzado.
        </p>
      </header>

      <UserLevelSelector
        autoLevel={autoLevel}
        initialOverride={initialOverride}
        cc={cc}
        onResolvedLevelChange={handleResolvedLevelChange}
      />
    </section>
  );
}

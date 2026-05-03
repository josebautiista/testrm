"use client";

import { useCallback, useState } from "react";

import InfoTooltip from "@/components/ui/InfoTooltip";
import { UserLevelBadge } from "@/components/ui/UserLevelBadge";
import { UserLevelSelector } from "@/components/ui/UserLevelSelector";
import { getUserLevelLabel, type UserLevel } from "@/lib/user-level";

type UserLevelPersonalizationProps = {
  autoLevel: UserLevel;
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
}: UserLevelPersonalizationProps) {
  const [level, setLevel] = useState<UserLevel>(autoLevel);
  const handleResolvedLevelChange = useCallback((nextLevel: UserLevel) => {
    setLevel(nextLevel);
  }, []);

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-bg-soft p-4 dark:border-white/6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center text-sm uppercase tracking-wide text-text-secondary">
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
      </header>

      <UserLevelSelector
        autoLevel={autoLevel}
        onResolvedLevelChange={handleResolvedLevelChange}
      />
    </section>
  );
}

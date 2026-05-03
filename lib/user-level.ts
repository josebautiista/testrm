export type UserLevel = "beginner" | "intermediate" | "advanced";

const USER_LEVEL_LABELS: Record<UserLevel, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export function isUserLevel(value: unknown): value is UserLevel {
  return (
    value === "beginner" ||
    value === "intermediate" ||
    value === "advanced"
  );
}

export function getUserLevel(rm: number | null | undefined, bodyWeight: number | null | undefined): UserLevel {
  if (
    typeof rm !== "number" ||
    typeof bodyWeight !== "number" ||
    !Number.isFinite(rm) ||
    !Number.isFinite(bodyWeight) ||
    rm <= 0 ||
    bodyWeight <= 0
  ) {
    return "beginner";
  }

  const relativeStrength = rm / bodyWeight;

  if (relativeStrength < 0.8) return "beginner";
  if (relativeStrength <= 1.2) return "intermediate";
  return "advanced";
}

export function getUserLevelLabel(level: UserLevel): string {
  return USER_LEVEL_LABELS[level];
}

export function resolveUserLevel(
  autoLevel: UserLevel,
  overrideLevel?: UserLevel | null,
): UserLevel {
  return overrideLevel ?? autoLevel;
}

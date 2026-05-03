export type TrainingGoal = "strength" | "hypertrophy" | "endurance";
export type TrainingLevel = "beginner" | "intermediate" | "advanced";

export type TrainingPlan = {
  percentageRange: {
    min: number;
    max: number;
  };
  repRange: {
    min: number;
    max: number;
  };
};

const TRAINING_PLANS: Record<
  TrainingGoal,
  Record<TrainingLevel, TrainingPlan>
> = {
  strength: {
    beginner: {
      percentageRange: { min: 0.7, max: 0.8 },
      repRange: { min: 6, max: 8 },
    },
    intermediate: {
      percentageRange: { min: 0.8, max: 0.9 },
      repRange: { min: 3, max: 6 },
    },
    advanced: {
      percentageRange: { min: 0.85, max: 0.95 },
      repRange: { min: 1, max: 5 },
    },
  },
  hypertrophy: {
    beginner: {
      percentageRange: { min: 0.6, max: 0.7 },
      repRange: { min: 10, max: 12 },
    },
    intermediate: {
      percentageRange: { min: 0.65, max: 0.75 },
      repRange: { min: 8, max: 12 },
    },
    advanced: {
      percentageRange: { min: 0.7, max: 0.85 },
      repRange: { min: 6, max: 10 },
    },
  },
  endurance: {
    beginner: {
      percentageRange: { min: 0.5, max: 0.6 },
      repRange: { min: 15, max: 20 },
    },
    intermediate: {
      percentageRange: { min: 0.55, max: 0.65 },
      repRange: { min: 12, max: 18 },
    },
    advanced: {
      percentageRange: { min: 0.6, max: 0.7 },
      repRange: { min: 12, max: 15 },
    },
  },
};

export function roundWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    return 0;
  }

  return Math.round(weight / 2.5) * 2.5;
}

export function calculateTrainingWeight(
  rm: number,
  percentage: number,
): number {
  if (!Number.isFinite(rm) || !Number.isFinite(percentage)) {
    return 0;
  }

  return roundWeight(rm * percentage);
}

export function getTrainingPlan(
  goal: TrainingGoal,
  level: TrainingLevel,
): TrainingPlan {
  return TRAINING_PLANS[goal][level];
}

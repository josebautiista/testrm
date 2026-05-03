import { getUserLevelLabel, type UserLevel } from "@/lib/user-level";

type UserLevelBadgeProps = {
  level: UserLevel;
};

export function UserLevelBadge({ level }: UserLevelBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-2xl border border-gray-200 bg-bg-soft px-3 py-1 text-sm font-medium text-text-primary dark:border-white/10">
      {getUserLevelLabel(level)}
    </span>
  );
}

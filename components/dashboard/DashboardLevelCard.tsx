import Link from "next/link";

import { UserLevelBadge } from "@/components/ui/UserLevelBadge";
import { getUserLevelLabel, resolveUserLevel, type UserLevel } from "@/lib/user-level";

type DashboardLevelCardProps = {
  autoLevel: UserLevel;
  nivelOverride: UserLevel | null;
  latestSesionHref: string | null;
};

export function DashboardLevelCard({
  autoLevel,
  nivelOverride,
  latestSesionHref,
}: DashboardLevelCardProps) {
  const resolvedLevel = resolveUserLevel(autoLevel, nivelOverride);

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-200 bg-bg-soft p-4 dark:border-white/10">
      <div>
        <p className="text-xs uppercase tracking-wide text-text-tertiary">
          Tu nivel actual
        </p>
        <p className="text-base font-semibold text-text-primary dark:text-white">
          {getUserLevelLabel(resolvedLevel)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <UserLevelBadge level={resolvedLevel} />
        {latestSesionHref ? (
          <Link
            href={latestSesionHref}
            className="text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Ajustar nivel
          </Link>
        ) : null}
      </div>
    </section>
  );
}

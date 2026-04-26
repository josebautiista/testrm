import { ReactNode } from "react";

import { Tooltip } from "@/components/ui/Tooltip";

type SectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
  hint?: string;
};

export function Section({ title, children, className, hint }: SectionProps) {
  return (
    <section className={["space-y-3", className].filter(Boolean).join(" ")}>
      <h2 className="flex items-center text-sm uppercase tracking-wide text-text-secondary">
        {title}
        {hint && <Tooltip text={hint} />}
      </h2>
      <div>{children}</div>
    </section>
  );
}

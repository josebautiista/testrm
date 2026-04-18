import { ReactNode } from "react";

type SectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function Section({ title, children, className }: SectionProps) {
  return (
    <section className={["space-y-3", className].filter(Boolean).join(" ")}>
      <h2 className="text-sm uppercase tracking-wide text-text-secondary">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

import { ReactNode } from "react";

type CardProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function Card({ title, subtitle, actions, children }: CardProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-bg-soft p-5 dark:border-white/8">
      {title || subtitle || actions ? (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-lg font-semibold text-text-primary dark:text-white">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

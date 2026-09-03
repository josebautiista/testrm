"use client";

import { useEffect, type ReactNode } from "react";

export function AppDialog({
  open,
  title,
  children,
  onClose,
  actions,
  tone = "default",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  tone?: "default" | "danger";
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label="Cerrar diálogo"
        onClick={onClose}
      />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        className="relative z-10 w-full max-w-md rounded-3xl border border-gray-200 bg-bg-main p-5 shadow-2xl dark:border-white/10 dark:bg-bg-soft"
      >
        <div
          className={[
            "mb-4 h-1 w-12 rounded-full",
            tone === "danger" ? "bg-red-500" : "bg-accent",
          ].join(" ")}
        />
        <h2 id="app-dialog-title" className="text-lg font-semibold text-text-primary dark:text-white">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-6 text-text-secondary">{children}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-bg-main px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-bg-subtle dark:border-white/10 dark:bg-bg-soft dark:text-white"
          >
            Cerrar
          </button>
          {actions}
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { PrimaryButton } from "@/components/ui/PrimaryButton";

type DashboardSession = {
  id: number;
  href: string;
  fecha: string;
  nombre: string;
  resumen: string;
};

type DashboardSessionsSectionProps = {
  sessions: DashboardSession[];
  newSessionHref: string;
  saved?: boolean;
};

const PREVIEW_LIMIT = 5;

export function DashboardSessionsSection({
  sessions,
  newSessionHref,
  saved = false,
}: DashboardSessionsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [showAll, setShowAll] = useState(false);
  const [highlight, setHighlight] = useState(saved);
  const previewSessions = useMemo(
    () => sessions.slice(0, PREVIEW_LIMIT),
    [sessions],
  );
  const visibleSessions = showAll ? sessions : previewSessions;
  const hasMoreSessions = sessions.length > PREVIEW_LIMIT;

  useEffect(() => {
    if (!saved) {
      return;
    }

    sectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    const timeoutId = window.setTimeout(() => setHighlight(false), 1800);

    return () => window.clearTimeout(timeoutId);
  }, [saved]);

  return (
    <section
      ref={sectionRef}
      id="mis-sesiones"
      className={[
        "scroll-mt-6 space-y-4 rounded-3xl border bg-bg-soft p-4 transition-colors sm:p-5",
        highlight
          ? "border-accent"
          : "border-gray-200 dark:border-white/10",
      ].join(" ")}
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
              Mis sesiones
            </h2>
            <p className="text-sm text-text-secondary">
              Aquí puedes ver todos tus entrenamientos registrados
            </p>
          </div>
          <span className="rounded-2xl border border-gray-200 bg-bg-main px-3 py-1 text-sm font-medium text-text-primary dark:border-white/10 dark:bg-bg-soft dark:text-white">
            {sessions.length} sesiones
          </span>
        </div>

        {saved ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200">
            Sesión guardada correctamente
          </p>
        ) : (
          <p className="text-xs text-text-tertiary">
            En esta sección puedes revisar todas tus sesiones guardadas
          </p>
        )}
      </header>

      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-bg-main px-4 py-8 text-center dark:border-white/10 dark:bg-bg-soft">
          <h3 className="text-lg font-semibold text-text-primary dark:text-white">
            Aún no has registrado sesiones
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Crea tu primera sesión para empezar a construir tu historial de
            entrenamientos.
          </p>
          <div className="mt-5">
            <PrimaryButton href={newSessionHref}>
              Crear mi primera sesión
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {visibleSessions.map((session) => (
              <Link
                key={session.id}
                href={session.href}
                className="block rounded-2xl border border-gray-200 bg-bg-main p-4 transition-colors hover:border-accent/60 active:bg-bg-subtle dark:border-white/10 dark:bg-bg-soft"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-text-tertiary">
                      {session.fecha}
                    </p>
                    <h3 className="text-base font-semibold text-text-primary dark:text-white">
                      {session.nombre}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {session.resumen}
                    </p>
                  </div>
                  <span className="mt-1 text-text-tertiary">›</span>
                </div>
              </Link>
            ))}
          </div>

          {hasMoreSessions ? (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-bg-main px-4 py-3 text-base font-medium text-text-primary transition-colors hover:border-accent/60 active:bg-bg-subtle dark:border-white/10 dark:bg-bg-soft dark:text-white"
            >
              {showAll ? "Ver menos sesiones" : "Ver todas las sesiones"}
            </button>
          ) : null}

          {showAll && hasMoreSessions ? (
            <p className="text-xs text-text-tertiary">
              Estás viendo el historial completo de sesiones.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { MetricRow } from "@/components/ui/MetricRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";

type ResultadoView = {
  id: number;
  ejercicio: string;
  repeticiones: number;
  carga: number;
  epley: number;
  brzycki: number;
  lombardi: number;
  lander: number;
  oconnor: number;
  mayhew: number;
  wathen: number;
  baechle: number;
};

type SesionView = {
  id: number;
  createdAt: string;
  resultados: ResultadoView[];
};

type PersonaView = {
  id: number;
  nombre: string;
  cc: string;
  edad: number;
  sesiones: SesionView[];
};

type AdminPanelProps = {
  personas: PersonaView[];
};

const PAGE_SIZE = 8;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function AdminPanel({ personas }: AdminPanelProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(
    null,
  );
  const [expandedSesionId, setExpandedSesionId] = useState<number | null>(null);

  const filteredPersonas = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return personas;
    }

    return personas.filter(
      (persona) =>
        persona.nombre.toLowerCase().includes(term) ||
        persona.cc.toLowerCase().includes(term),
    );
  }, [personas, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPersonas.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);

  const currentPersonas = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPersonas.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredPersonas]);

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId],
  );

  return (
    <main className="space-y-8 pb-10">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Admin
            </h1>
            <p className="text-sm text-text-secondary">Personas registradas</p>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/6 bg-bg-soft px-4 text-sm font-medium tracking-tight text-white transition duration-200 active:bg-bg-subtle"
          >
            Volver al home
          </Link>
        </div>
        <div className="pt-2">
          <PrimaryButton
            href="/api/logout"
            className="border border-red-500/20 bg-red-500/10 text-red-300"
          >
            Cerrar sesion
          </PrimaryButton>
        </div>
      </header>

      <Section title="Buscar persona">
        <input
          type="text"
          inputMode="text"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nombre o CC"
          className="w-full rounded-xl border border-white/6 bg-bg-soft px-4 py-3 text-base text-white outline-none placeholder:text-text-tertiary focus:border-white/15"
        />
      </Section>

      <Section title="Personas registradas">
        <div className="space-y-3">
          {currentPersonas.map((persona) => (
            <button
              key={persona.id}
              type="button"
              onClick={() => {
                setSelectedPersonaId(persona.id);
                setExpandedSesionId(persona.sesiones[0]?.id ?? null);
              }}
              className="w-full rounded-xl border border-white/6 bg-bg-soft px-4 py-3 text-left transition duration-200 active:bg-bg-subtle"
            >
              <p className="text-base text-white">{persona.nombre}</p>
              <MetricRow label="CC" value={persona.cc} compact />
              <MetricRow label="Edad" value={`${persona.edad}`} compact />
              <MetricRow
                label="Sesiones"
                value={`${persona.sesiones.length}`}
                compact
              />
            </button>
          ))}

          {currentPersonas.length === 0 ? (
            <p className="text-sm text-text-secondary">No hay resultados.</p>
          ) : null}
        </div>
      </Section>

      <div className="flex items-center justify-between gap-3">
        <PrimaryButton
          type="button"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage <= 1}
          className="w-auto px-5"
        >
          Anterior
        </PrimaryButton>

        <p className="text-sm text-text-secondary">
          Pagina {currentPage} de {totalPages}
        </p>

        <PrimaryButton
          type="button"
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage >= totalPages}
          className="w-auto px-5"
        >
          Siguiente
        </PrimaryButton>
      </div>

      {selectedPersona ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => {
            setSelectedPersonaId(null);
            setExpandedSesionId(null);
          }}
        >
          <div
            className="modal-scroll max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/6 bg-bg-main p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-white">
                  {selectedPersona.nombre}
                </h2>
                <p className="text-sm text-text-secondary">
                  CC {selectedPersona.cc}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedPersonaId(null);
                  setExpandedSesionId(null);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/6 bg-bg-soft text-lg text-white transition duration-200 active:bg-bg-subtle"
              >
                ✕
              </button>
            </div>

            <Section title="Sesiones">
              <div className="space-y-4">
                {selectedPersona.sesiones.map((sesion) => (
                  <article
                    key={sesion.id}
                    className="space-y-3 rounded-xl border border-white/6 bg-bg-soft px-4 py-3"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSesionId((prev) =>
                          prev === sesion.id ? null : sesion.id,
                        )
                      }
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <MetricRow
                        label="Sesion"
                        value={formatDateTime(sesion.createdAt)}
                        compact
                      />
                      <span className="text-sm text-text-secondary">
                        {expandedSesionId === sesion.id ? "Ocultar" : "Ver"}
                      </span>
                    </button>

                    {expandedSesionId === sesion.id ? (
                      <div className="space-y-3 border-t border-white/6 pt-3">
                        {sesion.resultados.map((resultado) => (
                          <div
                            key={resultado.id}
                            className="space-y-1 rounded-lg border border-white/6 bg-bg-main px-3 py-2"
                          >
                            <p className="text-sm text-white">
                              {resultado.ejercicio}
                            </p>
                            <MetricRow
                              label="Reps"
                              value={`${resultado.repeticiones}`}
                              compact
                            />
                            <MetricRow
                              label="Carga"
                              value={`${formatNumber(resultado.carga)} kg`}
                              compact
                            />
                            <MetricRow
                              label="Epley"
                              value={formatNumber(resultado.epley)}
                              compact
                            />
                            <MetricRow
                              label="Brzycki"
                              value={formatNumber(resultado.brzycki)}
                              compact
                            />
                            <MetricRow
                              label="Lombardi"
                              value={formatNumber(resultado.lombardi)}
                              compact
                            />
                            <MetricRow
                              label="Lander"
                              value={formatNumber(resultado.lander)}
                              compact
                            />
                            <MetricRow
                              label="O'Connor"
                              value={formatNumber(resultado.oconnor)}
                              compact
                            />
                            <MetricRow
                              label="Mayhew"
                              value={formatNumber(resultado.mayhew)}
                              compact
                            />
                            <MetricRow
                              label="Wathen"
                              value={formatNumber(resultado.wathen)}
                              compact
                            />
                            <MetricRow
                              label="Baechle"
                              value={formatNumber(resultado.baechle)}
                              compact
                            />
                          </div>
                        ))}

                        {sesion.resultados.length === 0 ? (
                          <p className="text-sm text-text-secondary">
                            Esta sesion no tiene resultados.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}

                {selectedPersona.sesiones.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    Esta persona no tiene sesiones registradas.
                  </p>
                ) : null}
              </div>
            </Section>
          </div>
        </div>
      ) : null}
    </main>
  );
}

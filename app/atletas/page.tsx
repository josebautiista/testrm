import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { BuscarAtletaForm } from "@/components/atletas/BuscarAtletaForm";
import { getAuthUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluarVigencia } from "@/lib/rm/vigente";

function formatDaysAgo(date: Date | null) {
  if (!date) return "sin evaluaciones";
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

export default async function AtletasPage() {
  const authUser = await getAuthUserFromCookies();
  const personaWhere: Prisma.PersonaWhereInput =
    authUser?.role === "admin" ? {} : { entrenadorId: authUser?.userId ?? "" };

  const [personas, rmVigentes, ajustesPendientes, macrociclosAbiertos, ultimasSesiones] =
    await Promise.all([
      prisma.persona.findMany({
        where: personaWhere,
        select: { id: true, cc: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
      prisma.rmVigente.findMany({
        where: { validoHasta: null },
        select: { personaId: true, validoDesde: true, confianza: true },
      }),
      prisma.ajustePropuesto.groupBy({
        by: ["personaId"],
        where: { estado: "pendiente" },
        _count: { _all: true },
      }),
      prisma.macrociclo.findMany({
        where: { estado: { in: ["borrador", "activo"] } },
        select: { personaId: true, estado: true },
      }),
      prisma.sesion.groupBy({
        by: ["personaId"],
        _max: { createdAt: true },
      }),
    ]);

  const caducadosPorPersona = new Map<number, number>();
  for (const rm of rmVigentes) {
    const { caducado } = evaluarVigencia({ validoDesde: rm.validoDesde, confianza: rm.confianza });
    if (caducado) {
      caducadosPorPersona.set(rm.personaId, (caducadosPorPersona.get(rm.personaId) ?? 0) + 1);
    }
  }
  const ajustesPorPersona = new Map(ajustesPendientes.map((a) => [a.personaId, a._count._all]));
  const macrocicloPorPersona = new Map(macrociclosAbiertos.map((m) => [m.personaId, m.estado]));
  const ultimaSesionPorPersona = new Map(
    ultimasSesiones.map((s) => [s.personaId, s._max.createdAt]),
  );

  return (
    <main className="space-y-6 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Atletas
        </h1>
        <p className="text-sm text-text-secondary">
          {personas.length} atleta{personas.length === 1 ? "" : "s"} registrado
          {personas.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="rounded-2xl border border-gray-200 bg-bg-soft p-4 dark:border-white/10">
        <p className="mb-3 text-sm font-medium text-text-primary dark:text-white">
          Buscar o registrar un atleta
        </p>
        <BuscarAtletaForm />
      </div>

      {personas.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-bg-soft px-4 py-8 text-center text-sm text-text-secondary dark:border-white/10">
          Aún no tienes atletas. Regístralo con el buscador de arriba.
        </div>
      ) : (
        <div className="space-y-3">
          {personas.map((persona) => {
            const caducados = caducadosPorPersona.get(persona.id) ?? 0;
            const ajustes = ajustesPorPersona.get(persona.id) ?? 0;
            const estadoMacrociclo = macrocicloPorPersona.get(persona.id);
            const ultimaSesion = ultimaSesionPorPersona.get(persona.id) ?? null;

            return (
              <Link
                key={persona.id}
                href={`/dashboard?cc=${encodeURIComponent(persona.cc)}`}
                className="block rounded-2xl border border-gray-200 bg-bg-soft p-4 transition hover:border-accent/40 hover:bg-bg-main dark:border-white/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-text-primary dark:text-white">
                      {persona.nombre}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      CC {persona.cc} · Última evaluación: {formatDaysAgo(ultimaSesion)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {estadoMacrociclo ? (
                      <span className="rounded-full bg-bg-subtle px-3 py-1 text-xs font-medium capitalize text-text-secondary">
                        Plan: {estadoMacrociclo}
                      </span>
                    ) : (
                      <span className="rounded-full bg-bg-subtle px-3 py-1 text-xs font-medium text-text-tertiary">
                        Sin plan
                      </span>
                    )}
                    {caducados > 0 ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200">
                        {caducados} RM caducado{caducados === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {ajustes > 0 ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 dark:border-blue-500/20 dark:bg-blue-950/30 dark:text-blue-200">
                        {ajustes} ajuste{ajustes === 1 ? "" : "s"} pendiente{ajustes === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

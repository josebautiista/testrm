import { redirect } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { ICCSection } from "@/components/dashboard/ICCSection";
import { IMCCard } from "@/components/dashboard/IMCCard";
import { DashboardLevelCard } from "@/components/dashboard/DashboardLevelCard";
import { DashboardSessionsSection } from "@/components/dashboard/DashboardSessionsSection";
import { RetestReminderBanner } from "@/components/dashboard/RetestReminderBanner";
import { evaluarVigencia } from "@/lib/rm/vigente";
import { SummaryMetrics } from "@/components/dashboard/SummaryMetrics";
import { DisponibilidadCard } from "@/components/dashboard/DisponibilidadCard";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { MetricRow } from "@/components/ui/MetricRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";
import { DashboardGuide } from "./DashboardGuide";
import { calculateIMC, getIMCClassification } from "@/helpers/calculations";
import { iniciarMacrocicloAction } from "@/actions/macrociclo";
import {
  obtenerMacrocicloAbierto,
  obtenerMacrociclosPorPersona,
} from "@/services/macrociclo.service";
import { getUserLevel, isUserLevel } from "@/lib/user-level";

function formatSessionCardDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDaysAgo(date: Date) {
  const now = Date.now();
  const ms = now - date.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  if (days <= 0) {
    return "hoy";
  }

  if (days === 1) {
    return "hace 1 dia";
  }

  return `hace ${days} dias`;
}

function formatChange(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function getProgressSummary(
  sesiones: Array<{
    resultados: Array<{
      ejercicioId: number;
      epley: number;
      ejercicio: { nombre: string };
    }>;
  }>,
) {
  if (sesiones.length < 2) {
    return [];
  }

  const [latest, previous] = sesiones;
  const previousByExercise = new Map(
    previous.resultados.map((resultado) => [resultado.ejercicioId, resultado]),
  );

  return latest.resultados
    .map((resultado) => {
      const prev = previousByExercise.get(resultado.ejercicioId);
      if (!prev || prev.epley <= 0) {
        return null;
      }

      const delta = ((resultado.epley - prev.epley) / prev.epley) * 100;
      return {
        nombre: resultado.ejercicio.nombre,
        delta,
      };
    })
    .filter((item): item is { nombre: string; delta: number } => item !== null)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawCC = resolvedSearchParams.cc;
  const cc = typeof rawCC === "string" ? rawCC.trim() : "";
  const saved =
    resolvedSearchParams.saved === "1" ||
    resolvedSearchParams.saved === "true" ||
    resolvedSearchParams.saved === "saved";
  const deleted =
    resolvedSearchParams.deleted === "1" ||
    resolvedSearchParams.deleted === "true" ||
    resolvedSearchParams.deleted === "deleted";
  const rawSesionId = resolvedSearchParams.sesionId;
  const savedSesionId =
    typeof rawSesionId === "string" && Number.isInteger(Number(rawSesionId))
      ? Number(rawSesionId)
      : undefined;

  if (!cc) {
    redirect("/atletas");
  }

  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: {
      id: true,
      cc: true,
      nombre: true,
      sexo: true,
      masaCorporal: true,
      talla: true,
      cintura: true,
      cadera: true,
      nivelOverride: true,
      mesesEntrenamiento: true,
      diasDisponibles: true,
      minutosPorSesion: true,
      equipamiento: true,
      limitaciones: true,
    },
  });

  if (!persona) {
    redirect("/atletas");
  }

  const sesiones = await prisma.sesion.findMany({
    where: { personaId: persona.id },
    include: {
      resultados: {
        include: {
          ejercicio: {
            select: {
              nombre: true,
            },
          },
        },
        orderBy: {
          ejercicioId: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const [macrocicloAbierto, macrociclos, ajustesPendientes, rmVigentesActivos] = await Promise.all([
    obtenerMacrocicloAbierto(persona.id),
    obtenerMacrociclosPorPersona(persona.id),
    prisma.ajustePropuesto.count({ where: { personaId: persona.id, estado: "pendiente" } }),
    prisma.rmVigente.findMany({
      where: { personaId: persona.id, validoHasta: null },
      include: { ejercicio: { select: { nombre: true } } },
    }),
  ]);

  // R-15/TASK-052: aviso de reevaluación por ejercicio, no por días desde la
  // última sesión (D-01 también contaminaba este banner).
  const rmsCaducados = rmVigentesActivos
    .map((rm) => ({
      ejercicioNombre: rm.ejercicio.nombre,
      ...evaluarVigencia({ validoDesde: rm.validoDesde, confianza: rm.confianza }),
    }))
    .filter((rm) => rm.caducado);

  const progress = getProgressSummary(sesiones);
  const latestSession = sesiones[0];
  const imc = calculateIMC(persona);
  const imcClassification = getIMCClassification(imc);
  const newSessionHref = `/nueva-sesion?cc=${encodeURIComponent(cc)}`;

  // D-01: ya no se deriva un "RM global" tomando el máximo entre ejercicios
  // distintos (ver docs/PLAN-MAESTRO.md §0.2). Sesion.finalRM solo queda
  // poblado cuando hay un único ejercicio de referencia (Casas/Nacleiro, o
  // una evaluación de un solo ejercicio); en cualquier otro caso no hay un
  // valor global válido y getUserLevel usa su valor por defecto seguro.
  const latestGlobalRM =
    typeof latestSession?.finalRM === "number" && latestSession.finalRM > 0
      ? latestSession.finalRM
      : 0;
  const autoLevel = getUserLevel(latestGlobalRM, latestSession?.peso ?? null);
  const nivelOverride = isUserLevel(persona.nivelOverride)
    ? persona.nivelOverride
    : null;

  const latestSesionHref = latestSession
    ? `/sesion/${latestSession.id}?cc=${encodeURIComponent(cc)}`
    : null;
  const macrocicloResumen = macrocicloAbierto
    ? macrocicloAbierto.objetivoTipo === "competencia"
      ? `Competencia: ${new Intl.DateTimeFormat("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(macrocicloAbierto.fechaCompetencia ?? macrocicloAbierto.fechaFin)}`
      : `Objetivo salud hasta ${new Intl.DateTimeFormat("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(macrocicloAbierto.fechaFin)}`
    : "";
  const sessionItems = sesiones.map((sesion) => {
    const exerciseCount = sesion.resultados.length;
    return {
      id: sesion.id,
      href: `/sesion/${sesion.id}?cc=${encodeURIComponent(cc)}`,
      fecha: formatSessionCardDate(sesion.createdAt),
      nombre: `Sesión del ${formatSessionCardDate(sesion.createdAt)}`,
      resumen:
        exerciseCount === 1
          ? "1 ejercicio registrado"
          : `${exerciseCount} ejercicios registrados`,
    };
  });

  return (
    <main className="space-y-8 pb-20">
      <header className="space-y-4 rounded-3xl border border-gray-200 bg-bg-soft p-4 sm:p-5 dark:border-white/10">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Resumen
        </h1>
        <p className="text-sm text-text-secondary">
          {latestSession
            ? `Última sesión: ${formatDaysAgo(latestSession.createdAt)}`
            : "Última sesión: sin sesiones"}
        </p>
        <SummaryMetrics
          cc={persona.cc}
          masaCorporal={persona.masaCorporal}
          talla={persona.talla}
        />
        <DisponibilidadCard
          cc={persona.cc}
          mesesEntrenamiento={persona.mesesEntrenamiento}
          diasDisponibles={persona.diasDisponibles}
          minutosPorSesion={persona.minutosPorSesion}
          equipamiento={
            Array.isArray(persona.equipamiento)
              ? (persona.equipamiento as string[])
              : []
          }
          limitaciones={persona.limitaciones}
        />
      </header>

      <RetestReminderBanner
        rmsCaducados={rmsCaducados}
        newSessionHref={newSessionHref}
      />

      <DashboardSessionsSection
        sessions={sessionItems}
        newSessionHref={newSessionHref}
        cc={cc}
        saved={saved}
        deleted={deleted}
        savedSesionId={savedSesionId}
      />

      <DashboardLevelCard
        autoLevel={autoLevel}
        nivelOverride={nivelOverride}
        latestSesionHref={latestSesionHref}
      />

      <section className="space-y-4 rounded-3xl border border-gray-200 bg-bg-soft p-4 sm:p-5 dark:border-white/10">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
            Nueva sesión de test de fuerza máxima (RM)
          </h2>
          <p className="text-sm text-text-secondary">
            Determina tu fuerza máxima (RM) en diferentes ejercicios 
            para obtener tus porcentajes de carga.
          </p>
        </div>
        <PrimaryButton href={newSessionHref}>Crear nueva sesión</PrimaryButton>
      </section>

      {ajustesPendientes > 0 ? (
        <Link
          href={`/ajustes?cc=${encodeURIComponent(cc)}`}
          className="block rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 transition hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200 sm:p-5"
        >
          {ajustesPendientes} ajuste{ajustesPendientes === 1 ? "" : "s"} propuesto
          {ajustesPendientes === 1 ? "" : "s"} esperando tu decisión →
        </Link>
      ) : null}

      <section className="space-y-4 rounded-3xl border border-gray-200 bg-bg-soft p-4 sm:p-5 dark:border-white/10">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
            Macrociclo de entrenamiento
          </h2>
          <p className="text-sm text-text-secondary">
            Planifica tu temporada con objetivos, periodos y mesociclos.
          </p>
        </div>

        {macrocicloAbierto ? (
          <div className="space-y-3">
            {macrocicloAbierto.estado === "borrador" ? (
              <>
                <div className="rounded-2xl border border-gray-200 bg-bg-main p-4 dark:border-white/10 dark:bg-bg-soft">
                  <p className="text-sm font-medium text-text-primary dark:text-white">
                    Tienes un macrociclo en borrador
                  </p>
                  <p className="text-sm text-text-secondary">
                    {macrocicloResumen}
                  </p>
                </div>
                <PrimaryButton
                  href={`/macrociclo/${macrocicloAbierto.id}/editar?cc=${encodeURIComponent(cc)}`}
                >
                  Continuar macrociclo
                </PrimaryButton>
              </>
            ) : (
              <Link
                href={`/macrociclo/${macrocicloAbierto.id}?cc=${encodeURIComponent(cc)}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-bg-main p-4 transition hover:bg-bg-subtle dark:border-white/10 dark:bg-bg-soft dark:hover:bg-bg-subtle"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary dark:text-white">
                    Tienes un macrociclo activo
                  </p>
                  <p className="text-sm text-text-secondary">
                    {macrocicloResumen}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="text-lg text-text-tertiary"
                >
                  →
                </span>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              {macrociclos.some((m) => m.estado === "cerrado")
                ? "Tu último macrociclo está cerrado. Puedes iniciar uno nuevo."
                : "Aún no tienes macrociclos registrados."}
            </p>
            <form action={iniciarMacrocicloAction}>
              <input type="hidden" name="cc" value={cc} />
              <FormSubmitButton pendingLabel="Creando macrociclo...">
                Realizar macrociclo
              </FormSubmitButton>
            </form>
          </div>
        )}
      </section>

      <IMCCard imc={imc} classification={imcClassification} />

      <ICCSection cc={cc} sexo={persona.sexo as "hombre" | "mujer" | "masculino" | "femenino"} cintura={persona.cintura} cadera={persona.cadera} />

      <Section title="Progreso inteligente">
        {progress.length === 0 ? (
          <p className="text-base text-text-secondary">
            Registra al menos dos sesiones para comparar avance.
          </p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-white/6">
            {progress.slice(0, 6).map((item) => (
              <MetricRow
                key={item.nombre}
                label={item.nombre}
                value={formatChange(item.delta)}
                tone={item.delta > 0 ? "positive" : "negative"}
              />
            ))}
          </div>
        )}
      </Section>

      <div className="pt-2">
        <DashboardGuide cc={cc} hasSessions={sesiones.length > 0} />
      </div>

      <PrimaryButton
        href="/atletas"
        className="bg-bg-main text-text-secondary dark:bg-bg-main dark:text-text-secondary"
      >
        Cambiar usuario
      </PrimaryButton>

      <FloatingActionButton
        cc={cc}
        macrocicloAbiertoId={macrocicloAbierto?.id}
        macrocicloAbiertoEstado={macrocicloAbierto?.estado}
      />
    </main>
  );
}

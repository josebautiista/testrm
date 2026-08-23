import { redirect } from "next/navigation";
import Link from "next/link";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { ICCSection } from "@/components/dashboard/ICCSection";
import { IMCCard } from "@/components/dashboard/IMCCard";
import { DashboardSessionsSection } from "@/components/dashboard/DashboardSessionsSection";
import { SummaryMetrics } from "@/components/dashboard/SummaryMetrics";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
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

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const adapter = new PrismaMariaDb(databaseUrl);
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

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

  if (!cc) {
    redirect("/");
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
    },
  });

  if (!persona) {
    redirect("/");
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

  const [macrocicloAbierto, macrociclos] = await Promise.all([
    obtenerMacrocicloAbierto(persona.id),
    obtenerMacrociclosPorPersona(persona.id),
  ]);

  const progress = getProgressSummary(sesiones);
  const latestSession = sesiones[0];
  const imc = calculateIMC(persona);
  const imcClassification = getIMCClassification(imc);
  const newSessionHref = `/nueva-sesion?cc=${encodeURIComponent(cc)}`;
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
  const sessionItems = sesiones.map((sesion, index) => {
    const exerciseCount = sesion.resultados.length;
    return {
      id: sesion.id,
      href: `/sesion/${sesion.id}?cc=${encodeURIComponent(cc)}`,
      fecha: formatSessionCardDate(sesion.createdAt),
      nombre:
        index === 0
          ? "Sesión más reciente"
          : `Sesión ${sesiones.length - index}`,
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
      </header>

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
              <PrimaryButton type="submit">Realizar macrociclo</PrimaryButton>
            </form>
          </div>
        )}
      </section>

      <DashboardSessionsSection
        sessions={sessionItems}
        newSessionHref={newSessionHref}
        cc={cc}
        saved={saved}
        deleted={deleted}
      />

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
        href="/"
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

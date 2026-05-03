import InfoTooltip from "@/components/ui/InfoTooltip";
import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { TrainingRecommendations } from "@/components/results/TrainingRecommendations";
import { UserLevelPersonalization } from "@/components/results/UserLevelPersonalization";
import { MetricRow } from "@/components/ui/MetricRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";
import { getUserLevel } from "@/lib/user-level";

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

function formatSessionDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function getEstimatedRM(result: {
  epley: number;
  brzycki: number;
  lombardi: number;
  lander: number;
  oconnor: number;
  mayhew: number;
  wathen: number;
  baechle: number;
}) {
  return Math.max(
    result.epley,
    result.brzycki,
    result.lombardi,
    result.lander,
    result.oconnor,
    result.mayhew,
    result.wathen,
    result.baechle,
  );
}

function getFormulaRows(result: {
  epley: number;
  brzycki: number;
  lombardi: number;
  lander: number;
  oconnor: number;
  mayhew: number;
  wathen: number;
  baechle: number;
}) {
  return [
    { label: "Epley", value: result.epley },
    { label: "Brzycki", value: result.brzycki },
    { label: "Lombardi", value: result.lombardi },
    { label: "Lander", value: result.lander },
    { label: "O'Connor", value: result.oconnor },
    { label: "Mayhew", value: result.mayhew },
    { label: "Wathen", value: result.wathen },
    { label: "Baechle", value: result.baechle },
  ].sort((a, b) => a.value - b.value);
}

function getMethodLabel(method: string) {
  if (method === "casas") return "Protocolo Casas";
  if (method === "nacleiro") return "Test Nacleiro";
  return "Estimación";
}

export default async function SesionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const rawCC = resolvedSearchParams.cc;
  const cc = typeof rawCC === "string" ? rawCC.trim() : "";
  const saved =
    resolvedSearchParams.saved === "1" ||
    resolvedSearchParams.saved === "true" ||
    resolvedSearchParams.saved === "saved";

  const sesionId = Number(id);

  if (!Number.isInteger(sesionId) || sesionId <= 0) {
    redirect("/dashboard");
  }

  const sesion = await prisma.sesion.findUnique({
    where: { id: sesionId },
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
  });

  if (!sesion) {
    redirect("/dashboard");
  }

  const dashboardHref = cc
    ? `/dashboard?cc=${encodeURIComponent(cc)}`
    : "/dashboard";
  const globalRM =
    typeof sesion.finalRM === "number" && sesion.finalRM > 0
      ? sesion.finalRM
      : sesion.resultados.length > 0
        ? Math.max(
            ...sesion.resultados.map((resultado) => getEstimatedRM(resultado)),
          )
        : 0;
  const autoLevel = getUserLevel(globalRM, sesion.peso);

  return (
    <main className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Tu peso máximo estimado (1RM)
        </h1>
        <p className="text-sm text-text-secondary">
          {formatSessionDate(sesion.createdAt)}
          {sesion.peso ? ` · Peso: ${formatNumber(sesion.peso)} kg` : null}
        </p>
        <div className="grid gap-3 rounded-2xl border border-gray-200 bg-bg-soft p-4 sm:grid-cols-3 dark:border-white/10">
          <MetricRow
            label="Método"
            value={getMethodLabel(sesion.rmMethod)}
            compact
          />
          <MetricRow
            label="Experiencia"
            value={`${sesion.trainingMonths} meses`}
            compact
          />
          <MetricRow
            label="RM final"
            value={globalRM > 0 ? `${formatNumber(globalRM)} kg` : "Pendiente"}
            compact
          />
        </div>
      </header>

      {saved ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200">
          ✅ Sesión guardada. A continuación verás el peso máximo que puedes
          levantar una vez (1RM) estimado para cada ejercicio.
        </div>
      ) : null}

      {sesion.resultados.length === 0 ? (
        <p className="text-base text-text-secondary">
          No hay resultados registrados para esta sesión.
        </p>
      ) : (
        <div className="space-y-6">
          <UserLevelPersonalization autoLevel={autoLevel} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {sesion.resultados.map((resultado) => {
              const estimatedRM = getEstimatedRM(resultado);
              const formulaRows = getFormulaRows(resultado);

              return (
                <article
                  key={resultado.id}
                  className="space-y-4 rounded-xl border border-gray-200 bg-bg-soft p-4 dark:border-white/6"
                >
                <header className="space-y-1">
                  <h2 className="text-base font-semibold text-text-primary dark:text-white">
                    {resultado.ejercicio.nombre}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {resultado.repeticiones} repeticiones ·{" "}
                    {formatNumber(resultado.carga)} kg
                    <InfoTooltip text="Peso recomendado según tu cuerpo: calculado a partir de tu masa corporal y el porcentaje sugerido para este ejercicio." />
                  </p>
                </header>

                <Section title="Estimaciones de peso máximo (1RM)" className="space-y-2">
                  <div className="space-y-0.5">
                    {formulaRows.map((formula) => (
                      <MetricRow
                        key={formula.label}
                        label={formula.label}
                        value={`${formatNumber(formula.value)} kg`}
                        compact
                      />
                    ))}
                    {resultado.casas > 0 ? (
                      <MetricRow
                        label="Protocolo Casas"
                        value={`${formatNumber(resultado.casas)} kg`}
                        tone="positive"
                        compact
                      />
                    ) : null}
                    {resultado.nacleiro > 0 ? (
                      <MetricRow
                        label="Test Nacleiro"
                        value={`${formatNumber(resultado.nacleiro)} kg`}
                        tone="positive"
                        compact
                      />
                    ) : null}
                  </div>
                </Section>

                  <TrainingRecommendations rm={estimatedRM} level={autoLevel} />
                </article>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <PrimaryButton href={dashboardHref}>Volver a mi panel</PrimaryButton>
        <PrimaryButton
          href="/"
          className="bg-bg-main text-text-secondary dark:bg-bg-main dark:text-text-secondary"
        >
          Cambiar usuario
        </PrimaryButton>
      </div>
    </main>
  );
}

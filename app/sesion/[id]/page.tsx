import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { MetricRow } from "@/components/ui/MetricRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";

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

  return (
    <main className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Detalle de sesion
        </h1>
        <p className="text-sm text-text-secondary">
          {formatSessionDate(sesion.createdAt)}
        </p>
      </header>

      {sesion.resultados.length === 0 ? (
        <p className="text-base text-text-secondary">
          No hay resultados registrados para esta sesion.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sesion.resultados.map((resultado) => {
            const estimatedRM = getEstimatedRM(resultado);

            return (
              <article
                key={resultado.id}
                className="space-y-4 rounded-xl border border-white/6 bg-bg-soft p-4"
              >
                <header className="space-y-1">
                  <h2 className="text-base text-white">
                    {resultado.ejercicio.nombre}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {resultado.repeticiones} reps ·{" "}
                    {formatNumber(resultado.carga)} kg
                  </p>
                </header>

                <div className="space-y-1 text-center">
                  <p className="text-sm uppercase tracking-wide text-text-secondary">
                    RM estimado
                  </p>
                  <p className="text-3xl font-semibold tracking-tight text-accent">
                    {formatNumber(estimatedRM)} kg
                  </p>
                </div>

                <Section title="Formulas" className="space-y-2">
                  <div className="space-y-0.5">
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
                </Section>
              </article>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        <PrimaryButton href={dashboardHref}>Volver al dashboard</PrimaryButton>
        <PrimaryButton href="/" className="bg-bg-main text-text-secondary">
          Cambiar usuario
        </PrimaryButton>
      </div>
    </main>
  );
}

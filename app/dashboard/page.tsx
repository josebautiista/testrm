import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { ICCSection } from "@/components/dashboard/ICCSection";
import { IMCCard } from "@/components/dashboard/IMCCard";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
import { ListItem } from "@/components/ui/ListItem";
import { MetricRow } from "@/components/ui/MetricRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";
import { calculateIMC, getIMCClassification } from "@/helpers/calculations";

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
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatValue(value: number, unit?: string) {
  const formatted = new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

  return unit ? `${formatted} ${unit}` : formatted;
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

  if (!cc) {
    redirect("/");
  }

  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: {
      id: true,
      cc: true,
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

  const progress = getProgressSummary(sesiones);
  const latestSession = sesiones[0];
  const imc = calculateIMC(persona);
  const imcClassification = getIMCClassification(imc);

  return (
    <main className="space-y-8 pb-20">
      <header className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Hoy
        </h1>
        <p className="text-sm text-text-secondary">
          {latestSession
            ? `Ultima sesion: ${formatDaysAgo(latestSession.createdAt)}`
            : "Ultima sesion: sin registros"}
        </p>
        <div className="grid grid-cols-1 gap-1 rounded-xl border border-gray-200 bg-bg-soft px-4 py-3 sm:grid-cols-3 sm:gap-4 dark:border-white/6">
          <MetricRow label="Identificacion" value={persona.cc} compact />
          <MetricRow
            label="Peso"
            value={formatValue(persona.masaCorporal, "kg")}
            compact
          />
          <MetricRow
            label="Talla"
            value={formatValue(persona.talla, "m")}
            compact
          />
        </div>
      </header>

      <IMCCard imc={imc} classification={imcClassification} />

      <ICCSection cc={cc} cintura={persona.cintura} cadera={persona.cadera} />

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

      <Section title="Sesiones">
        {sesiones.length === 0 ? (
          <p className="text-base text-text-secondary">
            Sin sesiones registradas.
          </p>
        ) : (
          <div>
            {sesiones.map((sesion, index) => (
              <ListItem
                key={sesion.id}
                href={`/sesion/${sesion.id}?cc=${encodeURIComponent(cc)}`}
                withDivider={index < sesiones.length - 1}
              >
                {formatSessionDate(sesion.createdAt)}
              </ListItem>
            ))}
          </div>
        )}
      </Section>

      <div className="pt-2">
        <PrimaryButton href={`/nueva-sesion?cc=${encodeURIComponent(cc)}`}>
          + Nueva sesion
        </PrimaryButton>
      </div>

      <PrimaryButton
        href="/"
        className="bg-bg-main text-text-secondary dark:bg-bg-main dark:text-text-secondary"
      >
        Cambiar usuario
      </PrimaryButton>

      <FloatingActionButton
        href={`/nueva-sesion?cc=${encodeURIComponent(cc)}`}
        label="+"
      />
    </main>
  );
}

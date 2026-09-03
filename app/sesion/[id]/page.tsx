import InfoTooltip from "@/components/ui/InfoTooltip";
import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { TrainingRecommendations } from "@/components/results/TrainingRecommendations";
import { UserLevelPersonalization } from "@/components/results/UserLevelPersonalization";
import { MetricRow } from "@/components/ui/MetricRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";
import { getStrengthLevel } from "@/helpers/calculations";
import { EXERCISE_NOTES } from "@/lib/ejercicios-config";
import {
  calculateRepetitionValue,
  calculateStrengthIndex,
} from "@/lib/rm";
import { calculateEpley } from "@/lib/rm/formulas";
import { resolverFaseActiva } from "@/lib/planificacion/fase";
import { MESES_POR_TIPO_LABEL, type TipoMesociclo } from "@/lib/macrociclo";
import { getUserLevel, isUserLevel } from "@/lib/user-level";

const formatoFechaBloque = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC", // las fronteras de mesociclo son columnas `@db.Date`
});

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
  // "nacleiro" es la grafía de sesiones históricas (ADR-31).
  if (method === "naclerio" || method === "nacleiro") {
    return "Test de Naclerio";
  }
  return "Estimación";
}

function getProtocolSummary(protocolData: unknown) {
  if (!protocolData || typeof protocolData !== "object") {
    return null;
  }

  const data = protocolData as {
    exerciseName?: unknown;
    referenceRM?: unknown;
    estimatedRM?: unknown;
    finalRM?: unknown;
    initialWeight?: unknown;
    kies?: unknown;
  };

  return {
    exerciseName:
      typeof data.exerciseName === "string" ? data.exerciseName : "",
    referenceRM:
      typeof data.referenceRM === "number" ? data.referenceRM : null,
    estimatedRM:
      typeof data.estimatedRM === "number" ? data.estimatedRM : null,
    finalRM: typeof data.finalRM === "number" ? data.finalRM : null,
    initialWeight:
      typeof data.initialWeight === "number" ? data.initialWeight : null,
    kies: typeof data.kies === "number" ? data.kies : null,
  };
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
      persona: {
        select: {
          id: true,
          cc: true,
          sexo: true,
          nivelOverride: true,
        },
      },
      resultados: {
        include: {
          ejercicio: {
            select: {
              nombre: true,
              esDeTiempo: true,
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
  // D-01/TASK-024: ya no se deriva un RM global tomando el máximo entre
  // ejercicios distintos. sesion.finalRM solo queda poblado cuando es
  // inequívoco (un único ejercicio evaluado, o un protocolo Casas/Nacleiro).
  const globalRM =
    typeof sesion.finalRM === "number" && sesion.finalRM > 0
      ? sesion.finalRM
      : 0;
  const autoLevel = getUserLevel(globalRM, sesion.peso);
  const nivelOverride = isUserLevel(sesion.persona.nivelOverride)
    ? sesion.persona.nivelOverride
    : null;
  // ADR-36 · D-14: la fase sale del mesociclo del macrociclo abierto cuyo
  // rango de fechas contiene hoy, no de `Persona.faseEntrenamiento` (que era
  // un valor fijo escrito una sola vez en la primera sesión).
  const macrocicloAbierto = await prisma.macrociclo.findFirst({
    where: {
      personaId: sesion.persona.id,
      estado: { in: ["borrador", "activo"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      estado: true,
      mesociclos: {
        select: {
          id: true,
          tipo: true,
          objetivoBloque: true,
          fechaInicio: true,
          fechaFin: true,
          orden: true,
        },
        orderBy: { orden: "asc" },
      },
    },
  });

  const faseActiva = resolverFaseActiva(macrocicloAbierto?.mesociclos ?? []);
  const faseResumen = faseActiva
    ? {
        fase: faseActiva.fase,
        objetivoBloque: faseActiva.objetivoBloque,
        mesociclo:
          MESES_POR_TIPO_LABEL[faseActiva.tipoMesociclo as TipoMesociclo] ??
          faseActiva.tipoMesociclo,
        posicion: faseActiva.posicion,
        total: faseActiva.total,
        diasRestantes: faseActiva.diasRestantes,
        fechaFin: formatoFechaBloque.format(faseActiva.fechaFin),
        macrocicloId: macrocicloAbierto?.id ?? null,
        esBorrador: macrocicloAbierto?.estado === "borrador",
      }
    : null;
  const tieneMacrocicloAbierto = Boolean(macrocicloAbierto);
  const protocolSummary = getProtocolSummary(sesion.protocolData);
  const strengthIndex = calculateStrengthIndex(
    sesion.resultados.map((resultado) => ({
      ejercicioId: resultado.ejercicioId,
      repeticiones: resultado.repeticiones,
    })),
    sesion.persona.sexo,
  );

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
    
          {sesion.resultados.length > 0 ? (
            <MetricRow
              label="Indice de fuerza"
              value={`${strengthIndex.total}% · ${strengthIndex.label}`}
              tone="positive"
              compact
            />
          ) : null}
        </div>
      </header>

      {saved ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200">
          ✅ Sesión guardada. A continuación verás el peso máximo que puedes
          levantar una vez (1RM) estimado para cada ejercicio.
        </div>
      ) : null}

      {sesion.resultados.length === 0 ? (
        protocolSummary ? (
          <section className="space-y-3 rounded-2xl border border-gray-200 bg-bg-soft p-4 dark:border-white/10">
            <h2 className="text-base font-semibold text-text-primary dark:text-white">
              Resumen del protocolo
            </h2>
            <div className="space-y-0.5">
              <MetricRow
                label="Ejercicio base"
                value={protocolSummary.exerciseName || "Sin nombre"}
                compact
              />
              {protocolSummary.referenceRM !== null ? (
                <MetricRow
                  label="RM de referencia"
                  value={`${formatNumber(protocolSummary.referenceRM)} kg`}
                  compact
                />
              ) : null}
              {protocolSummary.estimatedRM !== null ? (
                <MetricRow
                  label="RM estimado"
                  value={`${formatNumber(protocolSummary.estimatedRM)} kg`}
                  compact
                />
              ) : null}
              {protocolSummary.initialWeight !== null ? (
                <MetricRow
                  label="Peso inicial"
                  value={`${formatNumber(protocolSummary.initialWeight)} kg`}
                  compact
                />
              ) : null}
              {protocolSummary.kies !== null ? (
                <MetricRow
                  label="KIES"
                  value={`${formatNumber(protocolSummary.kies)} kg`}
                  compact
                />
              ) : null}
              <MetricRow
                label="RM final"
                value={
                  protocolSummary.finalRM
                    ? `${formatNumber(protocolSummary.finalRM)} kg`
                    : globalRM > 0
                      ? `${formatNumber(globalRM)} kg`
                      : "Pendiente"
                }
                tone="positive"
                compact
              />
            </div>
          </section>
        ) : (
          <p className="text-base text-text-secondary">
            No hay resultados registrados para esta sesión.
          </p>
        )
      ) : (
        <div className="space-y-6">
          <UserLevelPersonalization
            autoLevel={autoLevel}
            initialOverride={nivelOverride}
            cc={sesion.persona.cc}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {sesion.resultados.map((resultado) => {
              // D-02/TASK-024 · H-13: la estimación principal es siempre la
              // fórmula primaria (Epley). `rm1Estimado` puede
              // faltar en filas históricas previas al backfill (C-03); antes
              // no debe caer al máximo de las fórmulas, que sería un estimador
              // sesgado. Ahora se recalcula Epley desde
              // la carga y las repeticiones ya guardadas — el mismo criterio
              // que usa `prisma/backfill-resultados.ts`.
              const esHistoricoSinEstimacion = resultado.rm1Estimado === null;
              const estimatedRM =
                resultado.rm1Estimado ??
                calculateEpley(resultado.carga, resultado.repeticiones);
              const formulaRows = getFormulaRows(resultado);
              const withoutLoad = resultado.ejercicio.esDeTiempo;
              const repetitionValue = calculateRepetitionValue(
                resultado.repeticiones,
                resultado.ejercicioId,
                sesion.persona.sexo,
              );
              const strengthLevel = withoutLoad
                ? null
                : getStrengthLevel(estimatedRM, sesion.peso ?? 0);
              const pesoLevantado = resultado.carga - resultado.pesoEquipo;

              return (
                <article
                  key={resultado.id}
                  className="space-y-4 rounded-xl border border-gray-200 bg-bg-soft p-4 dark:border-white/6"
                >
                <header className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-text-primary dark:text-white">
                      {resultado.ejercicio.nombre}
                    </h2>
                    {strengthLevel ? (
                      <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs font-semibold text-text-primary dark:text-white">
                        {strengthLevel}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-text-secondary">
                    {withoutLoad ? (
                      `${resultado.repeticiones} repeticiones en 1 minuto`
                    ) : (
                      <>
                        {resultado.repeticiones} repeticiones ·{" "}
                        {formatNumber(resultado.carga)} kg
                        <InfoTooltip text="Peso recomendado según tu cuerpo: calculado a partir de tu masa corporal y el porcentaje sugerido para este ejercicio." />
                      </>
                    )}
                  </p>
                  {!withoutLoad && resultado.pesoEquipo > 0 ? (
                    <p className="text-xs text-text-tertiary">
                      Levantado: {formatNumber(pesoLevantado)} kg + Equipo:{" "}
                      {formatNumber(resultado.pesoEquipo)} kg
                    </p>
                  ) : null}
                  {EXERCISE_NOTES[resultado.ejercicioId] ? (
                    <p className="text-xs text-text-tertiary">
                      {EXERCISE_NOTES[resultado.ejercicioId]}
                    </p>
                  ) : null}
                </header>

                <Section title="Ponderación para índice de fuerza" className="space-y-2">
                  <MetricRow
                    label="Ponderación"
                    value={String(repetitionValue)}
                    compact
                  />
                </Section>

                {!withoutLoad ? (
                  <>
                    <Section title="Resultado principal (1RM)" className="space-y-2">
                      <MetricRow
                        label="1RM estimado"
                        value={`${formatNumber(estimatedRM)} kg`}
                        tone="positive"
                        compact
                      />
                      {esHistoricoSinEstimacion ? (
                        <p className="text-xs leading-5 text-text-tertiary">
                          Sesión histórica: el 1RM se recalculó con la fórmula
                          primaria a partir del peso y las repeticiones guardados.
                        </p>
                      ) : null}
                      {resultado.confianza ? (
                        <MetricRow
                          label="Confianza"
                          value={
                            resultado.confianza === "alta"
                              ? "Alta"
                              : resultado.confianza === "media"
                                ? "Media"
                                : "Baja"
                          }
                          compact
                        />
                      ) : null}
                      {typeof resultado.rirReportado === "number" ? (
                        <p className="text-xs leading-5 text-text-tertiary">
                          Reportaste {resultado.rirReportado}{" "}
                          {resultado.rirReportado === 1
                            ? "repetición"
                            : "repeticiones"}{" "}
                          en reserva, así que el cálculo usó{" "}
                          {resultado.repeticiones + resultado.rirReportado}{" "}
                          repeticiones equivalentes al fallo.
                        </p>
                      ) : null}
                      {resultado.fueraDeRango ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Repeticiones fuera de la ventana válida: esta
                          estimación tiene menor certeza y no reemplazó tu RM
                          de trabajo.
                        </p>
                      ) : null}
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
                          label="Test de Naclerio"
                          value={`${formatNumber(resultado.nacleiro)} kg`}
                          tone="positive"
                          compact
                        />
                      ) : null}
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer text-text-secondary">
                          Ver las 8 fórmulas
                        </summary>
                        <div className="mt-2 space-y-0.5">
                          {formulaRows.map((formula) => (
                            <MetricRow
                              key={formula.label}
                              label={formula.label}
                              value={`${formatNumber(formula.value)} kg`}
                              compact
                            />
                          ))}
                        </div>
                      </details>
                    </Section>

                    <TrainingRecommendations
                      rm={estimatedRM}
                      autoLevel={autoLevel}
                      initialOverride={nivelOverride}
                      faseActiva={faseResumen}
                      tieneMacrocicloAbierto={tieneMacrocicloAbierto}
                    />
                  </>
                ) : null}
                </article>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <PrimaryButton href={dashboardHref}>Volver a mi panel</PrimaryButton>
        <PrimaryButton
          href="/atletas"
          className="bg-bg-main text-text-secondary dark:bg-bg-main dark:text-text-secondary"
        >
          Cambiar usuario
        </PrimaryButton>
      </div>
    </main>
  );
}

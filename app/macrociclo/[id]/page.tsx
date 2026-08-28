import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { MetricRow } from "@/components/ui/MetricRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { prisma } from "@/lib/prisma";
import {
  MESES_POR_ETAPA_LABEL,
  MESES_POR_TIPO_LABEL,
  TIPOS_MICROCICLO,
  TIPOS_PERIODO,
  toISODate,
  type MedidasSnapshot,
  type TipoEtapa,
  type TipoMesociclo,
  type Vo2maxSnapshot,
} from "@/lib/macrociclo";
import { obtenerMacrocicloPorId } from "@/services/macrociclo.service";
import { cerrarMacrocicloAction, eliminarMacrocicloAction } from "@/actions/macrociclo";

const MEDIDA_GRUPOS = [
  { path: "medidasBasicas", label: "Medidas básicas" },
  { path: "pliegues", label: "Pliegues" },
  { path: "perimetros", label: "Perímetros" },
  { path: "diametros", label: "Diámetros" },
  { path: "composicionCorporal", label: "Composición corporal" },
  { path: "adiposidad", label: "Adiposidad" },
  {
    path: "distribucionAdiposoMuscular.masaGrasa",
    label: "Masa grasa — distribución",
  },
  {
    path: "distribucionAdiposoMuscular.tejidoMuscular",
    label: "Tejido muscular — distribución",
  },
  { path: "indicesSalud", label: "Índices de salud" },
];

/** M-02/ADR-41 · Etiquetas del perfil deportivo para el detalle. */
const CAPACIDAD_LABEL: Record<string, string> = {
  fuerza_potencia: "Fuerza y potencia",
  resistencia: "Resistencia",
  mixto_intermitente: "Mixto o intermitente",
  tecnico_estetico: "Técnico o estético",
};

const CALENDARIO_LABEL: Record<string, string> = {
  sin_competencia: "No compite",
  pico_unico: "Una fecha importante",
  doble_pico: "Dos fechas separadas",
  temporada_larga: "Compite seguido durante meses",
};

const NIVEL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

const MEDIDA_LABELS: Record<string, string> = {
  masaCorporalKg: "Masa corporal (kg)",
  tallaCm: "Talla (cm)",
  tallaSentadoCm: "Talla sentado (cm)",
  envergaduraBrazosCm: "Envergadura de brazos (cm)",
  tricepsMm: "Tríceps (mm)",
  subescapularMm: "Subescapular (mm)",
  bicepsMm: "Bíceps (mm)",
  crestaIliacaMm: "Cresta ilíaca (mm)",
  supraespinalMm: "Supraespinal (mm)",
  abdominalMm: "Abdominal (mm)",
  musloMm: "Muslo (mm)",
  piernaMm: "Pierna (mm)",
  brazoRelajadoCm: "Brazo relajado (cm)",
  brazoFlexionadoContraidoCm: "Brazo flexionado (cm)",
  cinturaCm: "Cintura (cm)",
  caderaCm: "Cadera (cm)",
  musloMedioCm: "Muslo medio (cm)",
  humeroCm: "Húmero (cm)",
  biestiloideoCm: "Biestiloideo (cm)",
  femurCm: "Fémur (cm)",
  masaGrasaKg: "Masa grasa (kg)",
  masaLibreGrasaKg: "Masa libre de grasa (kg)",
  tejidoAdiposoKg: "Tejido adiposo (kg)",
  tejidoMuscularKg: "Tejido muscular (kg)",
  tejidoOseoKg: "Tejido óseo (kg)",
  sumatorio6PlieguesMm: "Sumatorio 6 pliegues (mm)",
  sumatorio8PlieguesMm: "Sumatorio 8 pliegues (mm)",
  superiorPct: "Superior (%)",
  centralPct: "Central (%)",
  inferiorPct: "Inferior (%)",
  brazoPct: "Brazo (%)",
  musloPct: "Muslo (%)",
  piernaPct: "Pierna (%)",
  indiceCinturaCadera: "Índice cintura-cadera",
  indiceConicidad: "Índice de conicidad",
  indiceCinturaTalla: "Índice cintura-talla",
  imc: "IMC",
};

function getMedidaEntries(
  medidas: MedidasSnapshot,
  path: string,
): [string, number][] {
  let current: unknown = medidas;
  for (const key of path.split(".")) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return [];
    }
  }
  if (!current || typeof current !== "object") return [];
  return Object.entries(current).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number",
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function getVo2maxInfo(vo2max: Vo2maxSnapshot | null) {
  if (!vo2max) return null;
  const metodoLabel =
    vo2max.metodo === "leger"
      ? "Léger"
      : vo2max.metodo === "cooper"
        ? "Cooper"
        : "Directo";
  const detalles: string[] = [];
  if (vo2max.metodo === "cooper") {
    detalles.push(`Distancia: ${formatNumber(vo2max.distanciaMetros)} m`);
  }
  if (vo2max.metodo === "leger") {
    detalles.push(
      `Etapa ${vo2max.etapa} · ${formatNumber(vo2max.velocidadKmh)} km/h`,
    );
  }
  return {
    metodoLabel,
    valor: `${formatNumber(vo2max.valor)} ml/kg/min`,
    detalles,
  };
}

export default async function MacrocicloDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const id = Number(resolvedParams.id);
  const rawCC = resolvedSearchParams.cc;
  const cc = typeof rawCC === "string" ? rawCC.trim() : "";

  if (!cc || !Number.isInteger(id) || id <= 0) {
    redirect("/atletas");
  }

  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: { id: true, nombre: true, cc: true },
  });

  if (!persona) {
    redirect("/atletas");
  }

  const macrociclo = await obtenerMacrocicloPorId(id);

  if (!macrociclo || macrociclo.personaId !== persona.id) {
    notFound();
  }

  const puedeEditar = macrociclo.estado === "borrador";
  const puedeCerrar = macrociclo.estado === "activo" || macrociclo.estado === "borrador";
  const medidas = (macrociclo.medidasSnapshot as MedidasSnapshot | null) ?? null;
  const vo2max = getVo2maxInfo(
    (macrociclo.vo2maxSnapshot as Vo2maxSnapshot | null) ?? null,
  );

  // P-07/TASK-039: sesiones ya publicadas por el motor (SesionPlanificada),
  // listas para registrar ejecución.
  const sesionesPlanificadas = await prisma.sesionPlanificada.findMany({
    where: { semana: { macrocicloId: id }, estado: { not: "omitida" } },
    include: {
      semana: { select: { numeroSemana: true, fechaInicio: true } },
      _count: { select: { prescripciones: true } },
    },
    orderBy: [{ semana: { numeroSemana: "asc" } }, { orden: "asc" }],
    take: 20,
  });

  return (
    <main className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Macrociclo #{macrociclo.id}
        </h1>
        <p className="text-sm text-text-secondary">
          {persona.nombre} ·{" "}
          <span className="capitalize">{macrociclo.estado}</span>
        </p>
      </header>

      <section className="rounded-3xl border border-gray-200 bg-bg-soft p-4 sm:p-5 dark:border-white/10">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-text-secondary">Objetivo</p>
            <p className="font-medium capitalize text-text-primary dark:text-white">
              {macrociclo.objetivoTipo}
            </p>
            {macrociclo.objetivoDetalle ? (
              <p className="text-sm text-text-secondary">
                {macrociclo.objetivoDetalle}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-sm text-text-secondary">Rango</p>
            <p className="font-medium text-text-primary dark:text-white">
              {toISODate(macrociclo.fechaInicio)} - {toISODate(macrociclo.fechaFin)}
            </p>
          </div>
          {/* M-02/ADR-41: el perfil deportivo es lo que determina toda la
              estructura del plan, así que tiene que verse aquí. */}
          <div>
            <p className="text-sm text-text-secondary">Perfil</p>
            <p className="font-medium text-text-primary dark:text-white">
              {CAPACIDAD_LABEL[macrociclo.capacidadDominante ?? ""] ??
                "Sin definir"}
            </p>
            <p className="text-sm text-text-secondary">
              {CALENDARIO_LABEL[macrociclo.estructuraCalendario ?? ""] ??
                "Calendario sin definir"}
              {macrociclo.nivelAtleta
                ? ` · ${NIVEL_LABEL[macrociclo.nivelAtleta] ?? macrociclo.nivelAtleta}`
                : ""}
            </p>
          </div>

          <div>
            <p className="text-sm text-text-secondary">
              {macrociclo.estructuraCalendario === "sin_competencia"
                ? "Fechas objetivo"
                : "Competencias"}
            </p>
            {macrociclo.competencias.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {macrociclo.competencias.map((competencia) => (
                  <li key={competencia.id} className="text-sm">
                    <span className="font-medium text-text-primary dark:text-white">
                      {toISODate(competencia.fecha)}
                    </span>{" "}
                    <span className="text-text-secondary">
                      {competencia.nombre}
                      {competencia.importancia === "principal"
                        ? " · principal"
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-medium text-text-tertiary">Sin fechas</p>
            )}
          </div>
          <div>
            <p className="text-sm text-text-secondary">Sesión RM</p>
            <p className="font-medium text-text-primary dark:text-white">
              {macrociclo.sesionRmId ? `#${macrociclo.sesionRmId}` : "Sin asignar"}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Total semanas</p>
            <p className="font-medium text-text-primary dark:text-white">
              {macrociclo.semanas.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">VO2Max</p>
            {vo2max ? (
              <>
                <p className="font-medium text-text-primary dark:text-white">
                  {vo2max.metodoLabel} · {vo2max.valor}
                </p>
                {vo2max.detalles.map((detalle) => (
                  <p key={detalle} className="text-sm text-text-secondary">
                    {detalle}
                  </p>
                ))}
              </>
            ) : (
              <p className="font-medium text-text-primary dark:text-white">
                Sin registrar
              </p>
            )}
          </div>
        </div>
      </section>

      {medidas ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary dark:text-white">
            Medidas antropométricas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {MEDIDA_GRUPOS.map((grupo) => {
              const entries = getMedidaEntries(medidas, grupo.path);
              if (entries.length === 0) return null;
              return (
                <div
                  key={grupo.path}
                  className="rounded-2xl border border-gray-200 bg-bg-soft p-4 dark:border-white/10"
                >
                  <p className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                    {grupo.label}
                  </p>
                  <div className="mt-1">
                    {entries.map(([key, value]) => (
                      <MetricRow
                        key={key}
                        label={MEDIDA_LABELS[key] ?? key}
                        value={formatNumber(value)}
                        compact
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {macrociclo.sesionRm ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-text-primary dark:text-white">
              Sesión RM #{macrociclo.sesionRm.id}
            </h2>
            <Link
              href={`/sesion/${macrociclo.sesionRm.id}?cc=${encodeURIComponent(cc)}`}
              className="text-sm font-medium text-accent hover:underline"
            >
              Ver sesión completa
            </Link>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/8">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-white/8">
              <thead className="bg-bg-main">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Ejercicio
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Repeticiones
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Carga
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    1RM (Epley)
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    1RM (Brzycki)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-bg-soft dark:divide-white/8">
                {macrociclo.sesionRm.resultados.map((resultado) => (
                  <tr key={resultado.id}>
                    <td className="px-4 py-3 text-text-primary dark:text-white">
                      {resultado.ejercicio.nombre}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {resultado.repeticiones}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatNumber(resultado.carga)} kg
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatNumber(resultado.epley)} kg
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatNumber(resultado.brzycki)} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {macrociclo.periodos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary dark:text-white">
            Periodos y etapas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {macrociclo.periodos.map((periodo) => (
              <div
                key={periodo.id}
                className="space-y-2 rounded-2xl border border-gray-200 bg-bg-soft p-4 dark:border-white/10"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-text-primary dark:text-white">
                    {TIPOS_PERIODO.find((t) => t.value === periodo.tipo)
                      ?.label ?? periodo.tipo}
                  </p>
                  <span className="text-sm text-text-secondary">
                    {formatNumber(periodo.porcentaje)}%
                  </span>
                </div>
                <p className="text-sm text-text-secondary">
                  {toISODate(periodo.fechaInicio)} - {toISODate(periodo.fechaFin)}
                </p>
                {periodo.etapas.length > 0 ? (
                  <ul className="space-y-1 border-t border-gray-200 pt-2 dark:border-white/8">
                    {periodo.etapas.map((etapa) => (
                      <li
                        key={etapa.id}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="text-text-secondary">
                          {MESES_POR_ETAPA_LABEL[etapa.tipo as TipoEtapa] ??
                            etapa.tipo}
                        </span>
                        <span className="text-right text-text-secondary">
                          {formatNumber(etapa.porcentaje)}% ·{" "}
                          {toISODate(etapa.fechaInicio)} -{" "}
                          {toISODate(etapa.fechaFin)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {macrociclo.mesociclos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary dark:text-white">
            Mesociclos
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/8">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-white/8">
              <thead className="bg-bg-main">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Mesociclo
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Fechas
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Porcentaje
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Semanas
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Carga
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-bg-soft dark:divide-white/8">
                {macrociclo.mesociclos.map((mesociclo) => (
                  <tr key={mesociclo.id}>
                    <td className="px-4 py-3 text-text-primary dark:text-white">
                      {MESES_POR_TIPO_LABEL[mesociclo.tipo as TipoMesociclo] ??
                        mesociclo.tipo}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {toISODate(mesociclo.fechaInicio)} -{" "}
                      {toISODate(mesociclo.fechaFin)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatNumber(mesociclo.porcentaje)}%
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {
                        macrociclo.semanas.filter(
                          (semana) => semana.mesocicloId === mesociclo.id,
                        ).length
                      }
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/macrociclo/${id}/mesociclo/${mesociclo.id}/carga?cc=${encodeURIComponent(cc)}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        {mesociclo.carga ? "Editar ✓" : "Dosificar"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {macrociclo.semanas.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary dark:text-white">
            Semanas
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/8">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-white/8">
              <thead className="bg-bg-main">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Semana
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Fechas
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Microciclo
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Frecuencia
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Series
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Repeticiones
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Volumen
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Intensidad
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-bg-soft dark:divide-white/8">
                {macrociclo.semanas.map((semana) => (
                  <tr key={semana.id}>
                    <td className="px-4 py-3 text-text-primary dark:text-white">
                      {semana.numeroSemana}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {toISODate(semana.fechaInicio)} - {toISODate(semana.fechaFin)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {TIPOS_MICROCICLO.find(
                        (t) => t.value === semana.tipoMicrociclo,
                      )?.label ?? semana.tipoMicrociclo}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {semana.frecuencia}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {semana.series}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {semana.repeticiones}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatNumber(semana.volumen)} kg
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatNumber(semana.intensidad)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {macrociclo.semanas.some((s) => s.ejercicios.length > 0) ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary dark:text-white">
            Volumen por ejercicio
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/8">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-white/8">
              <thead className="bg-bg-main">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Semana
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Ejercicio
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Fórmula RM
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">
                    RM
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">
                    Peso
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">
                    Volumen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-bg-soft dark:divide-white/8">
                {macrociclo.semanas.flatMap((semana) =>
                  semana.ejercicios.length > 0
                    ? semana.ejercicios.map((ejercicio, idx) => (
                        <tr key={`${semana.id}-${ejercicio.ejercicioId}`}>
                          <td className="px-4 py-3 text-text-primary dark:text-white">
                            {idx === 0 ? semana.numeroSemana : ""}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {ejercicio.ejercicio.nombre}
                          </td>
                          <td className="px-4 py-3 text-text-secondary capitalize">
                            {ejercicio.formulaRm}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {formatNumber(ejercicio.rm)} kg
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {formatNumber(ejercicio.peso)} kg
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-text-primary dark:text-white">
                            {formatNumber(ejercicio.volumen)} kg
                          </td>
                        </tr>
                      ))
                    : [],
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {sesionesPlanificadas.length > 0 ? (
        <section className="space-y-3 rounded-3xl border border-gray-200 bg-bg-soft p-4 sm:p-5 dark:border-white/10">
          <h2 className="text-lg font-semibold text-text-primary dark:text-white">
            Sesiones planificadas
          </h2>
          <div className="divide-y divide-gray-200 dark:divide-white/10">
            {sesionesPlanificadas.map((sp) => (
              <div
                key={sp.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary dark:text-white">
                    Semana {sp.semana.numeroSemana} · Sesión {sp.orden}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {sp._count.prescripciones} ejercicio(s) ·{" "}
                    <span className="capitalize">{sp.estado}</span>
                  </p>
                </div>
                <PrimaryButton
                  href={`/entrenamiento/${sp.id}?cc=${encodeURIComponent(cc)}`}
                  className="w-auto px-4 py-2 text-sm"
                >
                  {sp.estado === "realizada" ? "Ver registro" : "Registrar"}
                </PrimaryButton>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
        {puedeEditar ? (
          <PrimaryButton
            href={`/macrociclo/${id}/generar?cc=${encodeURIComponent(cc)}`}
            className="sm:w-auto"
          >
            Generar plan automáticamente
          </PrimaryButton>
        ) : null}

        {puedeEditar ? (
          <PrimaryButton
            href={`/macrociclo/${id}/editar?cc=${encodeURIComponent(cc)}`}
            className="bg-bg-main text-text-secondary sm:w-auto dark:bg-bg-main dark:text-text-secondary"
          >
            Editar manualmente
          </PrimaryButton>
        ) : null}

        {puedeCerrar ? (
          <form action={cerrarMacrocicloAction} className="sm:w-auto">
            <input type="hidden" name="cc" value={cc} />
            <input type="hidden" name="id" value={id} />
            <FormSubmitButton
              pendingLabel="Cerrando..."
              className="bg-bg-main text-text-secondary sm:w-auto dark:bg-bg-main dark:text-text-secondary"
            >
              Cerrar macrociclo
            </FormSubmitButton>
          </form>
        ) : null}

        <form action={eliminarMacrocicloAction} className="sm:w-auto">
          <input type="hidden" name="cc" value={cc} />
          <input type="hidden" name="id" value={id} />
          <FormSubmitButton
            pendingLabel="Eliminando..."
            className="border-red-200 bg-red-50 text-red-700 sm:w-auto dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200"
          >
            Eliminar macrociclo
          </FormSubmitButton>
        </form>

        <PrimaryButton
          href={`/dashboard?cc=${encodeURIComponent(cc)}`}
          className="bg-bg-main text-text-secondary sm:w-auto dark:bg-bg-main dark:text-text-secondary"
        >
          Volver al dashboard
        </PrimaryButton>
      </div>
    </main>
  );
}

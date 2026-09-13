import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { RegistroSesion } from "@/components/entrenamiento/RegistroSesion";
import {
  OBJETIVO_BLOQUE_LABEL,
  PROGRESION_LABEL,
  RANGOS_VOLUMEN,
  ZONAS_INTENSIDAD,
} from "@/lib/config/parametros";
import { resolverObjetivoBloque } from "@/lib/planificacion/fase";
import { esObjetivoBloque, esProgresionBloque } from "@/lib/planificacion/objetivo-bloque";

export default async function EntrenamientoPage({
  params,
  searchParams,
}: {
  params: Promise<{ sesionPlanificadaId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const sesionPlanificadaId = Number(resolvedParams.sesionPlanificadaId);
  const rawCC = resolvedSearchParams.cc;
  const cc = typeof rawCC === "string" ? rawCC.trim() : "";

  if (!cc || !Number.isInteger(sesionPlanificadaId) || sesionPlanificadaId <= 0) {
    redirect("/atletas");
  }

  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: { id: true, nombre: true },
  });

  if (!persona) {
    redirect("/atletas");
  }

  const sesionPlanificada = await prisma.sesionPlanificada.findUnique({
    where: { id: sesionPlanificadaId },
    select: {
      id: true,
      orden: true,
      wod: true,
      semana: {
        select: {
          numeroSemana: true,
          tipoMicrociclo: true,
          esDeload: true,
          factorVolumen: true,
          factorIntensidad: true,
          macrociclo: { select: { id: true, personaId: true } },
          mesociclo: {
            select: {
              tipo: true,
              objetivoBloque: true,
              intensidadMinPct: true,
              intensidadMaxPct: true,
              repsMin: true,
              repsMax: true,
              rirObjetivo: true,
              progresion: true,
              seriesSemanalesPorPatron: true,
            },
          },
        },
      },
    },
  });

  if (!sesionPlanificada || sesionPlanificada.semana.macrociclo.personaId !== persona.id) {
    notFound();
  }

  // Catálogo (los mismos ejercicios del test de RM) para el campo opcional
  // de "posible marca nueva" — solo tiene sentido para ejercicios con
  // RmVigente, así que se limita a este catálogo y no a texto libre.
  const catalogo = await prisma.ejercicio.findMany({
    where: { activo: true, admitePorcentajeRm: true, esDeTiempo: false },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  // Contexto para que el entrenador decida el WOD: la zona de %1RM/reps/RIR
  // ya vive en el mesociclo (editable en el paso "Carga" del wizard); aquí
  // solo se resuelve con el mismo criterio que el resto de la app cuando el
  // macrociclo es anterior a esa columna (ADR-47).
  const mesociclo = sesionPlanificada.semana.mesociclo;
  const objetivoBloqueResuelto =
    resolverObjetivoBloque({
      tipo: mesociclo.tipo,
      objetivoBloque: esObjetivoBloque(mesociclo.objetivoBloque) ? mesociclo.objetivoBloque : null,
    }) ?? "hipertrofia";
  const zonaPorDefecto = ZONAS_INTENSIDAD[objetivoBloqueResuelto];
  const rangoPorDefecto = RANGOS_VOLUMEN[objetivoBloqueResuelto];

  const contextoSesion = {
    numeroSemana: sesionPlanificada.semana.numeroSemana,
    tipoMicrociclo: sesionPlanificada.semana.tipoMicrociclo,
    esDeload: sesionPlanificada.semana.esDeload,
    factorVolumen: sesionPlanificada.semana.factorVolumen,
    factorIntensidad: sesionPlanificada.semana.factorIntensidad,
    objetivoBloqueLabel: OBJETIVO_BLOQUE_LABEL[objetivoBloqueResuelto],
    intensidadMinPct: mesociclo.intensidadMinPct ?? zonaPorDefecto.intensidadMinPct,
    intensidadMaxPct: mesociclo.intensidadMaxPct ?? zonaPorDefecto.intensidadMaxPct,
    repsMin: mesociclo.repsMin ?? zonaPorDefecto.repsMin,
    repsMax: mesociclo.repsMax ?? zonaPorDefecto.repsMax,
    rirObjetivo: mesociclo.rirObjetivo ?? Math.round((zonaPorDefecto.rirMin + zonaPorDefecto.rirMax) / 2),
    progresionLabel:
      PROGRESION_LABEL[
        esProgresionBloque(mesociclo.progresion) ? mesociclo.progresion : "mantenimiento"
      ],
    seriesMinReferencia: rangoPorDefecto.seriesMin,
    seriesMaxReferencia: rangoPorDefecto.seriesMax,
    seriesSemanalesPorPatron:
      (mesociclo.seriesSemanalesPorPatron as Record<string, number> | null) ?? {},
  };

  return (
    <main className="space-y-6 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Sesión de entrenamiento
        </h1>
        <p className="text-sm text-text-secondary">
          {persona.nombre} · Semana {sesionPlanificada.semana.numeroSemana} · Sesión{" "}
          {sesionPlanificada.orden}
        </p>
      </header>

      <RegistroSesion
        cc={cc}
        sesionPlanificadaId={sesionPlanificada.id}
        wodInicial={sesionPlanificada.wod}
        contexto={contextoSesion}
        catalogo={catalogo}
      />
    </main>
  );
}

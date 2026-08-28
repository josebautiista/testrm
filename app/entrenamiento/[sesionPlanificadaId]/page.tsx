import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { RegistroSesion } from "@/components/entrenamiento/RegistroSesion";

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
    include: {
      semana: {
        select: {
          numeroSemana: true,
          fechaInicio: true,
          macrociclo: { select: { id: true, personaId: true } },
        },
      },
      prescripciones: {
        where: { supersededById: null },
        include: { ejercicio: { select: { id: true, nombre: true, esDeTiempo: true } } },
        orderBy: { orden: "asc" },
      },
    },
  });

  if (!sesionPlanificada || sesionPlanificada.semana.macrociclo.personaId !== persona.id) {
    notFound();
  }

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
        prescripciones={sesionPlanificada.prescripciones.map((p) => ({
          id: p.id,
          orden: p.orden,
          ejercicioId: p.ejercicioId,
          ejercicioNombre: p.ejercicio.nombre,
          esDeTiempo: p.ejercicio.esDeTiempo,
          series: p.series,
          repeticionesObjetivo: p.repeticionesObjetivo,
          cargaKg: p.cargaKg,
          rirObjetivo: p.rirObjetivo,
        }))}
      />
    </main>
  );
}

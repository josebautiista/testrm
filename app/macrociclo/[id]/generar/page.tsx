import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { GeneradorPlan } from "@/components/macrociclo/GeneradorPlan";

export default async function GenerarPlanPage({
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

  const macrociclo = await prisma.macrociclo.findUnique({
    where: { id },
    select: {
      id: true,
      personaId: true,
      estado: true,
      objetivoTipo: true,
      fechaInicio: true,
      fechaFin: true,
      fechaCompetencia: true,
      generadoEn: true,
    },
  });

  if (!macrociclo || macrociclo.personaId !== persona.id) {
    notFound();
  }

  return (
    <main className="space-y-6 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Generador de plan
        </h1>
        <p className="text-sm text-text-secondary">
          {persona.nombre} · Macrociclo #{macrociclo.id} ·{" "}
          {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(macrociclo.fechaInicio)}
          {" – "}
          {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(macrociclo.fechaFin)}
        </p>
        <p className="text-sm text-text-secondary">
          El motor genera estructura, prescripción y carga desde el RM
          vigente de {persona.nombre.split(" ")[0]}. Puedes revisar antes de
          publicar; nada se guarda hasta que lo confirmes.
        </p>
      </header>

      <GeneradorPlan cc={cc} macrocicloId={id} yaGenerado={macrociclo.generadoEn !== null} />
    </main>
  );
}

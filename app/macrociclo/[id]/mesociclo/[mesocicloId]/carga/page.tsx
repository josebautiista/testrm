import { notFound, redirect } from "next/navigation";

import { MesocicloCargaEditor } from "@/components/macrociclo/MesocicloCargaEditor";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { prisma } from "@/lib/prisma";
import { MESES_POR_TIPO_LABEL, type TipoMesociclo } from "@/lib/macrociclo";
import { type CargaMesocicloInputData } from "@/lib/mesociclo-carga";

export default async function CargaMesocicloPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; mesocicloId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const macrocicloId = Number(resolvedParams.id);
  const mesocicloId = Number(resolvedParams.mesocicloId);
  const rawCC = resolvedSearchParams.cc;
  const cc = typeof rawCC === "string" ? rawCC.trim() : "";

  if (!cc || !Number.isInteger(macrocicloId) || macrocicloId <= 0 || !Number.isInteger(mesocicloId) || mesocicloId <= 0) {
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
    where: { id: macrocicloId, personaId: persona.id },
    select: { id: true, estado: true },
  });

  if (!macrociclo) {
    notFound();
  }

  const mesociclo = await prisma.macrocicloMesociclo.findUnique({
    where: { id: mesocicloId, macrocicloId: macrociclo.id },
    include: {
      semanas: { orderBy: { numeroSemana: "asc" } },
      carga: true,
    },
  });

  if (!mesociclo) {
    notFound();
  }

  const cargaInicial = (mesociclo.carga
    ? {
        tiempoSesionMin: mesociclo.carga.tiempoSesionMin,
        direcciones: mesociclo.carga.direcciones,
        volumen: mesociclo.carga.volumen,
        microciclos: mesociclo.carga.microciclos,
        sesiones: mesociclo.carga.sesiones,
      }
    : null) as CargaMesocicloInputData | null;

  const semanas = mesociclo.semanas.map((s) => ({
    numeroSemana: s.numeroSemana,
    frecuencia: s.frecuencia,
  }));

  const label =
    MESES_POR_TIPO_LABEL[mesociclo.tipo as TipoMesociclo] ?? mesociclo.tipo;

  return (
    <main className="space-y-6 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Dosificación de carga
        </h1>
        <p className="text-sm text-text-secondary">
          {label} · Macrociclo #{macrociclo.id}
        </p>
      </header>

      <MesocicloCargaEditor
        cc={cc}
        macrocicloId={macrociclo.id}
        mesocicloId={mesociclo.id}
        semanas={semanas}
        cargaInicial={cargaInicial}
      />

      <PrimaryButton
        href={`/macrociclo/${macrociclo.id}?cc=${encodeURIComponent(cc)}`}
        className="bg-bg-main text-text-secondary dark:bg-bg-main dark:text-text-secondary"
      >
        Volver al macrociclo
      </PrimaryButton>
    </main>
  );
}

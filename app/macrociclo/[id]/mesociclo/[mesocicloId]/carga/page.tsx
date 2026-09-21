import { notFound, redirect } from "next/navigation";

import { ObjetivoBloqueEditor } from "@/components/macrociclo/ObjetivoBloqueEditor";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { getAuthUserFromCookies } from "@/lib/auth";
import { puedeAccederAPersona } from "@/lib/persona-access";
import { prisma } from "@/lib/prisma";
import { MESES_POR_TIPO_LABEL, type TipoMesociclo } from "@/lib/macrociclo";

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

  const authUser = await getAuthUserFromCookies();
  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: { id: true, nombre: true, cc: true, entrenadorId: true },
  });

  if (!persona || !(await puedeAccederAPersona(authUser, persona.id))) {
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
  });

  if (!mesociclo) {
    notFound();
  }

  const label =
    MESES_POR_TIPO_LABEL[mesociclo.tipo as TipoMesociclo] ?? mesociclo.tipo;

  return (
    <main className="space-y-6 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Objetivo de bloque
        </h1>
        <p className="text-sm text-text-secondary">
          {label} · Macrociclo #{macrociclo.id}
        </p>
      </header>

      <ObjetivoBloqueEditor
        cc={cc}
        macrocicloId={macrociclo.id}
        mesocicloId={mesociclo.id}
        tipoMesociclo={mesociclo.tipo as TipoMesociclo}
        valorInicial={{
          objetivoBloque: mesociclo.objetivoBloque,
          intensidadMinPct: mesociclo.intensidadMinPct,
          intensidadMaxPct: mesociclo.intensidadMaxPct,
          repsMin: mesociclo.repsMin,
          repsMax: mesociclo.repsMax,
          rirObjetivo: mesociclo.rirObjetivo,
          progresion: mesociclo.progresion,
          seriesSemanalesPorPatron: mesociclo.seriesSemanalesPorPatron,
        }}
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

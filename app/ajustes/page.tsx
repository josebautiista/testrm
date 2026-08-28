import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { listarAjustesPendientes } from "@/services/progresion.service";
import { AjustesList } from "@/components/progresion/AjustesList";

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawCC = resolvedSearchParams.cc;
  const cc = typeof rawCC === "string" ? rawCC.trim() : "";

  if (!cc) {
    redirect("/atletas");
  }

  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: { id: true, nombre: true },
  });

  if (!persona) {
    redirect("/atletas");
  }

  const ajustes = await listarAjustesPendientes(persona.id);

  return (
    <main className="space-y-6 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Ajustes propuestos
        </h1>
        <p className="text-sm text-text-secondary">
          {persona.nombre} · {ajustes.length} pendiente(s)
        </p>
        <p className="text-sm text-text-secondary">
          El sistema nunca cambia una prescripción publicada por sí solo:
          cada propuesta muestra su evidencia y espera tu decisión (R-13,
          R-10).
        </p>
      </header>

      <AjustesList
        ajustes={ajustes.map((a) => ({
          id: a.id,
          personaId: a.personaId,
          alcance: a.alcance,
          tipo: a.tipo,
          magnitud: a.magnitud,
          justificacion: a.justificacion,
          evidencia: a.evidencia as Record<string, unknown>,
          createdAt: a.createdAt,
        }))}
      />
    </main>
  );
}

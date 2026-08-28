import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { obtenerMacrocicloPorId } from "@/services/macrociclo.service";
import { TOTAL_PASOS_WIZARD } from "@/lib/macrociclo";
import { MacrocicloWizard } from "../MacrocicloWizard";

export default async function EditarMacrocicloPage({
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
  const rawPaso = resolvedSearchParams.paso;
  const cc = typeof rawCC === "string" ? rawCC.trim() : "";
  const pasoQuery = typeof rawPaso === "string" ? Number(rawPaso) : null;

  if (!cc || !Number.isInteger(id) || id <= 0) {
    redirect("/atletas");
  }

  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: {
      id: true,
      nombre: true,
      cc: true,
      masaCorporal: true,
      talla: true,
      cintura: true,
      cadera: true,
    },
  });

  if (!persona) {
    redirect("/atletas");
  }

  const macrociclo = await obtenerMacrocicloPorId(id);

  if (!macrociclo || macrociclo.personaId !== persona.id) {
    notFound();
  }

  if (macrociclo.estado !== "borrador") {
    redirect(`/macrociclo/${id}?cc=${encodeURIComponent(cc)}`);
  }

  const sesionesRm = await prisma.sesion.findMany({
    where: { personaId: persona.id },
    orderBy: { createdAt: "desc" },
    include: {
      resultados: {
        include: {
          ejercicio: { select: { nombre: true } },
        },
      },
    },
  });

  const pasoInicial = pasoQuery && pasoQuery >= 1 && pasoQuery <= TOTAL_PASOS_WIZARD
    ? pasoQuery
    : macrociclo.pasoActual;

  return (
    <main className="pb-10">
      <MacrocicloWizard
        macrociclo={macrociclo}
        persona={persona}
        sesionesRm={sesionesRm}
        pasoInicial={pasoInicial}
      />
    </main>
  );
}

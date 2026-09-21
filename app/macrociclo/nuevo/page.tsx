import { redirect } from "next/navigation";

import { getAuthUserFromCookies } from "@/lib/auth";
import { puedeAccederAPersona } from "@/lib/persona-access";
import { prisma } from "@/lib/prisma";
import { crearORecuperarBorrador } from "@/services/macrociclo.service";

export default async function NuevoMacrocicloPage({
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

  const authUser = await getAuthUserFromCookies();
  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: { id: true, entrenadorId: true },
  });

  if (!persona || !(await puedeAccederAPersona(authUser, persona.id))) {
    redirect("/atletas");
  }

  const { macrociclo } = await crearORecuperarBorrador({
    personaId: persona.id,
    cc,
    context: { userType: "persona" },
  });

  redirect(`/macrociclo/${macrociclo.id}/editar?cc=${encodeURIComponent(cc)}`);
}

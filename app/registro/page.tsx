import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import RegistroForm from "./RegistroForm";

export default async function RegistroPage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireRole(["admin", "entrenador"]);
  const params = await searchParams;
  const cc = typeof params.cc === "string" ? params.cc.trim() : "";
  // Buscar por cédula permite consultar la ficha antes de confirmar el vínculo.
  const persona = cc ? await prisma.persona.findUnique({
    where: { cc },
    select: {
      nombre: true, sexo: true, masaCorporal: true, edad: true, talla: true, updatedAt: true,
      entrenadores: { where: { entrenadorId: user.userId }, select: { entrenadorId: true } },
    },
  }) : null;
  const atleta = persona ? {
    nombre: persona.nombre, sexo: persona.sexo, masaCorporal: persona.masaCorporal,
    edad: persona.edad, talla: persona.talla, version: persona.updatedAt.toISOString(),
    vinculado: persona.entrenadores.length > 0,
  } : null;
  return <RegistroForm key={`${cc}-${atleta?.version ?? "nuevo"}`} cc={cc} atleta={atleta} />;
}

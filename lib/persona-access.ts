import type { AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Acceso compartido: admin o cualquier entrenador vinculado al atleta. */
export async function puedeAccederAPersona(
  authUser: Pick<AuthUser, "role" | "userId"> | null,
  personaId: number,
): Promise<boolean> {
  if (!authUser) return false;
  if (authUser.role === "admin") return true;
  return Boolean(await prisma.personaEntrenador.findUnique({
    where: { personaId_entrenadorId: { personaId, entrenadorId: authUser.userId } },
    select: { personaId: true },
  }));
}

export async function assertAccesoAPersona(
  authUser: Pick<AuthUser, "role" | "userId"> | null,
  personaId: number,
): Promise<void> {
  if (!(await puedeAccederAPersona(authUser, personaId))) {
    throw new Error("Añade este atleta a tu listado para poder trabajar con él.");
  }
}


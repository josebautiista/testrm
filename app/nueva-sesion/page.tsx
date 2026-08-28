import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { NuevaSesionForm } from "./NuevaSesionForm";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const adapter = new PrismaMariaDb(databaseUrl);
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}



export default async function NuevaSesionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawCC = resolvedSearchParams.cc;
  const rawError = resolvedSearchParams.error;
  const rawMacrocicloId = resolvedSearchParams.macrocicloId;
  const rawReturnTo = resolvedSearchParams.returnTo;

  const cc = typeof rawCC === "string" ? rawCC.trim() : "";
  const error = typeof rawError === "string" ? rawError : "";
  const macrocicloId =
    typeof rawMacrocicloId === "string" ? rawMacrocicloId.trim() : "";
  const returnTo =
    typeof rawReturnTo === "string" ? rawReturnTo.trim() : "";
  const requestId = randomUUID();

  if (!cc) {
    redirect("/atletas");
  }

  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: {
      id: true,
      masaCorporal: true,
      sexo: true,
    },
  });

  if (!persona) {
    redirect("/atletas");
  }

  const personaSafe = persona;

  const ejercicios = await prisma.ejercicio.findMany({
    select: {
      id: true,
      nombre: true,
      porcentajeMasaHombre: true,
      porcentajeMasaMujer: true,
      esDeTiempo: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return (
    <main className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Nueva sesion
        </h1>
      </header>

      <NuevaSesionForm
        cc={cc}
        requestId={requestId}
        persona={personaSafe}
        ejercicios={ejercicios}
        error={error}
        macrocicloId={macrocicloId}
        returnTo={returnTo}
      />
    </main>
  );
}

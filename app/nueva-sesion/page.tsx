import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { ordenarParaEvaluacion } from "@/lib/rm/estimacion";
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

const formatoFecha = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

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

  const ejerciciosDB = await prisma.ejercicio.findMany({
    select: {
      id: true,
      nombre: true,
      porcentajeMasaHombre: true,
      porcentajeMasaMujer: true,
      esDeTiempo: true,
      patron: true,
      incrementoMinimoKg: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  // El RM vigente de cada ejercicio precarga la referencia de los protocolos
  // directos (H-06): el atleta ya no tiene que recordarlo de memoria.
  const rmVigentes = await prisma.rmVigente.findMany({
    where: { personaId: personaSafe.id, validoHasta: null },
    select: { ejercicioId: true, valorKg: true, validoDesde: true },
  });
  const rmPorEjercicio = new Map(
    rmVigentes.map((fila) => [fila.ejercicioId, fila]),
  );

  // ADR-34: la batería se evalúa de más a menos masa muscular implicada, y los
  // ejercicios de tiempo van al final.
  const ejercicios = ordenarParaEvaluacion(ejerciciosDB).map((ejercicio) => {
    const vigente = rmPorEjercicio.get(ejercicio.id);

    return {
      ...ejercicio,
      rmVigenteKg: vigente?.valorKg ?? null,
      rmVigenteFecha: vigente ? formatoFecha.format(vigente.validoDesde) : null,
    };
  });

  return (
    <main className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary dark:text-white">
          Nueva sesión de evaluación
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-text-secondary">
          Mide o estima tu repetición máxima. El resultado queda guardado por
          ejercicio y es lo que después determina las cargas de tu
          planificación.
        </p>
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

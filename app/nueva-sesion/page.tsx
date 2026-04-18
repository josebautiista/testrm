import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Section } from "@/components/ui/Section";
import { createSesionAction } from "@/actions/sesion";

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

function formatWeight(value: number) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

export default async function NuevaSesionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawCC = resolvedSearchParams.cc;
  const rawError = resolvedSearchParams.error;

  const cc = typeof rawCC === "string" ? rawCC.trim() : "";
  const error = typeof rawError === "string" ? rawError : "";

  if (!cc) {
    redirect("/");
  }

  const persona = await prisma.persona.findUnique({
    where: { cc },
    select: {
      id: true,
      masaCorporal: true,
    },
  });

  if (!persona) {
    redirect("/");
  }

  const ejercicios = await prisma.ejercicio.findMany({
    select: {
      id: true,
      nombre: true,
      porcentajeMasa: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return (
    <main className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Nueva sesion
        </h1>
      </header>

      {error ? (
        <p className="rounded-xl border border-white/6 bg-bg-soft px-4 py-3 text-sm text-text-secondary">
          {error}
        </p>
      ) : null}

      <form action={createSesionAction} className="space-y-8">
        <input type="hidden" name="cc" value={cc} />

        <Section title="Ejercicios">
          <div className="divide-y divide-white/6">
            {ejercicios.map((ejercicio) => (
              <label
                key={ejercicio.id}
                htmlFor={`repeticiones_${ejercicio.id}`}
                className="flex items-end justify-between gap-4 py-4"
              >
                <div className="space-y-1">
                  <p className="text-base text-white">{ejercicio.nombre}</p>
                  <p className="text-xs uppercase tracking-wide text-text-tertiary">
                    carga base{" "}
                    {formatWeight(
                      persona.masaCorporal * ejercicio.porcentajeMasa,
                    )}{" "}
                    kg
                  </p>
                </div>

                <div className="text-right">
                  <input
                    id={`repeticiones_${ejercicio.id}`}
                    name={`repeticiones_${ejercicio.id}`}
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                    inputMode="numeric"
                    className="w-20 border-0 bg-transparent p-0 text-right text-3xl font-semibold leading-none tracking-tight text-white outline-none"
                  />
                  <p className="mt-1 text-xs uppercase tracking-wide text-text-tertiary">
                    reps
                  </p>
                </div>

                <input type="hidden" name="ejercicioIds" value={ejercicio.id} />
              </label>
            ))}
          </div>
        </Section>

        <PrimaryButton type="submit">Guardar sesion</PrimaryButton>
      </form>
    </main>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import AdminPanel from "./AdminPanel";

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

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("admin_session");

  if (!isAdmin) {
    redirect("/");
  }

  const personas = await prisma.persona.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nombre: true,
      cc: true,
      edad: true,
      sesiones: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          resultados: {
            orderBy: { ejercicioId: "asc" },
            select: {
              id: true,
              repeticiones: true,
              carga: true,
              epley: true,
              brzycki: true,
              lombardi: true,
              lander: true,
              oconnor: true,
              mayhew: true,
              wathen: true,
              baechle: true,
              ejercicio: {
                select: {
                  nombre: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const personaView = personas.map((persona) => ({
    id: persona.id,
    nombre: persona.nombre,
    cc: persona.cc,
    edad: persona.edad,
    sesiones: persona.sesiones.map((sesion) => ({
      id: sesion.id,
      createdAt: sesion.createdAt.toISOString(),
      resultados: sesion.resultados.map((resultado) => ({
        id: resultado.id,
        ejercicio: resultado.ejercicio.nombre,
        repeticiones: resultado.repeticiones,
        carga: resultado.carga,
        epley: resultado.epley,
        brzycki: resultado.brzycki,
        lombardi: resultado.lombardi,
        lander: resultado.lander,
        oconnor: resultado.oconnor,
        mayhew: resultado.mayhew,
        wathen: resultado.wathen,
        baechle: resultado.baechle,
      })),
    })),
  }));

  return <AdminPanel personas={personaView} />;
}

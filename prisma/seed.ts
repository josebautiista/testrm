import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const ejercicios = [
  { id: 1, nombre: "curl de biceps", porcentajeMasa: 0.35 },
  { id: 2, nombre: "press de pierna", porcentajeMasa: 0.65 },
  { id: 3, nombre: "polea alta", porcentajeMasa: 0.7 },
  { id: 4, nombre: "abdominales (1 minuto)", porcentajeMasa: 0.49 },
  { id: 5, nombre: "press pecho", porcentajeMasa: 0.75 },
  { id: 6, nombre: "curl biceps femoral", porcentajeMasa: 0.32 },
] as const;

async function main() {
  for (const ejercicio of ejercicios) {
    await prisma.ejercicio.upsert({
      where: { id: ejercicio.id },
      update: {
        nombre: ejercicio.nombre,
        porcentajeMasa: ejercicio.porcentajeMasa,
      },
      create: {
        id: ejercicio.id,
        nombre: ejercicio.nombre,
        porcentajeMasa: ejercicio.porcentajeMasa,
      },
    });
  }

  console.log(`Seed completed: ${ejercicios.length} ejercicios upserted.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

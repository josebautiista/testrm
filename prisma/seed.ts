import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin1234";

const ejercicios = [
  {
    id: 1,
    nombre: "Curl de biceps",
    porcentajeMasaHombre: 0.35,
    porcentajeMasaMujer: 0.18,
  },
  {
    id: 2,
    nombre: "Press de pierna",
    porcentajeMasaHombre: 0.65,
    porcentajeMasaMujer: 0.5,
  },
  {
    id: 3,
    nombre: "Polea alta",
    porcentajeMasaHombre: 0.7,
    porcentajeMasaMujer: 0.45,
  },
  {
    id: 4,
    nombre: "Abdominales (1 minuto)",
    porcentajeMasaHombre: 0.49,
    porcentajeMasaMujer: 0.49,
  },
  {
    id: 5,
    nombre: "Press pecho",
    porcentajeMasaHombre: 0.75,
    porcentajeMasaMujer: 0.45,
  },
  {
    id: 6,
    nombre: "Curl biceps femoral",
    porcentajeMasaHombre: 0.32,
    porcentajeMasaMujer: 0.25,
  },
] as const;

async function main() {
  for (const ejercicio of ejercicios) {
    await prisma.ejercicio.upsert({
      where: { id: ejercicio.id },
      update: {
        nombre: ejercicio.nombre,
        porcentajeMasaHombre: ejercicio.porcentajeMasaHombre,
        porcentajeMasaMujer: ejercicio.porcentajeMasaMujer,
      },
      create: {
        id: ejercicio.id,
        nombre: ejercicio.nombre,
        porcentajeMasaHombre: ejercicio.porcentajeMasaHombre,
        porcentajeMasaMujer: ejercicio.porcentajeMasaMujer,
      },
    });
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: {
      username: DEFAULT_ADMIN_USERNAME,
    },
    update: {},
    create: {
      username: DEFAULT_ADMIN_USERNAME,
      password: hashedPassword,
    },
  });

  console.log(
    `Seed completed: ${ejercicios.length} ejercicios upserted and default admin ensured.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

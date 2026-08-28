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

// Semántica del catálogo (C-01/TASK-014). patron/musculoPrimario/
// equipamiento siguen el vocabulario de docs/PLAN-MAESTRO.md §3.2.
const ejercicios = [
  {
    id: 1,
    nombre: "Curl de bíceps",
    porcentajeMasaHombre: 0.35,
    porcentajeMasaMujer: 0.18,
    patron: "accesorio",
    musculoPrimario: "biceps",
    musculosSecundarios: ["antebrazo"],
    equipamiento: "barra",
    incrementoMinimoKg: 2.5,
    admitePorcentajeRm: true,
    esDeTiempo: false,
    esUnilateral: false,
    enBateriaEvaluacion: true,
  },
  {
    id: 2,
    nombre: "Prensa de pierna",
    porcentajeMasaHombre: 0.65,
    porcentajeMasaMujer: 0.5,
    patron: "sentadilla",
    musculoPrimario: "cuadriceps",
    musculosSecundarios: ["gluteos", "isquiotibiales"],
    equipamiento: "maquina",
    incrementoMinimoKg: 5,
    admitePorcentajeRm: true,
    esDeTiempo: false,
    esUnilateral: false,
    enBateriaEvaluacion: true,
  },
  {
    id: 3,
    nombre: "Jalón al pecho",
    porcentajeMasaHombre: 0.7,
    porcentajeMasaMujer: 0.45,
    patron: "traccion_vertical",
    musculoPrimario: "dorsales",
    musculosSecundarios: ["biceps"],
    equipamiento: "polea",
    incrementoMinimoKg: 2.5,
    admitePorcentajeRm: true,
    esDeTiempo: false,
    esUnilateral: false,
    enBateriaEvaluacion: true,
  },
  {
    id: 4,
    nombre: "Abdominales (1 minuto)",
    porcentajeMasaHombre: 0.49,
    porcentajeMasaMujer: 0.49,
    patron: "core",
    musculoPrimario: "abdominales",
    musculosSecundarios: [],
    equipamiento: "peso_corporal",
    incrementoMinimoKg: 2.5,
    admitePorcentajeRm: false,
    esDeTiempo: true,
    esUnilateral: false,
    enBateriaEvaluacion: true,
  },
  {
    id: 5,
    nombre: "Press de pecho en máquina",
    porcentajeMasaHombre: 0.75,
    porcentajeMasaMujer: 0.45,
    patron: "empuje_horizontal",
    musculoPrimario: "pectoral",
    musculosSecundarios: ["triceps", "deltoides_anterior"],
    equipamiento: "maquina",
    incrementoMinimoKg: 5,
    admitePorcentajeRm: true,
    esDeTiempo: false,
    esUnilateral: false,
    enBateriaEvaluacion: true,
  },
  {
    id: 6,
    nombre: "Curl femoral",
    porcentajeMasaHombre: 0.32,
    porcentajeMasaMujer: 0.25,
    patron: "accesorio",
    musculoPrimario: "isquiotibiales",
    musculosSecundarios: [],
    equipamiento: "maquina",
    incrementoMinimoKg: 2.5,
    admitePorcentajeRm: true,
    esDeTiempo: false,
    esUnilateral: false,
    enBateriaEvaluacion: true,
  },
] as const;

async function main() {
  for (const ejercicio of ejercicios) {
    const data = {
      nombre: ejercicio.nombre,
      porcentajeMasaHombre: ejercicio.porcentajeMasaHombre,
      porcentajeMasaMujer: ejercicio.porcentajeMasaMujer,
      patron: ejercicio.patron,
      musculoPrimario: ejercicio.musculoPrimario,
      musculosSecundarios: ejercicio.musculosSecundarios,
      equipamiento: ejercicio.equipamiento,
      incrementoMinimoKg: ejercicio.incrementoMinimoKg,
      admitePorcentajeRm: ejercicio.admitePorcentajeRm,
      esDeTiempo: ejercicio.esDeTiempo,
      esUnilateral: ejercicio.esUnilateral,
      enBateriaEvaluacion: ejercicio.enBateriaEvaluacion,
      activo: true,
    };

    await prisma.ejercicio.upsert({
      where: { id: ejercicio.id },
      update: data,
      create: { id: ejercicio.id, ...data },
    });
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: {
      username: DEFAULT_ADMIN_USERNAME,
    },
    update: { role: "admin" },
    create: {
      username: DEFAULT_ADMIN_USERNAME,
      password: hashedPassword,
      role: "admin",
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

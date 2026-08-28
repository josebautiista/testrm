// TASK-034 · Migración de datos: MacrocicloSemanaEjercicio -> SesionPlanificada
// + Prescripcion. Copia hacia adelante, no borra nada de las tablas viejas
// (§19.4: "conservar la tabla origen una release, comparar recuentos").
//
// Mapeo (necesariamente aproximado — el modelo viejo no distinguía sesiones
// dentro de una semana, así que todos los ejercicios de una semana quedan
// en una única SesionPlanificada de orden 1):
//   MacrocicloSemana            -> SesionPlanificada (una por semana)
//   MacrocicloSemanaEjercicio   -> Prescripcion (series/reps se toman de la
//                                  semana entera, porque el modelo viejo no
//                                  los guardaba por ejercicio)
//
// Uso:
//   npx tsx prisma/migrate-prescripciones.ts            (simulación)
//   npx tsx prisma/migrate-prescripciones.ts --apply     (escribe de verdad)
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes("--apply");

async function main() {
  const semanas = await prisma.macrocicloSemana.findMany({
    include: {
      ejercicios: true,
      sesiones: { select: { id: true } },
    },
    orderBy: { id: "asc" },
  });

  const semanasConEjercicios = semanas.filter(
    (s) => s.ejercicios.length > 0 && s.sesiones.length === 0,
  );
  const semanasYaMigradas = semanas.filter((s) => s.sesiones.length > 0);

  console.log(
    `Migración de prescripciones: ${semanasConEjercicios.length} semana(s) con ejercicios por migrar, ` +
      `${semanasYaMigradas.length} ya migrada(s) (se omiten).` +
      (APPLY ? " Aplicando cambios." : " Modo simulación (usa --apply para escribir)."),
  );

  let sesionesCreadas = 0;
  let prescripcionesCreadas = 0;

  for (const semana of semanasConEjercicios) {
    console.log(
      `  Semana #${semana.id} (numeroSemana=${semana.numeroSemana}): ${semana.ejercicios.length} ejercicio(s) -> 1 SesionPlanificada.`,
    );

    if (!APPLY) {
      sesionesCreadas += 1;
      prescripcionesCreadas += semana.ejercicios.length;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const sesion = await tx.sesionPlanificada.create({
        data: {
          semanaId: semana.id,
          orden: 1,
          duracionEstimadaMin: 60,
          estado: "planificada",
        },
      });

      for (const [index, ejercicio] of semana.ejercicios.entries()) {
        await tx.prescripcion.create({
          data: {
            sesionPlanificadaId: sesion.id,
            ejercicioId: ejercicio.ejercicioId,
            orden: index + 1,
            series: semana.series > 0 ? semana.series : 1,
            repeticionesObjetivo: semana.repeticiones > 0 ? semana.repeticiones : 1,
            repsMin: semana.repeticiones > 0 ? semana.repeticiones : 1,
            repsMax: semana.repeticiones > 0 ? semana.repeticiones : 1,
            porcentajeRm: semana.intensidad > 0 ? semana.intensidad : null,
            rirObjetivo: 2,
            cargaKg: ejercicio.peso > 0 ? ejercicio.peso : null,
            rmUsadoKg: ejercicio.rm > 0 ? ejercicio.rm : null,
            formulaRm: ejercicio.formulaRm || null,
            origen: "generado",
            version: 1,
            notas: "Migrado desde MacrocicloSemanaEjercicio (TASK-034); series/reps tomadas de la semana completa.",
          },
        });
        prescripcionesCreadas += 1;
      }
    });

    sesionesCreadas += 1;
  }

  console.log(
    `Listo: ${sesionesCreadas} SesionPlanificada y ${prescripcionesCreadas} Prescripcion ${APPLY ? "creadas" : "a crear"}.`,
  );
}

main()
  .catch((error) => {
    console.error("Migración de prescripciones falló:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// TASK-018 · Backfill de ResultadoEjercicio.{rm1Estimado,
// confianza,formulaPrimaria,fueraDeRango} para filas históricas creadas
// antes de C-03. No reinterpreta valores viejos (§4.2 "Migración: aditiva +
// backfill calculado desde carga/repeticiones"): deriva el estimador desde
// los mismos carga/repeticiones ya guardados.
//
// Uso:
//   npx tsx prisma/backfill-resultados.ts            (simulación, no escribe)
//   npx tsx prisma/backfill-resultados.ts --apply     (escribe de verdad)
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { estimarRm } from "../lib/rm/estimacion";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes("--apply");

async function main() {
  const pendientes = await prisma.resultadoEjercicio.findMany({
    where: { rm1Estimado: null },
    include: {
      sesion: { select: { persona: { select: { sexo: true } } } },
      ejercicio: { select: { esDeTiempo: true } },
    },
  });

  console.log(
    `Backfill de ResultadoEjercicio: ${pendientes.length} fila(s) sin rm1Estimado.` +
      (APPLY ? " Aplicando cambios." : " Modo simulación (usa --apply para escribir)."),
  );

  let actualizadas = 0;
  let fueraDeRango = 0;
  let sinCarga = 0;

  for (const resultado of pendientes) {
    if (resultado.ejercicio.esDeTiempo) {
      sinCarga += 1;
      continue;
    }

    const estimacion = estimarRm(resultado.carga, resultado.repeticiones, {
      sexo: resultado.sesion.persona.sexo,
    });

    if (estimacion.fueraDeRango) {
      fueraDeRango += 1;
    }

    console.log(
      `  #${resultado.id} ejercicio=${resultado.ejercicioId} carga=${resultado.carga} reps=${resultado.repeticiones} ` +
        `-> rm1Estimado=${estimacion.valor} confianza=${estimacion.confianza} fueraDeRango=${estimacion.fueraDeRango}`,
    );

    if (APPLY) {
      await prisma.resultadoEjercicio.update({
        where: { id: resultado.id },
        data: {
          rm1Estimado: estimacion.noUtilizable ? null : estimacion.valor,
          confianza: estimacion.confianza,
          formulaPrimaria: "epley",
          fueraDeRango: estimacion.fueraDeRango,
        },
      });
    }

    actualizadas += 1;
  }

  console.log(
    `Listo: ${actualizadas} actualizada(s), ${fueraDeRango} fuera de rango (D-04), ${sinCarga} sin carga (esDeTiempo).`,
  );
}

main()
  .catch((error) => {
    console.error("Backfill de ResultadoEjercicio falló:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

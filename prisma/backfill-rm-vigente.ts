// TASK-020 · Backfill de RmVigente: una fila abierta por (persona,
// ejercicio) desde el resultado más reciente con rm1Estimado utilizable.
// Requiere haber corrido antes prisma/backfill-resultados.ts --apply.
//
// Riesgo documentado en §19.4 del plan ("el backfill puede elegir el
// resultado equivocado"): por eso corre en modo simulación por defecto.
//
// Uso:
//   npx tsx prisma/backfill-rm-vigente.ts            (simulación, no escribe)
//   npx tsx prisma/backfill-rm-vigente.ts --apply     (escribe de verdad)
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
  const resultados = await prisma.resultadoEjercicio.findMany({
    where: {
      rm1Estimado: { gt: 0 },
      fueraDeRango: false,
    },
    select: {
      id: true,
      ejercicioId: true,
      rm1Estimado: true,
      confianza: true,
      sesion: { select: { personaId: true, createdAt: true } },
    },
    orderBy: { sesion: { createdAt: "asc" } },
  });

  // El más reciente por (personaId, ejercicioId) gana — un Map preservando
  // orden ascendente de inserción hace que la última asignación sea la más
  // reciente.
  const masReciente = new Map<
    string,
    {
      personaId: number;
      ejercicioId: number;
      valorKg: number;
      confianza: string;
      resultadoRmId: number;
      fecha: Date;
    }
  >();

  for (const r of resultados) {
    if (r.rm1Estimado === null) continue;
    const key = `${r.sesion.personaId}:${r.ejercicioId}`;
    masReciente.set(key, {
      personaId: r.sesion.personaId,
      ejercicioId: r.ejercicioId,
      valorKg: r.rm1Estimado,
      confianza: r.confianza ?? "baja",
      resultadoRmId: r.id,
      fecha: r.sesion.createdAt,
    });
  }

  const existentes = await prisma.rmVigente.findMany({
    where: { validoHasta: null },
    select: { personaId: true, ejercicioId: true },
  });
  const yaVigente = new Set(
    existentes.map((e) => `${e.personaId}:${e.ejercicioId}`),
  );

  console.log(
    `Backfill de RmVigente: ${masReciente.size} par(es) persona/ejercicio con resultado utilizable, ` +
      `${yaVigente.size} ya tienen un vigente abierto (se omiten).` +
      (APPLY ? " Aplicando cambios." : " Modo simulación (usa --apply para escribir)."),
  );

  let creados = 0;
  for (const [key, item] of masReciente) {
    if (yaVigente.has(key)) continue;

    console.log(
      `  persona=${item.personaId} ejercicio=${item.ejercicioId} -> valorKg=${item.valorKg} ` +
        `confianza=${item.confianza} desde resultado #${item.resultadoRmId} (${item.fecha.toISOString()})`,
    );

    if (APPLY) {
      await prisma.rmVigente.create({
        data: {
          personaId: item.personaId,
          ejercicioId: item.ejercicioId,
          valorKg: item.valorKg,
          origen: "estimacion",
          confianza: item.confianza,
          resultadoRmId: item.resultadoRmId,
          validoDesde: item.fecha,
        },
      });
    }
    creados += 1;
  }

  console.log(`Listo: ${creados} fila(s) de RmVigente ${APPLY ? "creadas" : "a crear"}.`);
}

main()
  .catch((error) => {
    console.error("Backfill de RmVigente falló:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

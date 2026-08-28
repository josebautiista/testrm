// Cierra el ciclo de autorregulación (R-13, Bloque K): dos sesiones
// consecutivas sin alcanzar repsMin -> AjustePropuesto "bajar_carga" ->
// aceptarlo en /ajustes -> nueva versión de la prescripción, sin reescribir
// la publicada (R-12).
import { expect, test } from "@playwright/test";

import { limpiarPersonaDePrueba, login, prisma } from "./helpers";

test.describe("Autorregulación conectada a la ejecución real (R-13, P-08)", () => {
  let personaId: number;
  let cc: string;
  let prescripcionBId: number;
  let sesionPlanificadaBId: number;

  test.beforeAll(async () => {
    const persona = await prisma.persona.create({
      data: {
        cc: `E2E-AUTORREG-${Date.now()}`,
        nombre: "Atleta Autorregulación E2E",
        sexo: "masculino",
        masaCorporal: 80,
        edad: 28,
        talla: 1.8,
        entrenado: true,
      },
    });
    personaId = persona.id;
    cc = persona.cc;

    const macrociclo = await prisma.macrociclo.create({
      data: {
        personaId,
        objetivoTipo: "salud",
        fechaInicio: new Date("2026-01-05"),
        fechaFin: new Date("2026-03-29"),
        estado: "borrador",
      },
    });

    const mesociclo = await prisma.macrocicloMesociclo.create({
      data: {
        macrocicloId: macrociclo.id,
        tipo: "entrante",
        porcentaje: 100,
        fechaInicio: new Date("2026-01-05"),
        fechaFin: new Date("2026-03-29"),
        orden: 1,
      },
    });

    const crearSemanaConPrescripcion = async (numeroSemana: number, fechaInicio: string) => {
      const fecha = new Date(fechaInicio);
      const fechaFin = new Date(fecha);
      fechaFin.setDate(fechaFin.getDate() + 6);

      const semana = await prisma.macrocicloSemana.create({
        data: {
          macrocicloId: macrociclo.id,
          mesocicloId: mesociclo.id,
          numeroSemana,
          mesCalendario: fecha.getMonth() + 1,
          fechaInicio: fecha,
          fechaFin,
          tipoMicrociclo: "corriente",
          frecuencia: 1,
          volumen: 0,
          intensidad: 0,
        },
      });
      const sesionPlanificada = await prisma.sesionPlanificada.create({
        data: { semanaId: semana.id, orden: 1, duracionEstimadaMin: 60 },
      });
      const prescripcion = await prisma.prescripcion.create({
        data: {
          sesionPlanificadaId: sesionPlanificada.id,
          ejercicioId: 5, // Press de pecho en máquina
          orden: 1,
          series: 3,
          repeticionesObjetivo: 8,
          repsMin: 6,
          repsMax: 10,
          porcentajeRm: 70,
          rirObjetivo: 2,
          cargaKg: 70,
          origen: "generado",
          version: 1,
        },
      });
      return { sesionPlanificada, prescripcion };
    };

    // Sesión A (ya completada, con bajo rendimiento) — fixture directo en BD.
    const a = await crearSemanaConPrescripcion(1, "2026-01-05");
    const sesionRealizadaA = await prisma.sesionRealizada.create({
      data: { personaId, sesionPlanificadaId: a.sesionPlanificada.id, fecha: new Date("2026-01-06"), estado: "completa" },
    });
    await prisma.serieRealizada.create({
      data: {
        sesionRealizadaId: sesionRealizadaA.id,
        prescripcionId: a.prescripcion.id,
        ejercicioId: 5,
        numeroSerie: 1,
        cargaKg: 70,
        repeticiones: 3, // por debajo de repsMin=6
        rir: 0,
      },
    });

    // Sesión B: la registraremos de verdad por la UI.
    const b = await crearSemanaConPrescripcion(2, "2026-01-12");
    sesionPlanificadaBId = b.sesionPlanificada.id;
    prescripcionBId = b.prescripcion.id;
  });

  test.afterAll(async () => {
    await limpiarPersonaDePrueba(personaId);
    await prisma.$disconnect();
  });

  test("una segunda sesión con bajo rendimiento genera un ajuste, y aceptarlo versiona la prescripción", async ({ page }) => {
    await login(page);

    await page.goto(`/entrenamiento/${sesionPlanificadaBId}?cc=${encodeURIComponent(cc)}`);
    await expect(page.getByRole("heading", { name: "Sesión de entrenamiento" })).toBeVisible();

    const bloque = page.locator("article").first();
    // Registrar una serie con reps=3, por debajo de repsMin=6, dos veces
    // (series=3 en el fixture, pero basta con menos para disparar el flujo:
    // dejamos las demás sin registrar y completamos igual).
    await bloque.getByLabel("Reps").fill("3");
    await bloque.getByRole("button", { name: /^Serie 1$/ }).click();
    await expect(bloque.getByText(/Serie 1:/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Completar sesión" }).click();
    await expect(page.getByText(/Sesión completada\./)).toBeVisible({ timeout: 10_000 });

    // Verificar en BD que se creó la propuesta (evita depender de timing de revalidatePath).
    await expect(async () => {
      const ajuste = await prisma.ajustePropuesto.findFirst({
        where: { personaId, tipo: "bajar_carga", estado: "pendiente" },
      });
      expect(ajuste).not.toBeNull();
    }).toPass({ timeout: 10_000 });

    await page.goto(`/ajustes?cc=${encodeURIComponent(cc)}`);
    await expect(page.getByText("Bajar carga")).toBeVisible();
    await expect(page.getByText(/No alcanzó el mínimo de repeticiones/)).toBeVisible();

    await page.getByRole("button", { name: "Aceptar" }).first().click();
    await expect(page.getByText("Aceptado.")).toBeVisible({ timeout: 10_000 });

    const prescripcionOriginal = await prisma.prescripcion.findUniqueOrThrow({
      where: { id: prescripcionBId },
    });
    expect(prescripcionOriginal.cargaKg).toBe(70); // nunca se reescribe
    expect(prescripcionOriginal.supersededById).not.toBeNull();

    const nuevaVersion = await prisma.prescripcion.findUniqueOrThrow({
      where: { id: prescripcionOriginal.supersededById! },
    });
    expect(nuevaVersion.cargaKg).toBeLessThan(70);
    expect(nuevaVersion.origen).toBe("autorregulado");
  });
});

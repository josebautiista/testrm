// §16.3 flujos 2, 3 y 4: planificación -> generar -> publicar -> ver el
// plan; ejecución -> registrar series -> ver e1RM; verificar que
// regenerar no toca lo ya ejecutado.
import { expect, test } from "@playwright/test";

import {
  crearMacrocicloBorrador,
  crearPersonaDePrueba,
  limpiarPersonaDePrueba,
  login,
  prisma,
} from "./helpers";

test.describe("Planificación y ejecución (flujos 2 y 3, §16.3)", () => {
  let personaId: number;
  let cc: string;
  let macrocicloId: number;

  test.beforeAll(async () => {
    const persona = await crearPersonaDePrueba("plan");
    personaId = persona.id;
    cc = persona.cc;
    const macrociclo = await crearMacrocicloBorrador(personaId, 12);
    macrocicloId = macrociclo.id;
  });

  test.afterAll(async () => {
    await limpiarPersonaDePrueba(personaId);
    await prisma.$disconnect();
  });

  test("generar y publicar un plan, luego registrar una sesión completa", async ({ page }) => {
    await login(page);

    await page.goto(`/macrociclo/${macrocicloId}/generar?cc=${encodeURIComponent(cc)}`);
    await expect(page.getByRole("heading", { name: "Generador de plan" })).toBeVisible();

    await page.getByRole("button", { name: "Generar propuesta" }).click();
    await expect(page.getByRole("heading", { name: "Mesociclos" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "El plan no se puede publicar" })).toHaveCount(0);

    await page.getByRole("button", { name: "Publicar plan" }).click();
    await expect(page.getByText("Plan publicado.")).toBeVisible({ timeout: 15_000 });

    // El plan quedó persistido: verificarlo directo en BD (fuente de verdad).
    const semanasGuardadas = await prisma.macrocicloSemana.count({ where: { macrocicloId } });
    expect(semanasGuardadas).toBe(12);
    const prescripcionesConCarga = await prisma.prescripcion.count({
      where: { cargaKg: { not: null }, sesionPlanificada: { semana: { macrocicloId } } },
    });
    expect(prescripcionesConCarga).toBeGreaterThan(0);

    // Ir al detalle del macrociclo y abrir la primera sesión planificada.
    await page.goto(`/macrociclo/${macrocicloId}?cc=${encodeURIComponent(cc)}`);
    await expect(page.getByRole("heading", { name: "Sesiones planificadas" })).toBeVisible();
    await page.getByRole("link", { name: "Registrar" }).first().click();

    await expect(page.getByRole("heading", { name: "Sesión de entrenamiento" })).toBeVisible();

    // Registrar la primera serie del primer ejercicio con los valores
    // prellenados (prescritos) y comprobar que aparece en la lista.
    const primerBloque = page.locator("article").first();
    await expect(primerBloque).toBeVisible();
    await primerBloque.getByRole("button", { name: /^Serie 1$/ }).click();
    await expect(primerBloque.getByText(/Serie 1:/)).toBeVisible({ timeout: 10_000 });

    // Completar la sesión.
    await page.getByRole("button", { name: "Completar sesión" }).click();
    await expect(page.getByText(/Sesión completada\./)).toBeVisible({ timeout: 10_000 });

    const seriesGuardadas = await prisma.serieRealizada.count({
      where: { sesionRealizada: { personaId } },
    });
    expect(seriesGuardadas).toBeGreaterThan(0);
  });

  test("regenerar el plan no modifica las semanas ya publicadas con override (R-12/§6.3)", async ({ page }) => {
    await login(page);

    // Ajustar a mano una prescripción de la semana 1 (simula al entrenador).
    const primeraPrescripcion = await prisma.prescripcion.findFirstOrThrow({
      where: { sesionPlanificada: { semana: { macrocicloId, numeroSemana: 1 } } },
    });
    await prisma.prescripcion.update({
      where: { id: primeraPrescripcion.id },
      data: { cargaKg: 999, origen: "ajustado_entrenador" },
    });

    await page.goto(`/macrociclo/${macrocicloId}/generar?cc=${encodeURIComponent(cc)}`);
    await page.getByRole("button", { name: "Regenerar propuesta" }).click();
    await expect(page.getByRole("heading", { name: "Mesociclos" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Publicar plan" }).click();
    await expect(page.getByText("Plan publicado.")).toBeVisible({ timeout: 15_000 });

    const prescripcionTrasRegenerar = await prisma.prescripcion.findUniqueOrThrow({
      where: { id: primeraPrescripcion.id },
    });
    expect(prescripcionTrasRegenerar.cargaKg).toBe(999);
    expect(prescripcionTrasRegenerar.origen).toBe("ajustado_entrenador");
  });
});

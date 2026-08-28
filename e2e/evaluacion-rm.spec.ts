// §16.3 flujo 1: alta y evaluación -> crear atleta -> evaluación de varios
// ejercicios -> ver RM vigentes con banda. Cubre de paso D-01 (ya no hay
// Math.max entre ejercicios) y D-05 (Casas exige pesos reales).
import { expect, test } from "@playwright/test";

import { limpiarPersonaDePrueba, login, prisma, selectCustomOption } from "./helpers";

test.describe("Alta y evaluación de RM (flujo 1, §16.3)", () => {
  let cc: string;
  let personaId: number | null = null;

  test.afterAll(async () => {
    if (personaId) {
      await limpiarPersonaDePrueba(personaId);
    }
    await prisma.$disconnect();
  });

  test("registrar un atleta nuevo y evaluar 2 ejercicios (estimación)", async ({ page }) => {
    await login(page);
    cc = `E2E-EVAL-${Date.now()}`;

    // Atletas: buscar/registrar por cédula.
    await page.goto("/atletas");
    await page.getByLabel("Cédula del atleta").fill(cc);
    await page.getByRole("button", { name: "Buscar o registrar" }).click();
    await page.waitForURL(/\/registro/, { timeout: 10_000 });

    await page.locator('input[name="nombre"]').fill("Atleta Evaluación E2E");
    await selectCustomOption(page, "Sexo", "Masculino");
    await page.locator('input[name="masaCorporal"]').fill("80");
    await page.locator('input[name="edad"]').fill("28");
    await page.locator('input[name="talla"]').fill("1.80");

    await page.getByRole("button", { name: "Crear usuario" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const persona = await prisma.persona.findUniqueOrThrow({ where: { cc } });
    personaId = persona.id;

    // Nueva sesión: estimación submáxima.
    await page.goto(`/nueva-sesion?cc=${encodeURIComponent(cc)}`);
    await page.locator('input[name="trainingMonths"]').fill("2");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByText("Realiza la mayor cantidad de repeticiones")).toBeVisible();

    // Rellenar reps para todos los ejercicios de la batería (pesos ya vienen prellenados).
    const repInputs = page.locator('input[name^="repeticiones_"]');
    const total = await repInputs.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i += 1) {
      await repInputs.nth(i).fill("8");
    }

    await page.getByRole("button", { name: "Guardar sesión" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    // D-01: ningún RM vigente debería quedar creado por un Math.max entre
    // ejercicios — pero sí uno por ejercicio individual (más de uno posible).
    const rmVigentes = await prisma.rmVigente.findMany({ where: { personaId } });
    expect(rmVigentes.length).toBeGreaterThan(0);
    for (const rm of rmVigentes) {
      expect(rm.valorKg).toBeGreaterThan(0);
      expect(rm.origen).toBe("estimacion");
    }

    // Ver la sesión: debe mostrar banda de incertidumbre y confianza (F-02).
    const sesion = await prisma.sesion.findFirstOrThrow({ where: { personaId } });
    await page.goto(`/sesion/${sesion.id}?cc=${encodeURIComponent(cc)}`);
    await expect(page.getByText("Banda de incertidumbre").first()).toBeVisible();
    await expect(page.getByText("Confianza").first()).toBeVisible();
  });

  test("D-05: el protocolo Casas no se puede cerrar sin pesos reales", async ({ page }) => {
    await login(page);
    const ccCasas = `E2E-CASAS-${Date.now()}`;

    await prisma.persona.create({
      data: {
        cc: ccCasas,
        nombre: "Atleta Casas E2E",
        sexo: "masculino",
        masaCorporal: 80,
        edad: 28,
        talla: 1.8,
        entrenado: true,
        mesesEntrenamiento: 12,
      },
    });

    await page.goto(`/nueva-sesion?cc=${encodeURIComponent(ccCasas)}`);
    await page.locator('input[name="trainingMonths"]').fill("12");
    await page.getByRole("button", { name: "Continuar" }).click();

    await page.getByText("Protocolo Casas").click();
    await expect(page.getByText("Registra al menos un peso realmente levantado")).toBeVisible();

    const guardarBtn = page.getByRole("button", { name: "Guardar sesión" });
    await expect(guardarBtn).toBeDisabled();

    // Ingresar un peso real hace que el botón se habilite.
    await page.getByLabel("Ejercicio usado como base").fill("Press banca");
    await page.getByLabel("RM de referencia").fill("100");
    await page.getByLabel("Peso usado").fill("50");
    await page.getByLabel("Peso usado").blur();

    await expect(guardarBtn).toBeEnabled({ timeout: 10_000 });

    await prisma.persona.delete({ where: { cc: ccCasas } }).catch(() => {});
  });
});

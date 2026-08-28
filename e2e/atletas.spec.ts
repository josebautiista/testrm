// P-01: punto de entrada del entrenador — lista de atletas con alertas.
import { expect, test } from "@playwright/test";

import { limpiarPersonaDePrueba, login, prisma } from "./helpers";

test.describe("Lista de atletas (P-01)", () => {
  let personaId: number;
  let cc: string;

  test.beforeAll(async () => {
    const persona = await prisma.persona.create({
      data: {
        cc: `E2E-ATLETAS-${Date.now()}`,
        nombre: "Atleta Lista E2E",
        sexo: "masculino",
        masaCorporal: 80,
        edad: 28,
        talla: 1.8,
        entrenado: true,
      },
    });
    personaId = persona.id;
    cc = persona.cc;

    // RM caducado a propósito (validoDesde hace 20 semanas > 12).
    const hace20Semanas = new Date();
    hace20Semanas.setDate(hace20Semanas.getDate() - 20 * 7);
    await prisma.rmVigente.create({
      data: {
        personaId,
        ejercicioId: 5,
        valorKg: 80,
        origen: "estimacion",
        confianza: "alta",
        validoDesde: hace20Semanas,
      },
    });
  });

  test.afterAll(async () => {
    await limpiarPersonaDePrueba(personaId);
    await prisma.$disconnect();
  });

  test("muestra al atleta con el aviso de RM caducado", async ({ page }) => {
    await login(page);
    await page.goto("/atletas");

    await expect(page.getByRole("heading", { name: "Atletas" })).toBeVisible();
    const fila = page.getByRole("link", { name: /Atleta Lista E2E/ });
    await expect(fila).toBeVisible();
    await expect(fila.getByText("1 RM caducado")).toBeVisible();
    await expect(fila.getByText("Sin plan")).toBeVisible();

    await fila.click();
    await expect(page).toHaveURL(new RegExp(`cc=${cc}`));
  });
});

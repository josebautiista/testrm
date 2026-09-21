// Roles: admin crea entrenadores; entrenadores no pueden gestionar usuarios
// y pueden vincular atletas existentes para trabajar sobre una ficha compartida.
import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";

import { login, loginAs, prisma, selectCustomOption } from "./helpers";

test.describe("Roles (admin / entrenador)", () => {
  let entrenadorUsername: string | null = null;

  test.afterAll(async () => {
    if (entrenadorUsername) {
      await prisma.user.deleteMany({ where: { username: entrenadorUsername } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test("un admin puede crear un entrenador desde /admin/usuarios", async ({ page }) => {
    await login(page);
    await page.goto("/admin/usuarios");

    entrenadorUsername = `e2e_entrenador_${Date.now()}`;

    await page.getByPlaceholder("Nombre de usuario").fill(entrenadorUsername);
    await page.getByPlaceholder("Contraseña").fill("entrenador1234");
    await selectCustomOption(page, "Rol del nuevo usuario", "Entrenador");
    await page.getByRole("button", { name: "Crear" }).click();

    const userRow = page.locator("li").filter({ hasText: entrenadorUsername });
    await expect(userRow).toBeVisible();
    await expect(userRow.getByText("Entrenador", { exact: true })).toBeVisible();

    const created = await prisma.user.findUniqueOrThrow({
      where: { username: entrenadorUsername },
    });
    expect(created.role).toBe("entrenador");
  });

  test("un entrenador no puede ver /admin/usuarios ni crear usuarios, pero sí puede registrar un atleta", async ({
    page,
  }) => {
    expect(entrenadorUsername).not.toBeNull();

    await loginAs(page, entrenadorUsername!, "entrenador1234");

    // Redirigido lejos de la gestión de usuarios.
    await page.goto("/admin/usuarios");
    await page.waitForURL(/\/admin$/, { timeout: 10_000 });

    // El enlace "Usuarios" no aparece en la navegación admin para este rol.
    await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);

    // La API rechaza la creación de usuarios para este rol.
    const apiResponse = await page.request.post("/api/users", {
      data: { username: "otro", password: "12345678", role: "entrenador" },
    });
    expect(apiResponse.status()).toBe(403);

    // Pero sí puede registrar un atleta nuevo.
    const cc = `E2E-ROL-${Date.now()}`;
    await page.goto(`/registro?cc=${encodeURIComponent(cc)}`);
    await page.locator("#nombre").fill("Atleta de prueba roles");
    await selectCustomOption(page, "Sexo", "Masculino");
    await page.locator("#masaCorporal").fill("80");
    await page.locator("#edad").fill("28");
    await page.locator("#talla").fill("1.8");
    await page.getByRole("button", { name: "Crear usuario" }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const persona = await prisma.persona.findUnique({ where: { cc } });
    expect(persona).not.toBeNull();
    await prisma.persona.delete({ where: { cc } }).catch(() => {});
  });

  test("dos entrenadores comparten la misma ficha después de confirmar el vínculo", async ({
    page,
  }) => {
    const suffix = Date.now();
    const usernameA = `e2e_aislamiento_a_${suffix}`;
    const usernameB = `e2e_aislamiento_b_${suffix}`;
    const password = "entrenador1234";
    const passwordHash = await bcrypt.hash(password, 10);
    const cc = `E2E-AISLAMIENTO-${suffix}`;

    const entrenadorA = await prisma.user.create({
      data: { username: usernameA, password: passwordHash, role: "entrenador" },
    });
    const entrenadorB = await prisma.user.create({
      data: { username: usernameB, password: passwordHash, role: "entrenador" },
    });

    await prisma.persona.create({
      data: {
        cc,
        nombre: "Atleta aislamiento",
        sexo: "masculino",
        masaCorporal: 80,
        edad: 28,
        talla: 1.8,
        entrenado: true,
        entrenadorId: entrenadorA.id,
        entrenadores: { create: { entrenadorId: entrenadorA.id } },
      },
    });

    try {
      await loginAs(page, usernameB, password);
      // Sin confirmar todavía no puede operar sobre las sesiones del atleta.
      await page.goto(`/dashboard?cc=${encodeURIComponent(cc)}`);
      await page.waitForURL(/\/atletas/, { timeout: 10_000 });
      await page.getByRole("textbox", { name: "Cédula del atleta" }).fill(cc);
      await page.getByRole("button", { name: "Buscar o registrar" }).click();
      await expect(page.locator("#nombre")).toHaveValue("Atleta aislamiento");
      await expect(page.locator("#masaCorporal")).toHaveValue("80");
      expect(await prisma.personaEntrenador.count({ where: { entrenadorId: entrenadorB.id } })).toBe(0);
      await page.locator("#nombre").fill("Atleta compartido");
      await page.getByRole("button", { name: "Guardar cambios y añadir", exact: true }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
      await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
      expect(await prisma.persona.count({ where: { cc } })).toBe(1);
      const compartida = await prisma.persona.findUniqueOrThrow({ where: { cc }, include: { entrenadores: true } });
      expect(compartida.entrenadores).toHaveLength(2);
      expect(compartida.entrenado).toBe(true);
      expect(compartida.nombre).toBe("Atleta compartido");
      await page.goto("/atletas");
      await expect(page.getByText("Atleta compartido", { exact: true }).first()).toBeVisible();

      // El dueño sí puede.
      await loginAs(page, usernameA, password);
      await page.goto(`/dashboard?cc=${encodeURIComponent(cc)}`);
      await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
      await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
      await page.goto(`/registro?cc=${encodeURIComponent(cc)}`);
      await page.locator("#edad").fill("29");
      await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
      await loginAs(page, usernameB, password);
      await page.goto(`/registro?cc=${encodeURIComponent(cc)}`);
      await expect(page.locator("#edad")).toHaveValue("29");
    } finally {
      await prisma.persona.delete({ where: { cc } }).catch(() => {});
      await prisma.user
        .deleteMany({ where: { username: { in: [usernameA, usernameB] } } })
        .catch(() => {});
    }
  });
});

// Roles: admin crea entrenadores; entrenadores no pueden gestionar usuarios
// pero sí pueden registrar atletas. Y (ADR-52) un entrenador no puede ver ni
// editar los atletas de otro entrenador.
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

  test("un entrenador no puede ver ni operar sobre un atleta de otro entrenador (ADR-52)", async ({
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
    await prisma.user.create({
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
      },
    });

    try {
      // El entrenador que NO registró al atleta no puede entrar a su
      // dashboard ni iniciarle un macrociclo por más que conozca el cc.
      await loginAs(page, usernameB, password);
      await page.goto(`/dashboard?cc=${encodeURIComponent(cc)}`);
      await page.waitForURL(/\/atletas/, { timeout: 10_000 });

      await page.goto(`/macrociclo/nuevo?cc=${encodeURIComponent(cc)}`);
      await page.waitForURL(/\/atletas/, { timeout: 10_000 });

      // El dueño sí puede.
      await loginAs(page, usernameA, password);
      await page.goto(`/dashboard?cc=${encodeURIComponent(cc)}`);
      await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
      await expect(page.getByText("Atleta aislamiento")).toBeVisible();
    } finally {
      await prisma.persona.delete({ where: { cc } }).catch(() => {});
      await prisma.user
        .deleteMany({ where: { username: { in: [usernameA, usernameB] } } })
        .catch(() => {});
    }
  });
});

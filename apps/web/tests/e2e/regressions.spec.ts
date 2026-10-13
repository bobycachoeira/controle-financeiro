import { test, expect } from "./fixtures";

// Regressões de bugs já corrigidos — protegem contra voltarem.

test.describe("Regressões", () => {
  test("conta recorrente (a pagar) aparece em Contas recorrentes", async ({ page, loginAs }) => {
    const stamp = Date.now();
    const name = `Aluguel Regressão ${stamp}`;
    await loginAs("titular");
    await page.goto("/recurrences");
    await page.locator("#rec-name").fill(name);
    await page.locator("#rec-amount").fill("1500,00");
    await page.getByRole("button", { name: /Criar recorrência/i }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

    await page.goto("/bills");
    await expect(page.getByRole("heading", { name: "Contas" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Contas recorrentes")).toBeVisible();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  });

  test("perfil: editar o nome reflete na Home", async ({ page, loginAs, backend }) => {
    await loginAs("titular");
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible({ timeout: 15_000 });
    const nameInput = page.locator("#profile-name");
    const original = await nameInput.inputValue();
    const updated = `${original} Editado`;
    await nameInput.fill(updated);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Perfil atualizado.")).toBeVisible({ timeout: 10_000 });

    await page.goto("/");
    await expect(page.getByText(new RegExp(`Olá, ${updated.split(" ")[0]}`))).toBeVisible({
      timeout: 15_000,
    });

    // restaura para não afetar as demais personas
    await backend.api("/auth/me", {
      token: backend.titular.token,
      method: "PATCH",
      body: { name: original },
    });
  });

  test("categoria criada no lançamento é reutilizável", async ({ page, loginAs }) => {
    await loginAs("titular");
    const cat = `Pets E2E ${Date.now()}`;
    await page.goto("/transactions/new");
    await expect(page.locator("#account option", { hasText: "Conta Principal" })).toHaveCount(1, {
      timeout: 15_000,
    });
    await page.locator("#amount").fill("30,00");
    await page.locator("#description").fill(`Ração ${cat}`);
    await page.locator("#account").selectOption({ label: "Conta Principal" });
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(cat);
    await page.getByRole("button", { name: /^Criar/ }).click();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(`Ração ${cat}`)).toBeVisible({ timeout: 10_000 });

    // reaproveita: abre de novo e filtra a categoria criada
    await page.goto("/transactions/new");
    await page.locator("#category").click();
    await page.getByPlaceholder(/Filtrar categoria/).fill(cat);
    await expect(page.getByRole("button", { name: new RegExp(cat) }).first()).toBeVisible();
  });
});

import { test, expect } from "./fixtures";
import { MAE_NAME } from "./fixtures";

test.describe("auditoria", () => {
  test("titular acessa e vê o histórico", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/more");
    await page.getByRole("link", { name: "Auditoria" }).click();
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.getByRole("heading", { name: "Auditoria" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Membro aprovado|Convite criado/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("não-titular não vê o atalho de auditoria", async ({ page, loginAs }) => {
    await loginAs("mae");
    await page.goto("/more");
    await expect(page.getByRole("link", { name: "Auditoria" })).toHaveCount(0);
  });

  test("não-titular ao abrir /audit recebe sem permissão", async ({ page, loginAs }) => {
    await loginAs("mae");
    await page.goto("/audit");
    await expect(page.getByText(/Sem permissão/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("titular concede auditoria a um membro (com step-up)", async ({ page, loginAs, backend }) => {
    await loginAs("titular");
    await page.goto("/family");
    const row = page.locator("li").filter({ hasText: MAE_NAME });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: "Auditoria" }).click();
    await page.locator("#stepup-code").fill(backend.stepUpCode(backend.titular));
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Permissão atualizada.")).toBeVisible({ timeout: 10_000 });
  });

  test("membro com permissão passa a acessar a auditoria", async ({ page, loginAs, backend }) => {
    const code = backend.stepUpCode(backend.titular);
    const verify = await backend.api<{ step_up_token: string }>("/auth/2fa/verify", {
      body: { session_token: backend.titular.token, code, kind: "totp" },
    });
    const me = await backend.api<{ members: Array<{ id: string; user_name: string }> }>("/auth/me", {
      token: backend.titular.token,
    });
    const member = me.data.members.find((item) => item.user_name === MAE_NAME);
    expect(member).toBeTruthy();
    const granted = await backend.api(`/households/${backend.household}/members/${member!.id}`, {
      token: backend.titular.token,
      stepUp: verify.data.step_up_token,
      method: "PATCH",
      body: { permissions: { audit: true } },
    });
    expect(granted.status).toBe(200);

    await loginAs("mae");
    await page.goto("/more");
    await page.getByRole("link", { name: "Auditoria" }).click();
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.getByRole("heading", { name: "Auditoria" })).toBeVisible({ timeout: 15_000 });
  });
});

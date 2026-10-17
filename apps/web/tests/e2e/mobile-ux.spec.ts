import { test, expect, type Page } from "./fixtures";

/**
 * Alvos de toque (Material 3 / WCAG 2.5.8): controles interativos devem ter
 * pelo menos 44x44. Chips e swatches compactos são marcados com data-compact
 * de propósito (padrão de chip denso).
 */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const selector = "button, a[href], input, select, [role=button]";
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.closest("[data-compact]")) continue;
      if (el.getAttribute("href") === "#main-content") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (rect.height < 44 || rect.width < 44) {
        const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40);
        out.push(`${el.tagName.toLowerCase()} "${label}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }
    return out;
  });
}

const ROUTES = ["/", "/transactions", "/transactions/new", "/wallet", "/cards", "/review", "/more"];

test.describe("mobile/Android", () => {
  test("alvos de toque >= 44 nas telas principais", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });

    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForTimeout(500);
      const offenders = await smallTargets(page);
      expect(offenders, `alvos pequenos em ${route}`).toEqual([]);
    }
  });

  test("voltar do Android fecha o modal em vez de sair da tela", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("quick-add-fab").click();
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 5_000 });

    await page.goBack();
    await expect(page.getByTestId("quick-add-sheet")).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByText("Saldo total")).toBeVisible();
  });

  test("voltar fecha só o modal de cima quando empilhados", async ({ page, loginAs }) => {
    await loginAs("titular");

    const extra = `Conta Extra ${Date.now()}`;
    await page.goto("/wallet");
    await page.getByRole("button", { name: /^Nova$/ }).click();
    await page.locator("#account-name").fill(extra);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(extra)).toBeVisible({ timeout: 10_000 });

    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("quick-add-fab").click();
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("qa-more-payers").first().click();
    await expect(page.getByTestId("payer-picker")).toBeVisible({ timeout: 5_000 });

    // 1º voltar: fecha só o seletor.
    await page.goBack();
    await expect(page.getByTestId("payer-picker")).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible();

    // 2º voltar: fecha o quick add.
    await page.goBack();
    await expect(page.getByTestId("quick-add-sheet")).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByText("Saldo total")).toBeVisible();
  });

  test("swipe revela editar/excluir na lista (celular)", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.setViewportSize({ width: 390, height: 844 });
    const description = `Swipe ${Date.now()}`;

    await page.goto("/transactions/new");
    await page.locator("#amount").waitFor({ timeout: 15_000 });
    await page.locator("#amount").fill("9,90");
    await page.locator("#description").fill(description);
    await page.locator("#account").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });

    const row = page.locator("li", { hasText: description });
    await row.scrollIntoViewIfNeeded();
    const box = await row.boundingBox();
    expect(box).toBeTruthy();
    const y = box!.y + box!.height / 2;
    await page.mouse.move(box!.x + box!.width - 24, y);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width - 160, y, { steps: 8 });
    await page.mouse.up();

    await row.getByLabel("Excluir lançamento").click();
    await expect(page.getByRole("button", { name: "Desfazer", exact: true })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(description)).toHaveCount(0);
  });

  test("em tela estreita (320px) o rodapé não cobre o último campo", async ({ page, loginAs }) => {
    await loginAs("titular");
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    await expect(page.getByText("Saldo total")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("quick-add-fab").click();
    await expect(page.getByTestId("quick-add-sheet")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("qa-more").click();
    await page.getByTestId("qa-more-fields").waitFor({ timeout: 5_000 });

    // Rola o painel até o fim: o último campo precisa ficar acima do rodapé sticky.
    await page.evaluate(() => {
      const dialog = document.querySelector("[data-testid='quick-add-sheet']")?.closest("[role=dialog]");
      if (dialog) dialog.scrollTop = dialog.scrollHeight;
    });
    const photo = await page.getByRole("button", { name: "Anexar foto" }).boundingBox();
    const save = await page.getByTestId("qa-save").boundingBox();
    expect(photo && save).toBeTruthy();
    expect(photo!.y + photo!.height).toBeLessThanOrEqual(save!.y + 1);

    // Os dois botões do rodapé cabem sem cortar o texto.
    for (const id of ["qa-save-continue", "qa-save"]) {
      const fits = await page.getByTestId(id).evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
      expect(fits, `${id} com texto cortado`).toBe(true);
    }
  });
});

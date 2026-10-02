import { expect, type Page } from "@playwright/test";

export interface TestUser {
  email: string;
  name: string;
}

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: /enviar link/i }).click();
  await expect(page.getByText(/enviamos um link/i)).toBeVisible();
}

export async function expectDashboard(page: Page): Promise<void> {
  await expect(page.getByText("Saldo total")).toBeVisible();
}

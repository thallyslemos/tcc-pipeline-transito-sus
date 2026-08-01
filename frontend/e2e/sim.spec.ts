import { expect, test } from "@playwright/test";

test("exibe o painel SIM e consulta metadados", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Painel SIM" })).toBeVisible();
  await expect(page.getByText("Mortalidade por acidentes de transporte terrestre")).toBeVisible();

  await page.getByRole("link", { name: "Dados e metadados" }).click();
  await expect(page).toHaveURL(/\/dados$/);
  await expect(page.getByRole("heading", { name: "Dados e metadados" })).toBeVisible();
  await expect(page.getByText("sim_silver_nacional_v2")).toBeVisible();
});

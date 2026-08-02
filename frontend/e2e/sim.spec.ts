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

test('carrega a camada geográfica do mapa', async ({ page }) => {
  const apiErrors: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiErrors.push(String(response.status()) + ' ' + response.url());
    }
  });
  const geoResponse = page.waitForResponse(
    (response) => response.url().includes('/api/geo/municipios') && response.status() === 200,
  );
  await page.goto('/mapa');
  await expect(page.getByRole('heading', { name: 'Mapa SIM' })).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  expect((await geoResponse).status()).toBe(200);
  expect(apiErrors).toEqual([]);
});

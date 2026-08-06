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

test("exibe metricas globais no painel SIM", async ({ page }) => {
  const summaryResponse = page.waitForResponse(
    (response) => response.url().includes("/api/sim/summary") && response.status() === 200,
  );
  await page.goto("/dashboard");
  expect((await summaryResponse).status()).toBe(200);

  await expect(page.getByText("Evolucao mensal")).toBeVisible();
  await expect(page.getByText("Evolucao anual")).toBeVisible();
  await expect(page.getByText("Obitos por Tipo de Veiculo")).toBeVisible();
  await expect(page.getByText("Obitos por Faixa Etaria")).toBeVisible();
  await expect(page.getByText("Distribuicao por Sexo")).toBeVisible();
});

test("carrega mapa de fluxos residencia-ocorrencia", async ({ page }) => {
  const geoResponse = page.waitForResponse(
    (response) => response.url().includes("/api/sim/fluxos/geo") && response.status() === 200
  );
  await page.goto("/fluxos?cod_municipio=293330&ano=2024");
  await expect(page.getByRole("heading", { name: "Fluxos Residencia-Ocorrencia" })).toBeVisible();
  expect((await geoResponse).status()).toBe(200);
});

test('carrega a camada geográfica do mapa', async ({ page }) => {
  const apiErrors: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiErrors.push(String(response.status()) + ' ' + response.url());
    }
  });
  const geoResponse = page.waitForResponse(
    (response) => response.url().includes('/api/sim/geo') && response.status() === 200,
  );
  await page.goto('/mapa');
  await expect(page.getByRole('heading', { name: 'Mapa SIM' })).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  expect((await geoResponse).status()).toBe(200);
  expect(apiErrors).toEqual([]);
});

test('aplica filtro de veiculo no mapa e sinaliza denominador ausente', async ({ page }) => {
  await page.goto('/mapa');
  const vehicleFilter = page.locator('#filter-tipo_veiculo');
  await expect(vehicleFilter.locator('option[value=\"Automovel\"]')).toHaveText('Automovel');
  const filteredResponse = page.waitForResponse(
    (response) => response.url().includes('/api/sim/geo') && response.url().includes('tipo_veiculo=Automovel') && response.status() === 200,
  );
  await vehicleFilter.selectOption('Automovel');
  expect((await filteredResponse).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Taxa / 10 mil veiculos' })).toBeDisabled();
  await expect(page.getByText('Taxa veicular indisponivel')).toBeVisible();
});

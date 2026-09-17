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
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Painel SIM" })).toBeVisible();
  await expect(page.getByText("Obitos ATT", { exact: true })).toBeVisible();
  await expect(page.getByText("Municipios", { exact: true })).toBeVisible();
  await expect(page.getByText("Taxa / 100 mil", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ajuda: Série mensal de óbitos/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ajuda: Evolução anual de óbitos/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ajuda: Óbitos por tipo de vítima/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ajuda: Óbitos por faixa etária/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ajuda: Óbitos por sexo/ })).toBeVisible();
});

test("exibe analise temporal sem erros de fetch", async ({ page }) => {
  await page.goto("/temporal?dimensao=ocorrencia&ano=2024");

  await expect(page.getByRole("heading", { name: "Analise Temporal" })).toBeVisible();
  await expect(page.getByText("Media mensal", { exact: true })).toBeVisible();
  await expect(page.getByText("Media diaria (periodo)", { exact: true })).toBeVisible();
  await expect(page.getByText("Mes de pico", { exact: true })).toBeVisible();
  await expect(page.getByText("Razao fim de semana / dia util", { exact: true })).toBeVisible();
  await expect(page.getByText("Municipios com concentracao temporal")).toBeVisible();
});

test("exibe ranking municipal e permite ordenacao", async ({ page }) => {
  await page.goto("/ranking?dimensao=ocorrencia&ano=2024");

  await expect(page.getByRole("heading", { name: "Ranking SIM" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Taxa / 100 mil" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Obitos absolutos" })).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Municipio" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Taxa / 100 mil" })).toBeVisible();
});

test("exibe consulta municipal com indicadores e series", async ({ page }) => {
  await page.goto("/municipio?dimensao=ocorrencia&ano=2024");

  await expect(page.getByRole("heading", { name: "Consulta municipal" })).toBeVisible();
  await expect(page.getByText("Obitos", { exact: true })).toBeVisible();
  await expect(page.getByText("Taxa / 100 mil", { exact: true })).toBeVisible();
});

test("carrega a camada geográfica do mapa", async ({ page }) => {
  const apiErrors: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400) {
      apiErrors.push(String(response.status()) + " " + response.url());
    }
  });
  await page.goto("/mapa");
  await expect(page.getByRole("heading", { name: "Mapa SIM" })).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  expect(apiErrors).toEqual([]);
});

test("aplica filtro de veiculo no mapa e habilita taxa veicular com frota pareada", async ({ page }) => {
  const tiposPromise = page.waitForResponse(
    (response) => response.url().includes("/api/sim/tipos-veiculo") && response.status() === 200,
  );
  await page.goto("/mapa?ano=2024&uf=BA");
  await tiposPromise;

  const vehicleInput = page.locator("#filter-tipo_veiculo");
  await vehicleInput.click();

  const option = page.getByRole("option", { name: "Automovel", exact: true });
  await expect(option).toBeVisible();

  const filteredResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/sim/geo") &&
      response.url().includes("tipo_veiculo=Automovel") &&
      response.status() === 200,
  );
  await option.click();
  expect((await filteredResponse).status()).toBe(200);

  const vehicleRateButton = page.getByRole("button", { name: "Taxa / 10 mil veiculos" });
  await expect(vehicleRateButton).toBeEnabled();
  await vehicleRateButton.click();
  await expect(vehicleRateButton).toHaveAttribute("style", /brand-soft/);
});

test("carrega mapa de fluxos residencia-ocorrencia", async ({ page }) => {
  await page.goto("/fluxos?municipio=293330&ano=2024");
  await expect(page.getByRole("heading", { name: "Fluxos Residencia-Ocorrencia" })).toBeVisible();
});

test("exibe tendencias com seletor de municipio", async ({ page }) => {
  await page.goto("/previsao?dimensao=ocorrencia&ano=2024");

  await expect(page.getByRole("heading", { name: "Tendencias SIM" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Municipio" })).toBeVisible();
});

test("exibe camada de dados preliminares com aviso", async ({ page }) => {
  await page.goto("/preliminares?dimensao=ocorrencia&ano=2025");
  await expect(page.getByRole("heading", { name: "Dados preliminares do SIM" })).toBeVisible();
  await expect(page.getByText("Dados preliminares — sujeitos a revisao")).toBeVisible();
});

test("exibe pagina sobre com fluxo e informacoes do autor", async ({ page }) => {
  await page.goto("/sobre");

  await expect(page.getByRole("heading", { name: "Mortalidade por acidentes de transporte no SUS" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thallys Viana Lemos" })).toBeVisible();
  await expect(page.getByText("01 · Escopo")).toBeVisible();
});

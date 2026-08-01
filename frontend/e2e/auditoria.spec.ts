import { expect, test } from "@playwright/test";

test("exibe a reconciliação ONSV e separa ocorrência de residência", async ({ page }) => {
  await page.goto("/auditoria");

  await expect(page.getByRole("heading", { name: "Auditoria de totais e metodologias" })).toBeVisible();
  await expect(page.getByTestId("onsv-anchor-2024")).toHaveText("37.150");
  await expect(page.getByTestId("local-deduplicated-2024")).toHaveText("37.150");
  await expect(page.getByTestId("legacy-2024")).toHaveText("78.234");
  await expect(page.getByText("A publicação do ONSV usa ocorrência no Brasil.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Auditoria" })).toHaveAttribute("href", "/auditoria");
});

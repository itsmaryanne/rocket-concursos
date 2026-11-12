import { test, expect } from "./fixtures";
import { observarDialogos, criarPerfil } from "./helpers";

test.describe("tema e responsividade", () => {
  test.beforeEach(async ({ page }) => {
    const mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
  });

  test("alternar o tema muda o data-theme e persiste após recarregar", async ({ page }) => {
    const tema = () => page.evaluate(() => document.documentElement.dataset.theme);

    await page.click("#themeBtn"); // padrão é noite -> dia
    await expect.poll(tema).toBe("light");

    await page.reload();
    await expect.poll(tema).toBe("light");

    await page.click("#themeBtn");
    await expect.poll(tema).toBe("dark");
  });

  test("a página não tem rolagem horizontal", async ({ page }) => {
    const estouro = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(estouro).toBeLessThanOrEqual(0);
  });

  test("o menu abre, mostra as telas e fecha com Esc", async ({ page }) => {
    await page.click("#menuBtn");
    await expect(page.locator("#userMenu")).toBeVisible();
    await expect(page.locator('#userMenu [data-view="amigos"]')).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#userMenu")).toBeHidden();
  });
});

import { test, expect } from "@playwright/test";
import { observarDialogos, criarPerfil, registrarSessoes, irParaAba } from "./helpers";

test.describe("calendário de streak", () => {
  let mensagens;

  test.beforeEach(async ({ page }) => {
    mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
  });

  test("é desenhado com 52 semanas (364 dias)", async ({ page }) => {
    await expect(page.locator(".streak-board")).toBeVisible();
    await expect(page.locator(".streak-day")).toHaveCount(364);
  });

  test("não mostra barra de rolagem vertical", async ({ page }) => {
    const info = await page.$eval("#streakGrid", (el) => ({
      overflowY: getComputedStyle(el).overflowY,
      // uma barra vertical visível ocupa largura dentro do elemento
      larguraDaBarra: el.offsetWidth - el.clientWidth,
    }));

    expect(["auto", "scroll"]).not.toContain(info.overflowY);
    expect(info.larguraDaBarra).toBe(0);
  });

  test("o dia com sessão fica marcado e conta como 1 dia seguido", async ({ page }) => {
    await registrarSessoes(page, 1);
    await irParaAba(page, "visao");

    await expect(page.locator(".streak-day.active")).toHaveCount(1);
    await expect(page.locator("#streakCurrent")).toHaveText("1 dia(s) seguidos");
    await expect(page.locator("#streakTotal")).toHaveText("1 dia(s) com registro");
  });
});

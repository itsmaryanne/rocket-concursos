import { test, expect } from "@playwright/test";
import { observarDialogos, criarPerfil, sair, entrar } from "./helpers";

test.describe("cadastro e login", () => {
  test("cria perfil, sai e volta a entrar", async ({ page }) => {
    const mensagens = observarDialogos(page);
    const id = await criarPerfil(page, mensagens, "Ana", "senha1234");
    expect(id).toMatch(/^\d{5}$/);

    await sair(page);
    await entrar(page, id, "senha1234");
    await expect(page.locator("#appContent")).toBeVisible();
  });

  test("senha errada não entra", async ({ page }) => {
    const mensagens = observarDialogos(page);
    const id = await criarPerfil(page, mensagens);

    await sair(page);
    await entrar(page, id, "senhaErrada");

    await expect.poll(() => mensagens).toContain("ID ou senha inválidos.");
    await expect(page.locator("#authPanel")).toBeVisible();
  });

  test("o login continua depois de recarregar a página", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);

    await page.reload();
    await expect(page.locator("#appContent")).toBeVisible();
  });
});

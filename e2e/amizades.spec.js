import { test, expect } from "./fixtures";
import {
  observarDialogos, criarPerfil, sair, entrar, abrirMenu,
} from "./helpers";

test("fluxo completo: pedido, aceite e dashboard do amigo", async ({ page }) => {
  const mensagens = observarDialogos(page);

  // Ana cria o perfil e sai
  const idAna = await criarPerfil(page, mensagens, "Ana", "senha1234");
  await sair(page);

  // Bia cria o perfil e envia pedido para a Ana pela ID
  await criarPerfil(page, mensagens, "Bia", "senha5678");
  await abrirMenu(page, "amigos");
  await page.fill("#friendQuery", idAna);
  await page.click('#friendSearchForm button[type="submit"]');
  await page.locator("#friendSearchResults").getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.locator("#outgoingRequests")).toContainText("Ana");
  await sair(page);

  // Ana vê o selo de pedido, aceita
  await entrar(page, idAna, "senha1234");
  await expect(page.locator("#menuDot")).toBeVisible();
  await abrirMenu(page, "amigos");
  await expect(page.locator("#incomingRequests")).toContainText("Bia");
  await page.locator("#incomingRequests").getByRole("button", { name: "Aceitar" }).click();
  await expect(page.locator("#friendList")).toContainText("Bia");

  // Ana abre o dashboard da Bia em modo leitura
  await page.locator("#friendList").getByRole("button", { name: "Ver dashboard" }).click();
  await expect(page.locator("#viewModeNotice")).toBeVisible();
  await expect(page.locator("#viewModeNotice")).toContainText("Bia");
  await expect(page.locator("#sessMinutes")).toBeDisabled();
});

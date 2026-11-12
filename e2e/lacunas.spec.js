import { test, expect } from "./fixtures";
import {
  observarDialogos, criarPerfil, sair, entrar, abrirMenu, irParaAba,
} from "./helpers";

/** Ana existe; a Bia está logada e já enviou um pedido para a Ana. */
async function biaEnviaPedido(page, mensagens) {
  const idAna = await criarPerfil(page, mensagens, "Ana", "senha1234");
  await sair(page);
  await criarPerfil(page, mensagens, "Bia", "senha5678");
  await abrirMenu(page, "amigos");
  await page.fill("#friendQuery", idAna);
  await page.click('#friendSearchForm button[type="submit"]');
  await page.locator("#friendSearchResults").getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.locator("#outgoingRequests")).toContainText("Ana");
  return idAna;
}

test.describe("pedidos de amizade", () => {
  test("a Bia pode cancelar o pedido que enviou", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await biaEnviaPedido(page, mensagens);

    await page.locator("#outgoingRequests").getByRole("button", { name: "Cancelar pedido" }).click();
    await expect(page.locator("#outgoingRequests")).toContainText("Sem pedidos enviados");
  });

  test("a Ana pode recusar o pedido e não vira amiga", async ({ page }) => {
    const mensagens = observarDialogos(page);
    const idAna = await biaEnviaPedido(page, mensagens);
    await sair(page);

    await entrar(page, idAna, "senha1234");
    await abrirMenu(page, "amigos");
    await page.locator("#incomingRequests").getByRole("button", { name: "Recusar" }).click();

    await expect(page.locator("#incomingRequests")).toContainText("Sem pedidos recebidos");
    await expect(page.locator("#friendList")).toContainText("Nenhuma amizade");
    await expect(page.locator("#friendsBadge")).toBeHidden();
  });

  test("a busca avisa quando não encontra ninguém", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
    await abrirMenu(page, "amigos");
    await page.fill("#friendQuery", "99999");
    await page.click('#friendSearchForm button[type="submit"]');
    await expect(page.locator("#friendSearchResults")).toContainText("Nenhum usuário encontrado");
  });
});

test.describe("interface", () => {
  let mensagens;

  test.beforeEach(async ({ page }) => {
    mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
  });

  test("nota longa do simulado pode ser expandida e recolhida", async ({ page }) => {
    await irParaAba(page, "simulados");
    await page.fill("#sName", "Simulado com nota");
    await page.fill("#sNotes", "Revisar interpretação de texto, gestão do tempo e matérias fracas. ".repeat(6));
    await page.click('#mockForm button[type="submit"]');

    const alternar = page.locator("#mockList .mock-note-toggle");
    await expect(alternar).toBeVisible();
    await expect(alternar).toHaveText("Ver mais");

    await alternar.click();
    await expect(alternar).toHaveText("Ver menos");
    await expect(alternar).toHaveAttribute("aria-expanded", "true");

    await alternar.click();
    await expect(alternar).toHaveText("Ver mais");
  });

  test("copiar a ID muda o rótulo do botão por um instante", async ({ page }) => {
    await abrirMenu(page, "perfil");
    await page.click("#copyIdBtn");
    await expect(page.locator("#copyIdBtn")).toHaveText("Copiado!");
    await expect(page.locator("#copyIdBtn")).toHaveText("Copiar ID");
  });

  test("clicar no avatar do cabeçalho abre Meu perfil", async ({ page }) => {
    await page.click("#avatarBtn");
    await expect(page.locator("#view-perfil")).toBeVisible();
    await expect(page.locator("#view-dashboard")).toBeHidden();
  });

  test("'Alterar foto' e 'Importar backup' abrem o seletor de arquivos", async ({ page }) => {
    await abrirMenu(page, "perfil");
    const [escolhaFoto] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click("#changePhotoBtn"),
    ]);
    expect(escolhaFoto).toBeTruthy();

    const [escolhaBackup] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click("#importBtn"),
    ]);
    expect(escolhaBackup).toBeTruthy();
  });

  test("redimensionar a janela redesenha o gráfico sem erros", async ({ page }) => {
    const erros = [];
    page.on("pageerror", (e) => erros.push(e.message));

    await page.setViewportSize({ width: 700, height: 800 });
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator("#trend")).toBeVisible();
    expect(erros).toEqual([]);
  });
});

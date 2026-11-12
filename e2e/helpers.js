import { expect } from "@playwright/test";

/** Aceita todos os alert/confirm e guarda as mensagens. */
export function observarDialogos(page) {
  const mensagens = [];
  page.on("dialog", async (dialog) => {
    mensagens.push(dialog.message());
    await dialog.accept();
  });
  return mensagens;
}

/** Abre o site, cria o perfil e devolve a ID de 5 números. */
export async function criarPerfil(page, mensagens, nome = "Ana", senha = "senha1234") {
  await page.goto("/");
  await page.fill("#regName", nome);
  await page.fill("#regPassword", senha);
  await page.click('#registerForm button[type="submit"]');
  await expect(page.locator("#appContent")).toBeVisible();

  const msg = await expect
    .poll(() => mensagens.find((m) => /Sua ID/.test(m)))
    .toBeTruthy()
    .then(() => mensagens.find((m) => /Sua ID/.test(m)));
  return msg.match(/\d{5}/)[0];
}

export async function abrirMenu(page, tela) {
  await page.click("#menuBtn");
  await page.click(`#userMenu [data-view="${tela}"]`);
}

export async function sair(page) {
  await page.click("#menuBtn");
  await page.click("#menuLogout");
  await expect(page.locator("#authPanel")).toBeVisible();
}

export async function entrar(page, id, senha) {
  await page.fill("#loginId", id);
  await page.fill("#loginPassword", senha);
  await page.click('#loginForm button[type="submit"]');
}

export async function irParaAba(page, aba) {
  await page.click(`[data-tab="${aba}"]`);
  await expect(page.locator(`#${aba}`)).toBeVisible();
}

/** Registra N sessões (10, 20, 30... min) na aba Metas. A última é a mais recente. */
export async function registrarSessoes(page, quantidade) {
  await irParaAba(page, "metas");
  for (let i = 1; i <= quantidade; i++) {
    await page.fill("#sessMinutes", String(i * 10));
    await page.click('#sessionForm button[type="submit"]');
    await expect(page.locator("#sessionList .general-record").first()).toContainText(
      `${i * 10} minuto(s)`,
    );
  }
}

/** Grava dados no localStorage ANTES do app carregar (só na 1ª carga da aba). */
export async function semear(page, entradas) {
  await page.addInitScript((dados) => {
    if (sessionStorage.getItem("__semeado")) return;
    sessionStorage.setItem("__semeado", "1");
    for (const [chave, valor] of Object.entries(dados)) {
      localStorage.setItem(chave, valor);
    }
  }, entradas);
}

export const CHAVE = "trilha_aprovacao_v3";

export function conta(id, extra = {}) {
  return {
    id, name: "Ana", password: "senha1234", avatar: "", friends: [],
    records: [], reviews: [], mocks: [], sessions: [],
    goals: { questions: 150, sessions: 15 }, ...extra,
  };
}

export function estado(contas, logadoId = contas[0]?.id, requests = []) {
  return {
    version: 3, activeId: logadoId, session: { loggedInId: logadoId },
    accounts: contas, requests,
  };
}

export const registroValido = (extra = {}) => ({
  id: "ok-1", date: "2026-11-03", subject: "Português", topic: "Crase",
  source: "", total: 20, correct: 14, difficulty: "ok", error: "", notes: "", ...extra,
});

export const chavesDoNavegador = (page) =>
  page.evaluate(() => Object.keys(localStorage));

/** Ana e Bia ficam amigas. Termina logado como Ana. Devolve as IDs. */
export async function tornarAmigos(page, mensagens) {
  const idAna = await criarPerfil(page, mensagens, "Ana", "senha1234");
  await sair(page);

  const idBia = await criarPerfil(page, mensagens, "Bia", "senha5678");
  await abrirMenu(page, "amigos");
  await page.fill("#friendQuery", idAna);
  await page.click('#friendSearchForm button[type="submit"]');
  await page.locator("#friendSearchResults").getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.locator("#outgoingRequests")).toContainText("Ana");
  await sair(page);

  await entrar(page, idAna, "senha1234");
  await abrirMenu(page, "amigos");
  await page.locator("#incomingRequests").getByRole("button", { name: "Aceitar" }).click();
  await expect(page.locator("#friendList")).toContainText("Bia");
  return { idAna, idBia };
}

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

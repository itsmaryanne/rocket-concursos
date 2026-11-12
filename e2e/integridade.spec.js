import { test, expect } from "./fixtures";
import {
  observarDialogos, criarPerfil, irParaAba, registrarSessoes, abrirMenu,
  semear, CHAVE, conta, estado, registroValido, chavesDoNavegador,
} from "./helpers";

const lerEstado = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), CHAVE);

test.describe("armazenamento", () => {
  test("JSON corrompido: avisa e guarda uma cópia do original", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await semear(page, { [CHAVE]: "{isto-esta-quebrado" });
    await page.goto("/");

    await expect.poll(() => mensagens.some((m) => /ilegíveis/.test(m))).toBe(true);

    const copias = (await chavesDoNavegador(page)).filter((k) => k.startsWith(`${CHAVE}_corrompido_`));
    expect(copias).toHaveLength(1);
    expect(await page.evaluate((k) => localStorage.getItem(k), copias[0])).toBe("{isto-esta-quebrado");

    // criar um perfil novo (que grava por cima da chave principal) não apaga a cópia
    await page.fill("#regName", "Ana");
    await page.fill("#regPassword", "senha1234");
    await page.click('#registerForm button[type="submit"]');
    await expect(page.locator("#appContent")).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), copias[0])).toBe("{isto-esta-quebrado");
  });

  test("falha ao gravar: mostra aviso e não anuncia sucesso", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
    await irParaAba(page, "metas");

    await page.evaluate(() => {
      window.__setItemOriginal = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        throw new DOMException("cheio", "QuotaExceededError");
      };
    });

    await page.click('#sessionForm button[type="submit"]');
    await expect(page.locator("#saveWarning")).toBeVisible();
    expect(mensagens.some((m) => /NÃO foram gravadas/.test(m))).toBe(true);
    expect(mensagens).not.toContain("Sessão registrada!");

    // armazenamento volta: o próximo salvamento funciona e o aviso some
    await page.evaluate(() => { Storage.prototype.setItem = window.__setItemOriginal; });
    await page.click('#sessionForm button[type="submit"]');
    await expect(page.locator("#saveWarning")).toBeHidden();
    await expect.poll(() => mensagens).toContain("Sessão registrada!");
  });
});

test.describe("dados inválidos no armazenamento", () => {
  const XSS = "<img src=x onerror=window.__xss=1>";

  const registrosRuins = [
    registroValido(),                                                    // válido
    registroValido({ id: "r2", total: 0, correct: 0 }),                  // total zero
    registroValido({ id: "r3", total: 5, correct: 9 }),                  // acertos > total
    registroValido({ id: "r4", date: "2026-02-31" }),                    // data impossível
    registroValido({ id: "r5", total: XSS, topic: XSS }),                // HTML no lugar de número
    registroValido({ id: "');window.__xss=2;//", topic: "Perigo", total: 10, correct: 5 }), // válido, id hostil
    "lixo",
    null,
  ];

  test("itens inválidos são descartados, com cópia do original e sem executar HTML", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await semear(page, { [CHAVE]: JSON.stringify(estado([conta("11111", { records: registrosRuins })])) });
    await page.goto("/");

    await expect.poll(() => mensagens.some((m) => /6 registro\(s\) inválido\(s\)/.test(m))).toBe(true);
    await expect(page.locator("#mQuestions")).toHaveText("30"); // 20 + 10
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();

    const copias = (await chavesDoNavegador(page)).filter((k) => k.startsWith(`${CHAVE}_antes_da_limpeza_`));
    expect(copias).toHaveLength(1);

    await irParaAba(page, "registros");
    const itens = page.locator("#generalRecordList .general-record");
    await expect(itens).toHaveCount(2);

    // o id hostil foi trocado: excluir funciona e nada é executado
    await itens.filter({ hasText: "Perigo" }).getByRole("button", { name: "Excluir" }).click();
    await expect(itens).toHaveCount(1);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test("pedido de amizade com id hostil não executa código", async ({ page }) => {
    observarDialogos(page);
    const a = conta("11111", { friends: [] });
    const b = conta("22222", { name: "Bia", password: "outra1234" });
    const pedido = { id: "');window.__xss=4;//", fromId: "22222", toId: "11111", status: "pending" };
    await semear(page, { [CHAVE]: JSON.stringify(estado([a, b], "11111", [pedido])) });
    await page.goto("/");

    await abrirMenu(page, "amigos");
    await expect(page.locator("#incomingRequests")).toContainText("Bia");
    await page.locator("#incomingRequests").getByRole("button", { name: "Aceitar" }).click();
    await expect(page.locator("#friendList")).toContainText("Bia");
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test("backup importado com itens inválidos informa quantos foram ignorados", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);

    const backup = estado([conta("55555", {
      records: [registroValido(), { date: "31/12/2026", total: 5, correct: 2 }],
    })]);
    await page.setInputFiles("#importFile", {
      name: "backup.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });

    await expect.poll(() => mensagens.some((m) => /Backup importado! 1 registro\(s\) inválido\(s\)/.test(m))).toBe(true);
    await expect(page.locator("#mQuestions")).toHaveText("20");
  });
});

test.describe("consistência", () => {
  test("IDs de perfil duplicados são corrigidos e as duas contas são mantidas", async ({ page }) => {
    observarDialogos(page);
    const a = conta("11111");
    const b = conta("11111", { name: "Bia", password: "outra1234" });
    await semear(page, { [CHAVE]: JSON.stringify(estado([a, b], "11111")) });
    await page.goto("/");

    await registrarSessoes(page, 1); // força um salvamento
    const salvo = await lerEstado(page);
    expect(salvo.accounts).toHaveLength(2);
    expect(new Set(salvo.accounts.map((c) => c.id)).size).toBe(2);
    expect(salvo.accounts.map((c) => c.name).sort()).toEqual(["Ana", "Bia"]);
  });

  test("amizade registrada só de um lado passa a valer dos dois", async ({ page }) => {
    observarDialogos(page);
    const a = conta("11111", { friends: ["22222"] });
    const b = conta("22222", { name: "Bia", password: "outra1234", friends: [] });
    await semear(page, { [CHAVE]: JSON.stringify(estado([a, b], "11111")) });
    await page.goto("/");

    await registrarSessoes(page, 1);
    const salvo = await lerEstado(page);
    const bia = salvo.accounts.find((c) => c.id === "22222");
    expect(bia.friends).toContain("11111");
  });
});

test.describe("migração de versões antigas", () => {
  const registroAntigo = { date: "2026-11-03", subject: "Português", topic: "Crase", total: 20, correct: 14 };

  test("v2 → v3: preserva dados, mostra credenciais e grava no formato novo", async ({ page }) => {
    const mensagens = observarDialogos(page);
    const v2 = { students: [{
      name: "Ana",
      records: [registroAntigo],
      reviews: [{ subject: "Português", topic: "Crase", date: "2026-11-05", type: "Revisão de conteúdo", done: false }],
      mocks: [{ date: "2026-11-04", name: "Simulado 01", total: 60, correct: 35, minutes: 180 }],
      goals: { questions: 200, sessions: 10 },
    }] };
    await semear(page, { trilha_aprovacao_v2: JSON.stringify(v2) });
    await page.goto("/");

    await expect.poll(() => mensagens.find((m) => /ID \d{5} \| senha/.test(m))).toBeTruthy();
    const idMostrado = mensagens.find((m) => /ID \d{5} \| senha/.test(m)).match(/ID (\d{5})/)[1];

    await expect(page.locator("#appContent")).toBeVisible();
    await expect(page.locator("#mQuestions")).toHaveText("20");
    await expect(page.locator("#mReviews")).toHaveText("1");
    await expect(page.locator("#gQuestions")).toHaveValue("200");
    await irParaAba(page, "simulados");
    await expect(page.locator("#mockList")).toContainText("Simulado 01");

    // já foi gravado no formato novo, com a mesma ID mostrada ao usuário
    const salvo = await lerEstado(page);
    expect(salvo.accounts[0].id).toBe(idMostrado);

    // recarregar não gera credenciais novas
    const antes = mensagens.length;
    await page.reload();
    await expect(page.locator("#appContent")).toBeVisible();
    expect(mensagens.length).toBe(antes);
    expect((await lerEstado(page)).accounts[0].id).toBe(idMostrado);
  });

  test("v1 → v3: preserva os registros", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await semear(page, { trilha_aprovacao_v1: JSON.stringify({ Ana: { records: [registroAntigo] } }) });
    await page.goto("/");

    await expect.poll(() => mensagens.some((m) => /senha/.test(m))).toBe(true);
    await expect(page.locator("#mQuestions")).toHaveText("20");
  });
});

test.describe("texto digitado pelo usuário", () => {
  test("HTML digitado nos campos aparece como texto e não é executado", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
    await irParaAba(page, "registro");

    const perigoso = `<img src=x onerror="window.__xss=9"> & "aspas" 'simples'`;
    await page.fill("#rTopic", perigoso);
    await page.click('#recordForm button[type="submit"]');
    await expect.poll(() => mensagens).toContain("Registro salvo!");

    await irParaAba(page, "registros");
    await expect(page.locator("#generalRecordList")).toContainText(perigoso);
    await expect(page.locator("#generalRecordList img")).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });
});

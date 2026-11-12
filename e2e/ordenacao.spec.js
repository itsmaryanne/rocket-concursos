import { test, expect } from "./fixtures";
import {
  observarDialogos, criarPerfil, irParaAba, semear, CHAVE, conta, estado, registroValido,
} from "./helpers";

const textos = (locator) => locator.allTextContents().then((t) => t.map((x) => x.trim()));

async function abrirComDados(page, contas, extra = {}) {
  observarDialogos(page);
  await semear(page, { [CHAVE]: JSON.stringify(estado(contas, contas[0].id)), ...extra });
  await page.goto("/");
  await expect(page.locator("#appContent")).toBeVisible();
}

test.describe("ordem das listas", () => {
  test("revisões: a data mais próxima aparece primeiro", async ({ page }) => {
    await abrirComDados(page, [conta("11111", { reviews: [
      { id: "v1", subject: "Português", topic: "Depois", date: "2026-11-20", type: "Revisão de conteúdo", done: false },
      { id: "v2", subject: "Português", topic: "Antes", date: "2026-11-05", type: "Revisão de conteúdo", done: false },
    ] })]);
    await irParaAba(page, "revisoes");
    expect(await textos(page.locator("#reviewList b"))).toEqual(["Antes", "Depois"]);
  });

  test("simulados: o mais recente aparece primeiro", async ({ page }) => {
    await abrirComDados(page, [conta("11111", { mocks: [
      { id: "m1", date: "2026-11-01", name: "Antigo", total: 60, correct: 30, minutes: 0, notes: "" },
      { id: "m2", date: "2026-11-09", name: "Recente", total: 60, correct: 40, minutes: 0, notes: "" },
    ] })]);
    await irParaAba(page, "simulados");
    expect(await textos(page.locator("#mockList td.cell-main b"))).toEqual(["Recente", "Antigo"]);
  });

  test("desempenho por disciplina: a pior vem primeiro", async ({ page }) => {
    await abrirComDados(page, [conta("11111", { records: [
      registroValido({ id: "a", subject: "Português", total: 20, correct: 18 }),
      registroValido({ id: "b", subject: "Matemática", total: 20, correct: 8 }),
    ] })]);
    expect(await textos(page.locator("#subjectBars strong"))).toEqual(["Matemática", "Português"]);
  });

  test("dificuldades: a mais frequente vem primeiro; assuntos fracos do pior ao melhor", async ({ page }) => {
    await abrirComDados(page, [conta("11111", { records: [
      registroValido({ id: "a", subject: "Direito Constitucional", topic: "Art. 5º", total: 10, correct: 6, error: "Falta de atenção" }),
      registroValido({ id: "b", subject: "Matemática", topic: "Frações", total: 10, correct: 4, error: "Interpretei errado" }),
      registroValido({ id: "c", subject: "Matemática", topic: "Frações", total: 10, correct: 3, error: "Interpretei errado" }),
    ] })]);
    await irParaAba(page, "dificuldades");

    expect(await textos(page.locator("#errorList > div > span"))).toEqual(["Interpretei errado", "Falta de atenção"]);
    const fracos = await textos(page.locator("#weakList > div > div:first-child b"));
    expect(fracos).toEqual(["Matemática — Frações", "Direito Constitucional — Art. 5º"]);
  });

  test("amigos em ordem alfabética e troca de perfil pelos botões do topo", async ({ page }) => {
    const ana = conta("11111", { friends: ["33333", "22222"] });
    const bia = conta("22222", { name: "Bia", password: "x1234567", friends: ["11111"] });
    const caio = conta("33333", { name: "Caio", password: "y1234567", friends: ["11111"] });
    await abrirComDados(page, [ana, bia, caio]);

    await page.click("#menuBtn");
    await page.click('#userMenu [data-view="amigos"]');
    expect(await textos(page.locator("#friendList .friend-info strong"))).toEqual(["Bia", "Caio"]);

    await page.click("#menuBtn");
    await page.click('#userMenu [data-view="dashboard"]');
    await page.getByRole("button", { name: /Bia \(22222\)/ }).click();
    await expect(page.locator("#viewModeNotice")).toContainText("Bia");
  });
});

test.describe("busca de amigos por nome", () => {
  test("encontra por parte do nome, sem diferenciar maiúsculas, em ordem alfabética", async ({ page }) => {
    const ana = conta("11111");
    const bianca = conta("44444", { name: "Bianca", password: "z1234567" });
    const bia = conta("22222", { name: "Bia", password: "x1234567" });
    const beatriz = conta("55555", { name: "Beatriz", password: "w1234567" });
    const caio = conta("33333", { name: "Caio", password: "y1234567" });
    await abrirComDados(page, [ana, bianca, bia, beatriz, caio]);

    await page.click("#menuBtn");
    await page.click('#userMenu [data-view="amigos"]');
    await page.fill("#friendQuery", "BIA");
    await page.click('#friendSearchForm button[type="submit"]');

    const achados = await textos(page.locator("#friendSearchResults .request-head strong"));
    expect(achados).toEqual(["Bia", "Bianca"]);
  });
});

test.describe("excluir pela lista geral e importar backup antigo", () => {
  test("revisão e simulado podem ser excluídos em 'Registros gerais'", async ({ page }) => {
    await abrirComDados(page, [conta("11111", {
      reviews: [{ id: "v1", subject: "Português", topic: "Crase", date: "2026-11-05", type: "Revisão de conteúdo", done: false }],
      mocks: [{ id: "m1", date: "2026-11-01", name: "Simulado 01", total: 60, correct: 30, minutes: 0, notes: "" }],
    })]);
    await irParaAba(page, "registros");
    const itens = page.locator("#generalRecordList .general-record");
    await expect(itens).toHaveCount(2);

    await page.getByRole("button", { name: /Excluir Revisão/ }).click();
    await expect(itens).toHaveCount(1);
    await page.getByRole("button", { name: /Excluir Simulado/ }).click();
    await expect(page.locator("#generalRecordList")).toContainText("Nenhum registro para mostrar");
  });

  const antigo = { date: "2026-11-03", subject: "Português", topic: "Crase", total: 20, correct: 14 };

  test("backup no formato v2 é convertido e mostra as credenciais", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
    await page.setInputFiles("#importFile", {
      name: "v2.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ students: [{ name: "Antiga", records: [antigo] }] })),
    });
    await expect.poll(() => mensagens.some((m) => /convertido/.test(m) && /ID \d{5} \| senha/.test(m))).toBe(true);
    await expect(page.locator("#mQuestions")).toHaveText("20");
  });

  test("backup no formato v1 é convertido e mostra as credenciais", async ({ page }) => {
    const mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
    await page.setInputFiles("#importFile", {
      name: "v1.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ Antiga: { records: [antigo] } })),
    });
    await expect.poll(() => mensagens.some((m) => /convertido/.test(m) && /ID \d{5} \| senha/.test(m))).toBe(true);
    await expect(page.locator("#mQuestions")).toHaveText("20");
  });
});

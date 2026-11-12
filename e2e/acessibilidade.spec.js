import { test, expect } from "./fixtures";
import {
  observarDialogos, criarPerfil, irParaAba, registrarSessoes, abrirMenu,
  semear, CHAVE, conta, estado, registroValido,
} from "./helpers";

const ABAS = ["visao", "registro", "revisoes", "dificuldades", "simulados", "metas", "registros"];
const TELAS = ["perfil", "amigos", "conquistas", "suporte"];

/* Dados suficientes para todas as listas aparecerem. */
function dadosCompletos() {
  const d = new Date();
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const ana = conta("11111", {
    friends: ["22222"],
    records: [registroValido({ date: hoje, correct: 8, source: "FGV", error: "Interpretei errado" })],
    reviews: [{ id: "v1", subject: "Português", topic: "Crase", date: hoje, type: "Revisão de conteúdo", done: false }],
    mocks: [{ id: "m1", date: hoje, name: "Simulado 01", total: 60, correct: 35, minutes: 180, notes: "nota" }],
    sessions: [{ id: "s1", date: hoje, minutes: 50, notes: "x" }],
  });
  const bia = conta("22222", { name: "Bia", password: "x1234567", friends: ["11111"] });
  const caio = conta("33333", { name: "Caio", password: "y1234567" });
  const pedido = { id: "q1", fromId: "33333", toId: "11111", status: "pending", createdAt: hoje };
  return estado([ana, bia, caio], "11111", [pedido]);
}

/* ---- funções executadas dentro da página ---- */

function auditarNomes() {
  const nome = (el) =>
    (el.getAttribute("aria-label") || "").trim() ||
    (el.getAttribute("aria-labelledby") ? "ref" : "") ||
    (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent.trim()) ||
    el.closest("label")?.textContent.trim() ||
    (el.textContent || "").trim() ||
    el.getAttribute("title") || "";
  const visivel = (el) => el.getClientRects().length > 0;
  const problemas = [];
  document.querySelectorAll("input:not([type=hidden]), select, textarea").forEach((el) => {
    if (visivel(el) && !nome(el)) problemas.push("campo sem nome: " + el.outerHTML.slice(0, 80));
  });
  document.querySelectorAll("button").forEach((el) => {
    if (visivel(el) && !nome(el)) problemas.push("botão sem nome: " + el.outerHTML.slice(0, 80));
  });
  const ids = {};
  document.querySelectorAll("[id]").forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
  Object.entries(ids).filter(([, n]) => n > 1).forEach(([i]) => problemas.push("id duplicado: " + i));
  return problemas;
}

function auditarContraste() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const misturar = (t, b) => ({
    r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1,
  });
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fundo = (el) => {
    const camadas = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) { camadas.push(c); if (c.a === 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    const corpo = parse(getComputedStyle(document.body).backgroundColor);
    if (corpo && corpo.a === 1) base = corpo;
    let res = camadas.length && camadas[camadas.length - 1].a === 1 ? camadas.pop() : base;
    for (let i = camadas.length - 1; i >= 0; i--) res = misturar(camadas[i], res);
    return res;
  };
  const falhas = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set();
  while (w.nextNode()) {
    const t = w.currentNode;
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || vistos.has(el)) continue;
    vistos.add(el);
    if (["SCRIPT", "STYLE", "OPTION"].includes(el.tagName)) continue;
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    let op = 1;
    for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    const fg0 = parse(cs.color);
    if (!fg0) continue;
    const bg = fundo(el);
    const fg = misturar({ ...fg0, a: fg0.a * op }, bg);
    const r = razao(fg, bg);
    const px = parseFloat(cs.fontSize);
    const grande = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    if (r < minimo) falhas.push(`${r.toFixed(2)}:1 (mín ${minimo}) <${el.tagName.toLowerCase()}> "${t.textContent.trim().slice(0, 30)}"`);
  }
  return falhas;
}

/* ---- testes ---- */

test.describe("semântica e teclado", () => {
  let mensagens;

  test.beforeEach(async ({ page }) => {
    mensagens = observarDialogos(page);
  });

  test("o link 'Pular para o conteúdo' é o primeiro foco e leva ao conteúdo", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#conteudo")).toBeFocused();
  });

  test("as abas seguem o padrão ARIA e acompanham a seleção", async ({ page }) => {
    await criarPerfil(page, mensagens);

    await expect(page.locator('[role="tablist"] [role="tab"]')).toHaveCount(7);
    await expect(page.locator("#tab-visao")).toHaveAttribute("aria-selected", "true");

    await page.click("#tab-metas");
    await expect(page.locator("#tab-metas")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#tab-visao")).toHaveAttribute("aria-selected", "false");
    await expect(page.locator("#metas")).toHaveAttribute("role", "tabpanel");
    await expect(page.locator("#metas")).toHaveAttribute("aria-labelledby", "tab-metas");
  });

  test("Esc fecha o menu e devolve o foco ao botão", async ({ page }) => {
    await criarPerfil(page, mensagens);
    await page.click("#menuBtn");
    await expect(page.locator("#userMenu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#userMenu")).toBeHidden();
    await expect(page.locator("#menuBtn")).toBeFocused();
  });

  test("gráfico e calendário têm texto alternativo", async ({ page }) => {
    await criarPerfil(page, mensagens);
    await expect(page.locator("#trend")).toHaveAttribute("role", "img");
    await expect(page.locator("#trend")).toHaveAttribute("aria-label", /Acertos por dia nos últimos 7 dias/);
    await expect(page.locator("#streakGrid")).toHaveAttribute("aria-label", /Calendário de consistência: 0 dia\(s\)/);
  });

  test("o calendário rolável é alcançável pelo teclado", async ({ page }) => {
    await criarPerfil(page, mensagens);
    await page.locator("#streakGrid").focus();
    await expect(page.locator("#streakGrid")).toBeFocused();
  });

  test("os botões de exclusão dizem o que excluem", async ({ page }) => {
    await criarPerfil(page, mensagens);
    await registrarSessoes(page, 1);
    await expect(
      page.locator("#sessionList").getByRole("button", { name: /Excluir sessão de 10 minutos em \d{2}\/\d{2}\/\d{4}/ }),
    ).toHaveCount(1);
  });

  test("campos e botões têm nome acessível em todas as telas", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(auditarNomes)).toEqual([]); // tela de login

    await semear(page, { [CHAVE]: JSON.stringify(dadosCompletos()) });
    await page.goto("/"); // sessão semeada abre o app já logado
    await expect(page.locator("#appContent")).toBeVisible();

    for (const aba of ABAS) {
      await irParaAba(page, aba);
      expect(await page.evaluate(auditarNomes), `aba ${aba}`).toEqual([]);
    }
    for (const tela of TELAS) {
      await abrirMenu(page, tela);
      expect(await page.evaluate(auditarNomes), `tela ${tela}`).toEqual([]);
    }
  });
});

test.describe("contraste mínimo (WCAG AA)", () => {
  for (const tema of ["dark", "light"]) {
    test(`texto legível no tema ${tema}`, async ({ page }) => {
      observarDialogos(page);
      await semear(page, {
        [CHAVE]: JSON.stringify(dadosCompletos()),
        trilha_tema: tema,
      });
      await page.goto("/");
      await expect(page.locator("#appContent")).toBeVisible();

      for (const aba of ABAS) {
        await irParaAba(page, aba);
        expect(await page.evaluate(auditarContraste), `${tema} / aba ${aba}`).toEqual([]);
      }
      for (const tela of TELAS) {
        await abrirMenu(page, tela);
        expect(await page.evaluate(auditarContraste), `${tema} / tela ${tela}`).toEqual([]);
      }
      await page.click("#menuBtn");
      expect(await page.evaluate(auditarContraste), `${tema} / menu aberto`).toEqual([]);
    });
  }
});

test.describe("axe-core (opcional)", () => {
  // Precisa de: npm i -D @axe-core/playwright. Sem o pacote, o teste é pulado.
  test("sem violações críticas", async ({ page }) => {
    let AxeBuilder;
    try {
      ({ default: AxeBuilder } = await import("@axe-core/playwright"));
    } catch {
      test.skip(true, "instale @axe-core/playwright para rodar este teste");
    }

    observarDialogos(page);
    await semear(page, { [CHAVE]: JSON.stringify(dadosCompletos()) });
    await page.goto("/");
    await expect(page.locator("#appContent")).toBeVisible();

    const resultado = await new AxeBuilder({ page }).analyze();
    const resumo = (v) => `${v.impact}: ${v.id} (${v.nodes.length}x)`;
    const criticas = resultado.violations.filter((v) => v.impact === "critical");
    const graves = resultado.violations.filter((v) => v.impact === "serious");
    for (const v of graves) test.info().annotations.push({ type: "axe grave", description: resumo(v) });
    expect(criticas.map(resumo)).toEqual([]);
  });
});

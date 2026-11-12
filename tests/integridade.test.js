import userEvent from "@testing-library/user-event";
import { within } from "@testing-library/dom";
import { $, loadApp, criarPerfil, submitDe, alertas, janela } from "./helpers";

const CHAVE = "trilha_aprovacao_v3";

const conta = (id, extra = {}) => ({
  id, name: "Ana", password: "senha1234", avatar: "", friends: [],
  records: [], reviews: [], mocks: [], sessions: [],
  goals: { questions: 150, sessions: 15 }, ...extra,
});

const estado = (contas, logadoId = contas[0].id, requests = []) => ({
  version: 3, activeId: logadoId, session: { loggedInId: logadoId },
  accounts: contas, requests,
});

const registro = (extra = {}) => ({
  id: "ok-1", date: "2026-11-03", subject: "Português", topic: "Crase",
  source: "", total: 20, correct: 14, difficulty: "ok", error: "", notes: "", ...extra,
});

const semear = (obj) => ({ [CHAVE]: JSON.stringify(obj) });
const chaves = () => Object.keys(localStorage);

describe("armazenamento", () => {
  it("JSON corrompido: avisa e guarda cópia do original", async () => {
    loadApp({ [CHAVE]: "{isto-esta-quebrado" });

    expect(alertas().some((m) => /ilegíveis/.test(m))).toBe(true);
    const copia = chaves().find((k) => k.startsWith(`${CHAVE}_corrompido_`));
    expect(copia).toBeTruthy();
    expect(localStorage.getItem(copia)).toBe("{isto-esta-quebrado");

    // criar perfil grava por cima da chave principal, mas a cópia continua
    const user = userEvent.setup();
    await criarPerfil(user);
    expect(localStorage.getItem(copia)).toBe("{isto-esta-quebrado");
  });

  it("falha ao gravar: mostra aviso e não anuncia sucesso", async () => {
    loadApp();
    const user = userEvent.setup();
    await criarPerfil(user);

    const spy = vi
      .spyOn(janela().Storage.prototype, "setItem")
      .mockImplementation(() => { throw new Error("cheio"); });

    await user.click(submitDe("sessionForm"));
    expect($("saveWarning").classList.contains("hidden")).toBe(false);
    expect(alertas().some((m) => /NÃO foram gravadas/.test(m))).toBe(true);
    expect(alertas()).not.toContain("Sessão registrada!");

    spy.mockRestore();
    await user.click(submitDe("sessionForm"));
    expect($("saveWarning").classList.contains("hidden")).toBe(true);
    expect(alertas()).toContain("Sessão registrada!");
  });
});

describe("dados inválidos no armazenamento", () => {
  const XSS = "<img src=x onerror=window.__xss=1>";

  it("descarta itens inválidos, guarda cópia e não executa HTML", () => {
    loadApp(semear(estado([conta("11111", {
      records: [
        registro(),
        registro({ id: "r2", total: 0, correct: 0 }),
        registro({ id: "r3", total: 5, correct: 9 }),
        registro({ id: "r4", date: "2026-02-31" }),
        registro({ id: "r5", total: XSS, topic: XSS }),
        registro({ id: "');window.__xss=2;//", topic: "Perigo", total: 10, correct: 5 }),
        "lixo",
        null,
      ],
    })])));

    expect(alertas().some((m) => /6 registro\(s\) inválido\(s\)/.test(m))).toBe(true);
    expect($("mQuestions").textContent).toBe("30");
    expect(janela().__xss).toBeUndefined();
    expect(chaves().some((k) => k.startsWith(`${CHAVE}_antes_da_limpeza_`))).toBe(true);
    expect($("generalRecordList").querySelectorAll(".general-record")).toHaveLength(2);
  });

  it("pedido de amizade com id hostil não executa código", async () => {
    const a = conta("11111");
    const b = conta("22222", { name: "Bia", password: "outra1234" });
    const pedido = { id: "');window.__xss=4;//", fromId: "22222", toId: "11111", status: "pending" };
    loadApp(semear(estado([a, b], "11111", [pedido])));

    const user = userEvent.setup();
    expect($("incomingRequests").textContent).toContain("Bia");
    await user.click(within($("incomingRequests")).getByText("Aceitar"));

    expect($("friendList").textContent).toContain("Bia");
    expect(janela().__xss).toBeUndefined();
  });
});

describe("consistência e migração", () => {
  it("IDs de perfil duplicados são corrigidos e as duas contas ficam", async () => {
    loadApp(semear(estado([
      conta("11111"),
      conta("11111", { name: "Bia", password: "outra1234" }),
    ])));

    const user = userEvent.setup();
    await user.click(submitDe("sessionForm")); // força um salvamento

    const salvo = JSON.parse(localStorage.getItem(CHAVE));
    expect(salvo.accounts).toHaveLength(2);
    expect(new Set(salvo.accounts.map((c) => c.id)).size).toBe(2);
  });

  it("amizade de um lado só passa a valer dos dois", async () => {
    loadApp(semear(estado([
      conta("11111", { friends: ["22222"] }),
      conta("22222", { name: "Bia", password: "outra1234" }),
    ])));

    const user = userEvent.setup();
    await user.click(submitDe("sessionForm"));

    const salvo = JSON.parse(localStorage.getItem(CHAVE));
    expect(salvo.accounts.find((c) => c.id === "22222").friends).toContain("11111");
  });

  it("v2 → v3: preserva dados e grava no formato novo", () => {
    const v2 = { students: [{
      name: "Ana",
      records: [{ date: "2026-11-03", subject: "Português", topic: "Crase", total: 20, correct: 14 }],
      reviews: [{ subject: "Português", topic: "Crase", date: "2026-11-05", type: "Revisão de conteúdo", done: false }],
      mocks: [],
      goals: { questions: 200, sessions: 10 },
    }] };
    loadApp({ trilha_aprovacao_v2: JSON.stringify(v2) });

    const msg = alertas().find((m) => /ID \d{5} \| senha/.test(m));
    expect(msg).toBeTruthy();
    const id = msg.match(/ID (\d{5})/)[1];

    expect($("mQuestions").textContent).toBe("20");
    expect($("mReviews").textContent).toBe("1");
    expect($("gQuestions").value).toBe("200");
    expect(JSON.parse(localStorage.getItem(CHAVE)).accounts[0].id).toBe(id);
  });
});

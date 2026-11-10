import userEvent from "@testing-library/user-event";
import { within } from "@testing-library/dom";
import { $, loadApp, criarPerfil, submitDe } from "./helpers";

const cartoes = (listaId) => $(listaId).querySelectorAll(".general-record");
const textos = (listaId) =>
  [...cartoes(listaId)].map((c) => c.querySelector("strong").textContent);

async function registrarSessoes(user, quantidade) {
  for (let i = 1; i <= quantidade; i++) {
    await user.clear($("sessMinutes"));
    await user.type($("sessMinutes"), String(i * 10)); // 10, 20, 30...
    await user.click(submitDe("sessionForm"));
  }
}

describe("sessões de estudo: paginação (5 por página)", () => {
  let user;

  beforeEach(async () => {
    loadApp();
    user = userEvent.setup();
    await criarPerfil(user);
  });

  it("sem sessões mostra a mensagem vazia e nenhum paginador", () => {
    expect($("sessionList").textContent).toContain("Nenhuma sessão registrada");
    expect($("sessionList").querySelector(".pager")).toBeNull();
  });

  it("com até 5 sessões não mostra paginador", async () => {
    await registrarSessoes(user, 5);
    expect(cartoes("sessionList")).toHaveLength(5);
    expect($("sessionList").querySelector(".pager")).toBeNull();
  });

  it("12 sessões viram 3 páginas: 5, 5 e 2", async () => {
    await registrarSessoes(user, 12);
    const lista = within($("sessionList"));

    expect(cartoes("sessionList")).toHaveLength(5);

    await user.click(lista.getByText("Próxima ›"));
    expect(cartoes("sessionList")).toHaveLength(5);

    await user.click(lista.getByText("Próxima ›"));
    expect(cartoes("sessionList")).toHaveLength(2);
  });

  it("mostra da mais recente para a mais antiga", async () => {
    await registrarSessoes(user, 12);

    // a última registrada (120 min) vem primeiro
    expect(textos("sessionList")[0]).toBe("120 minuto(s)");
    expect(textos("sessionList")[4]).toBe("80 minuto(s)");

    await user.click(within($("sessionList")).getByText("Próxima ›"));
    expect(textos("sessionList")[0]).toBe("70 minuto(s)");
  });

  it("‹ Anterior fica desabilitado na página 1 e Próxima na última", async () => {
    await registrarSessoes(user, 7);
    const lista = within($("sessionList"));

    expect(lista.getByText("‹ Anterior").disabled).toBe(true);
    await user.click(lista.getByText("Próxima ›"));
    expect(lista.getByText("Próxima ›").disabled).toBe(true);
  });

  it("ao excluir o último item da última página, volta para a anterior", async () => {
    await registrarSessoes(user, 6); // páginas: 5 + 1
    const lista = within($("sessionList"));

    await user.click(lista.getByText("Próxima ›"));
    expect(cartoes("sessionList")).toHaveLength(1);

    await user.click(lista.getByText("Excluir"));
    expect(cartoes("sessionList")).toHaveLength(5);
    expect($("sessionList").querySelector(".pager")).toBeNull();
  });

  it("registrar nova sessão volta para a página 1", async () => {
    await registrarSessoes(user, 12);
    await user.click(within($("sessionList")).getByText("Próxima ›"));

    await user.clear($("sessMinutes"));
    await user.type($("sessMinutes"), "999");
    await user.click(submitDe("sessionForm"));

    expect(textos("sessionList")[0]).toBe("999 minuto(s)");
  });
});

describe("registros gerais: paginação (10 por página)", () => {
  it("12 sessões viram 2 páginas: 10 e 2", async () => {
    loadApp();
    const user = userEvent.setup();
    await criarPerfil(user);
    await registrarSessoes(user, 12);

    const lista = within($("generalRecordList"));
    expect(cartoes("generalRecordList")).toHaveLength(10);

    await user.click(lista.getByText("Próxima ›"));
    expect(cartoes("generalRecordList")).toHaveLength(2);
  });
});

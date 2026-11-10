import userEvent from "@testing-library/user-event";
import { within } from "@testing-library/dom";
import {
  $, loadApp, criarPerfil, sair, entrar, submitDe, alertas,
} from "./helpers";

describe("amizades", () => {
  let user, idAna, idBia;

  beforeEach(async () => {
    loadApp();
    user = userEvent.setup();
    idAna = await criarPerfil(user, "Ana", "senha1234");
    await sair(user);
    idBia = await criarPerfil(user, "Bia", "senha5678");
  });

  async function biaEnviaPedido() {
    await user.type($("friendQuery"), idAna);
    await user.click(submitDe("friendSearchForm"));
    await user.click(within($("friendSearchResults")).getByText("Enviar pedido"));
  }

  it("encontra o usuário pela ID e envia o pedido", async () => {
    await biaEnviaPedido();

    expect(alertas()).toContain("Pedido de amizade enviado.");
    expect($("outgoingRequests").textContent).toContain("Ana");
  });

  it("não deixa enviar pedido para si mesma", async () => {
    await user.type($("friendQuery"), idBia);
    await user.click(submitDe("friendSearchForm"));

    expect($("friendSearchResults").textContent).toContain("Nenhum usuário encontrado");
  });

  it("Ana recebe, aceita e os dois viram amigos", async () => {
    await biaEnviaPedido();
    await sair(user);
    await entrar(user, idAna, "senha1234");

    expect($("incomingRequests").textContent).toContain("Bia");
    await user.click(within($("incomingRequests")).getByText("Aceitar"));

    expect($("friendList").textContent).toContain("Bia");
    expect($("incomingRequests").textContent).toContain("Sem pedidos recebidos");
  });

  it("ao ver o dashboard da amiga, os formulários ficam em leitura", async () => {
    await biaEnviaPedido();
    await sair(user);
    await entrar(user, idAna, "senha1234");
    await user.click(within($("incomingRequests")).getByText("Aceitar"));

    await user.click(within($("friendList")).getByText("Ver dashboard"));

    expect($("viewModeNotice").classList.contains("hidden")).toBe(false);
    expect($("viewModeNotice").textContent).toContain("Bia");
    expect($("sessMinutes").disabled).toBe(true);
    expect(submitDe("sessionForm").disabled).toBe(true);
  });

  it("recusar o pedido não cria amizade", async () => {
    await biaEnviaPedido();
    await sair(user);
    await entrar(user, idAna, "senha1234");
    await user.click(within($("incomingRequests")).getByText("Recusar"));

    expect($("friendList").textContent).toContain("Nenhuma amizade");
  });
});

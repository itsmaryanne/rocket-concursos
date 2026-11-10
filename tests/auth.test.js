import userEvent from "@testing-library/user-event";
import {
  $, loadApp, criarPerfil, sair, entrar, alertas, estadoSalvo,
} from "./helpers";

describe("cadastro e login", () => {
  beforeEach(() => loadApp());

  it("começa mostrando só o painel de login/cadastro", () => {
    expect($("authPanel").classList.contains("hidden")).toBe(false);
    expect($("appContent").classList.contains("hidden")).toBe(true);
  });

  it("cria o perfil, gera ID de 5 números e entra", async () => {
    const user = userEvent.setup();
    const id = await criarPerfil(user, "Ana", "senha1234");

    expect(id).toMatch(/^\d{5}$/);
    expect($("appContent").classList.contains("hidden")).toBe(false);
    expect($("authPanel").classList.contains("hidden")).toBe(true);
    expect($("profileIdValue").value).toBe(id);
  });

  it("salva a conta no localStorage", async () => {
    const user = userEvent.setup();
    const id = await criarPerfil(user, "Ana", "senha1234");

    const salvo = estadoSalvo();
    expect(salvo.accounts).toHaveLength(1);
    expect(salvo.accounts[0]).toMatchObject({ id, name: "Ana" });
  });

  it("não cria perfil com senha menor que 7 caracteres", async () => {
    const user = userEvent.setup();
    await criarPerfil(user, "Ana", "123");

    expect(estadoSalvo()?.accounts ?? []).toHaveLength(0);
    expect($("appContent").classList.contains("hidden")).toBe(true);
  });

  it("sai e volta a entrar com ID e senha corretas", async () => {
    const user = userEvent.setup();
    const id = await criarPerfil(user, "Ana", "senha1234");

    await sair(user);
    expect($("appContent").classList.contains("hidden")).toBe(true);

    await entrar(user, id, "senha1234");
    expect($("appContent").classList.contains("hidden")).toBe(false);
  });

  it("recusa senha errada", async () => {
    const user = userEvent.setup();
    const id = await criarPerfil(user, "Ana", "senha1234");

    await sair(user);
    await entrar(user, id, "senhaErrada");

    expect(alertas()).toContain("ID ou senha inválidos.");
    expect($("appContent").classList.contains("hidden")).toBe(true);
  });
});

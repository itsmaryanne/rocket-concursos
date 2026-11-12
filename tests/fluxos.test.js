import userEvent from "@testing-library/user-event";
import { within } from "@testing-library/dom";
import {
  $, loadApp, criarPerfil, sair, entrar, submitDe, alertas,
} from "./helpers";

describe("aviso de senha", () => {
  it("o cadastro avisa que a senha fica sem criptografia", () => {
    loadApp();
    expect($("passwordWarning").textContent).toMatch(
      /não use uma senha que você usa em outros\s+sites/i,
    );
  });
});

describe("perfil", () => {
  it("alterar o nome atualiza o menu", async () => {
    loadApp();
    const user = userEvent.setup();
    await criarPerfil(user, "Ana");

    await user.clear($("profileName"));
    await user.type($("profileName"), "Ana Souza");
    await user.click(submitDe("profileForm"));

    expect(alertas()).toContain("Nome atualizado!");
    expect($("menuUser").textContent).toContain("Ana Souza");
  });

  it("a ID do perfil é somente leitura", async () => {
    loadApp();
    const user = userEvent.setup();
    const id = await criarPerfil(user);

    expect($("profileIdValue").value).toBe(id);
    expect($("profileIdValue").readOnly).toBe(true);
  });
});

describe("revisões", () => {
  let user;

  beforeEach(async () => {
    loadApp();
    user = userEvent.setup();
    await criarPerfil(user);
    await user.type($("vTopic"), "Crase");
    await user.click(submitDe("reviewForm"));
  });

  it("agendar aparece na agenda e conta como pendente", () => {
    expect($("reviewList").textContent).toContain("Crase");
    expect($("mReviews").textContent).toBe("1");
  });

  it("concluir tira das pendentes e desmarcar devolve", async () => {
    const caixa = () => $("reviewList").querySelector('input[type="checkbox"]');

    await user.click(caixa());
    expect($("mReviews").textContent).toBe("0");

    await user.click(caixa());
    expect($("mReviews").textContent).toBe("1");
  });

  it("excluir remove da agenda", async () => {
    await user.click(within($("reviewList")).getByText("Excluir"));
    expect($("reviewList").textContent).toContain("Nenhuma revisão agendada");
    expect($("mReviews").textContent).toBe("0");
  });
});

describe("simulados", () => {
  let user;

  beforeEach(async () => {
    loadApp();
    user = userEvent.setup();
    await criarPerfil(user);
  });

  it("calcula o resultado e mostra tempo e nome", async () => {
    await user.type($("sName"), "Simulado 01");
    await user.type($("sMinutes"), "180");
    await user.click(submitDe("mockForm")); // padrão: 35 de 60

    const texto = $("mockList").textContent;
    expect(alertas()).toContain("Simulado salvo!");
    expect(texto).toContain("Simulado 01");
    expect(texto).toContain("58%");
    expect(texto).toContain("35/60");
    expect(texto).toContain("180 min");
  });

  it("recusa acertos maiores que o total", async () => {
    await user.type($("sName"), "Simulado ruim");
    await user.clear($("sTotal"));
    await user.type($("sTotal"), "5");
    await user.clear($("sCorrect"));
    await user.type($("sCorrect"), "9");
    await user.click(submitDe("mockForm"));

    expect(alertas()).toContain("Confira a quantidade de questões e acertos.");
    expect($("mockList").textContent).toContain("Seus simulados aparecerão aqui");
  });

  it("excluir remove o simulado", async () => {
    await user.type($("sName"), "Simulado 01");
    await user.click(submitDe("mockForm"));

    await user.click(within($("mockList")).getByText("Excluir"));
    expect($("mockList").textContent).toContain("Seus simulados aparecerão aqui");
  });
});

describe("registros e metas", () => {
  let user;

  beforeEach(async () => {
    loadApp();
    user = userEvent.setup();
    await criarPerfil(user);
  });

  it("excluir um registro desfaz o efeito no dashboard", async () => {
    await user.type($("rTopic"), "Crase");
    await user.click(submitDe("recordForm"));
    expect($("mQuestions").textContent).toBe("20");

    await user.click(within($("generalRecordList")).getByText("Excluir"));

    expect($("generalRecordList").textContent).toContain("Nenhum registro para mostrar");
    expect($("mQuestions").textContent).toBe("0");
    expect($("mAccuracy").textContent).toBe("—");
  });

  it("atualizar as metas muda o progresso da semana", async () => {
    await user.clear($("gQuestions"));
    await user.type($("gQuestions"), "200");
    await user.clear($("gSessions"));
    await user.type($("gSessions"), "10");
    await user.click(submitDe("goalForm"));

    expect(alertas()).toContain("Metas atualizadas!");
    expect($("goalProgress").textContent).toContain("0 / 200");
    expect($("goalProgress").textContent).toContain("0 / 10");
  });
});

describe("remover amigo", () => {
  it("desfaz a amizade dos dois lados", async () => {
    loadApp();
    const user = userEvent.setup();

    const idAna = await criarPerfil(user, "Ana", "senha1234");
    await sair(user);
    await criarPerfil(user, "Bia", "senha5678");
    await user.type($("friendQuery"), idAna);
    await user.click(submitDe("friendSearchForm"));
    await user.click(within($("friendSearchResults")).getByText("Enviar pedido"));
    await sair(user);

    await entrar(user, idAna, "senha1234");
    await user.click(within($("incomingRequests")).getByText("Aceitar"));
    expect($("friendList").textContent).toContain("Bia");

    await user.click(within($("friendList")).getByText("Remover"));
    expect($("friendList").textContent).toContain("Nenhuma amizade");

    const salvo = JSON.parse(localStorage.getItem("trilha_aprovacao_v3"));
    for (const conta of salvo.accounts) expect(conta.friends).toEqual([]);
  });
});

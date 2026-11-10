import userEvent from "@testing-library/user-event";
import { $, loadApp, criarPerfil, submitDe, alertas } from "./helpers";

describe("registro de questões", () => {
  let user;

  beforeEach(async () => {
    loadApp();
    user = userEvent.setup();
    await criarPerfil(user);
  });

  it("calcula questões e taxa de acertos no dashboard", async () => {
    await user.type($("rTopic"), "Crase");
    await user.click(submitDe("recordForm")); // padrão: 20 questões, 14 acertos

    expect($("mQuestions").textContent).toBe("20");
    expect($("mAccuracy").textContent).toBe("70%");
    expect(alertas()).toContain("Registro salvo!");
  });

  it("acumula vários registros", async () => {
    await user.type($("rTopic"), "Crase");
    await user.click(submitDe("recordForm")); // 14/20

    await user.type($("rTopic"), "Regência");
    await user.clear($("rTotal"));
    await user.type($("rTotal"), "10");
    await user.clear($("rCorrect"));
    await user.type($("rCorrect"), "10");
    await user.click(submitDe("recordForm")); // 10/10

    expect($("mQuestions").textContent).toBe("30");
    expect($("mAccuracy").textContent).toBe("80%"); // 24/30
  });

  it("recusa acertos maiores que o total", async () => {
    await user.type($("rTopic"), "Crase");
    await user.clear($("rTotal"));
    await user.type($("rTotal"), "5");
    await user.clear($("rCorrect"));
    await user.type($("rCorrect"), "9");
    await user.click(submitDe("recordForm"));

    expect(alertas()).toContain("Confira a quantidade de questões e acertos.");
    expect($("mQuestions").textContent).toBe("0");
  });

  it("o registro aparece em 'Registros gerais'", async () => {
    await user.type($("rTopic"), "Crase");
    await user.click(submitDe("recordForm"));

    expect($("generalRecordList").textContent).toContain("Crase");
  });
});

describe("metas semanais", () => {
  it("sessões de hoje contam na meta da semana", async () => {
    loadApp();
    const user = userEvent.setup();
    await criarPerfil(user);

    await user.click(submitDe("sessionForm"));
    await user.click(submitDe("sessionForm"));

    expect($("mSessions").textContent).toBe("2");
    expect($("goalProgress").textContent).toContain("2 / 15");
  });
});

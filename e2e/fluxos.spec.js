import { test, expect } from "./fixtures";
import {
  observarDialogos, criarPerfil, abrirMenu, irParaAba, tornarAmigos,
} from "./helpers";

// PNG 1x1 válido
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("aviso de senha", () => {
  test("o cadastro avisa que a senha fica sem criptografia", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#passwordWarning")).toBeVisible();
    await expect(page.locator("#passwordWarning")).toContainText(/não use uma senha que você usa em outros\s+sites/i);
  });
});

test.describe("perfil", () => {
  let mensagens;

  test.beforeEach(async ({ page }) => {
    mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens, "Ana", "senha1234");
    await abrirMenu(page, "perfil");
  });

  test("alterar o nome atualiza o menu e persiste após recarregar", async ({ page }) => {
    await page.fill("#profileName", "Ana Souza");
    await page.click('#profileForm button[type="submit"]');
    await expect.poll(() => mensagens).toContain("Nome atualizado!");

    await expect(page.locator("#menuUser")).toContainText("Ana Souza");
    await page.reload();
    await expect(page.locator("#menuUser")).toContainText("Ana Souza");
  });

  test("a ID do perfil aparece e não pode ser editada", async ({ page }) => {
    await expect(page.locator("#profileIdValue")).toHaveValue(/^\d{5}$/);
    await expect(page.locator("#profileIdValue")).toHaveJSProperty("readOnly", true);
  });

  test("enviar foto mostra o avatar e remover volta às iniciais", async ({ page }) => {
    await expect(page.locator("#removePhotoBtn")).toBeHidden();

    await page.setInputFiles("#avatarInput", { name: "foto.png", mimeType: "image/png", buffer: PNG_1X1 });
    await expect(page.locator("#profileAvatar img")).toHaveCount(1);
    await expect(page.locator("#avatarBtn img")).toHaveCount(1);
    await expect(page.locator("#removePhotoBtn")).toBeVisible();

    const salvo = await page.evaluate(
      () => JSON.parse(localStorage.getItem("trilha_aprovacao_v3")).accounts[0].avatar,
    );
    expect(salvo.startsWith("data:image/jpeg;base64,")).toBe(true);

    await page.click("#removePhotoBtn");
    await expect(page.locator("#profileAvatar img")).toHaveCount(0);
    await expect(page.locator("#removePhotoBtn")).toBeHidden();
  });

  test("imagem corrompida é recusada com aviso", async ({ page }) => {
    await page.setInputFiles("#avatarInput", {
      name: "quebrada.png", mimeType: "image/png", buffer: Buffer.from("isto não é um png de verdade"),
    });
    await expect.poll(() => mensagens).toContain("Não foi possível ler essa imagem.");
    await expect(page.locator("#profileAvatar img")).toHaveCount(0);
  });

  test("arquivo que não é imagem é recusado", async ({ page }) => {
    await page.setInputFiles("#avatarInput", {
      name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("oi"),
    });
    await expect.poll(() => mensagens).toContain("Use uma imagem JPG, PNG ou WebP.");
    await expect(page.locator("#profileAvatar img")).toHaveCount(0);
  });
});

test.describe("revisões", () => {
  let mensagens;

  test.beforeEach(async ({ page }) => {
    mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
    await irParaAba(page, "revisoes");
    await page.fill("#vTopic", "Crase");
    await page.click('#reviewForm button[type="submit"]');
  });

  test("agendar aparece na agenda e conta como pendente", async ({ page }) => {
    await expect(page.locator("#reviewList")).toContainText("Crase");
    await irParaAba(page, "visao");
    await expect(page.locator("#mReviews")).toHaveText("1");
  });

  test("concluir tira das pendentes e desmarcar devolve", async ({ page }) => {
    const caixa = page.locator('#reviewList input[type="checkbox"]');
    await caixa.check();
    await irParaAba(page, "visao");
    await expect(page.locator("#mReviews")).toHaveText("0");

    await irParaAba(page, "revisoes");
    await caixa.uncheck();
    await irParaAba(page, "visao");
    await expect(page.locator("#mReviews")).toHaveText("1");
  });

  test("excluir remove da agenda", async ({ page }) => {
    await page.locator("#reviewList").getByRole("button", { name: "Excluir" }).click();
    await expect(page.locator("#reviewList")).toContainText("Nenhuma revisão agendada");
  });
});

test.describe("simulados", () => {
  let mensagens;

  test.beforeEach(async ({ page }) => {
    mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
    await irParaAba(page, "simulados");
  });

  test("calcula o resultado e mostra tempo e nome", async ({ page }) => {
    await page.fill("#sName", "Simulado 01");
    await page.fill("#sMinutes", "180");
    await page.click('#mockForm button[type="submit"]');
    await expect.poll(() => mensagens).toContain("Simulado salvo!");

    const lista = page.locator("#mockList");
    await expect(lista).toContainText("Simulado 01");
    await expect(lista).toContainText("58%"); // 35 de 60
    await expect(lista).toContainText("35/60");
    await expect(lista).toContainText("180 min");
  });

  test("recusa acertos maiores que o total", async ({ page }) => {
    await page.fill("#sName", "Simulado ruim");
    await page.fill("#sTotal", "5");
    await page.fill("#sCorrect", "9");
    await page.click('#mockForm button[type="submit"]');

    await expect.poll(() => mensagens).toContain("Confira a quantidade de questões e acertos.");
    await expect(page.locator("#mockList")).toContainText("Seus simulados aparecerão aqui");
  });

  test("excluir remove o simulado", async ({ page }) => {
    await page.fill("#sName", "Simulado 01");
    await page.click('#mockForm button[type="submit"]');
    await expect(page.locator("#mockList")).toContainText("Simulado 01");

    await page.locator("#mockList").getByRole("button", { name: "Excluir" }).click();
    await expect(page.locator("#mockList")).toContainText("Seus simulados aparecerão aqui");
  });
});

test.describe("registros e metas", () => {
  let mensagens;

  test.beforeEach(async ({ page }) => {
    mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
  });

  test("registrar questões atualiza o dashboard e excluir desfaz", async ({ page }) => {
    await irParaAba(page, "registro");
    await page.fill("#rTopic", "Crase");
    await page.click('#recordForm button[type="submit"]'); // 14 de 20
    await expect.poll(() => mensagens).toContain("Registro salvo!");

    await irParaAba(page, "visao");
    await expect(page.locator("#mQuestions")).toHaveText("20");
    await expect(page.locator("#mAccuracy")).toHaveText("70%");

    await irParaAba(page, "registros");
    await page.locator("#generalRecordList").getByRole("button", { name: "Excluir" }).click();
    await expect(page.locator("#generalRecordList")).toContainText("Nenhum registro para mostrar");

    await irParaAba(page, "visao");
    await expect(page.locator("#mQuestions")).toHaveText("0");
    await expect(page.locator("#mAccuracy")).toHaveText("—");
  });

  test("atualizar as metas muda o progresso da semana", async ({ page }) => {
    await irParaAba(page, "metas");
    await page.fill("#gQuestions", "200");
    await page.fill("#gSessions", "10");
    await page.click('#goalForm button[type="submit"]');
    await expect.poll(() => mensagens).toContain("Metas atualizadas!");

    await expect(page.locator("#goalProgress")).toContainText("0 / 200");
    await expect(page.locator("#goalProgress")).toContainText("0 / 10");
  });
});

test("remover amigo desfaz a amizade dos dois lados", async ({ page }) => {
  const mensagens = observarDialogos(page);
  await tornarAmigos(page, mensagens);

  await page.locator("#friendList").getByRole("button", { name: "Remover" }).click();
  await expect(page.locator("#friendList")).toContainText("Nenhuma amizade");

  // a Bia também deixou de ter a Ana como amiga
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem("trilha_aprovacao_v3")));
  for (const conta of salvo.accounts) expect(conta.friends).toEqual([]);
});

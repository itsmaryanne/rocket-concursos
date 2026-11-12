import { test, expect } from "./fixtures";
import {
  observarDialogos, criarPerfil, registrarSessoes, irParaAba,
} from "./helpers";

const cartoesSessoes = (page) => page.locator("#sessionList .general-record");
const cartoesGerais = (page) => page.locator("#generalRecordList .general-record");

test.describe("paginação", () => {
  test.beforeEach(async ({ page }) => {
    const mensagens = observarDialogos(page);
    await criarPerfil(page, mensagens);
    await registrarSessoes(page, 12);
  });

  test("sessões: 5 por página (5, 5 e 2) da mais recente para a mais antiga", async ({ page }) => {
    await expect(cartoesSessoes(page)).toHaveCount(5);
    await expect(cartoesSessoes(page).first()).toContainText("120 minuto(s)");
    await expect(cartoesSessoes(page).last()).toContainText("80 minuto(s)");

    const pager = page.locator("#sessionList .pager");
    await pager.getByRole("button", { name: "Próxima ›" }).click();
    await expect(cartoesSessoes(page)).toHaveCount(5);
    await expect(cartoesSessoes(page).first()).toContainText("70 minuto(s)");

    await pager.getByRole("button", { name: "Próxima ›" }).click();
    await expect(cartoesSessoes(page)).toHaveCount(2);
    await expect(cartoesSessoes(page).last()).toContainText("10 minuto(s)");
    await expect(pager.getByRole("button", { name: "Próxima ›" })).toBeDisabled();
  });

  test("sessões: clicar no número da página funciona", async ({ page }) => {
    const pager = page.locator("#sessionList .pager");
    await pager.getByRole("button", { name: "3", exact: true }).click();
    await expect(cartoesSessoes(page)).toHaveCount(2);
    await expect(pager.locator("button.active")).toHaveText("3");
  });

  test("sessões: excluir os itens da última página volta para a anterior", async ({ page }) => {
    const pager = page.locator("#sessionList .pager");
    await pager.getByRole("button", { name: "3", exact: true }).click();

    await cartoesSessoes(page).first().getByRole("button", { name: "Excluir" }).click();
    await cartoesSessoes(page).first().getByRole("button", { name: "Excluir" }).click();

    await expect(cartoesSessoes(page)).toHaveCount(5);
    await expect(pager.locator("button.active")).toHaveText("2");
    await expect(pager.getByRole("button", { name: "3", exact: true })).toHaveCount(0);
  });

  test("registros gerais: 10 por página (10 e 2)", async ({ page }) => {
    await irParaAba(page, "registros");
    await expect(cartoesGerais(page)).toHaveCount(10);

    await page.locator("#generalRecordList .pager").getByRole("button", { name: "Próxima ›" }).click();
    await expect(cartoesGerais(page)).toHaveCount(2);
  });

  test("nova sessão volta a lista para a página 1", async ({ page }) => {
    await page.locator("#sessionList .pager").getByRole("button", { name: "Próxima ›" }).click();

    await page.fill("#sessMinutes", "999");
    await page.click('#sessionForm button[type="submit"]');

    await expect(cartoesSessoes(page).first()).toContainText("999 minuto(s)");
  });
});

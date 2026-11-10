import { test, expect } from "@playwright/test";
import {
  observarDialogos, criarPerfil, registrarSessoes,
} from "./helpers";

test("exporta o backup, apaga os dados e importa de volta", async ({ page }) => {
  const mensagens = observarDialogos(page);
  await criarPerfil(page, mensagens, "Ana", "senha1234");
  await registrarSessoes(page, 1);

  // Exportar
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportBtn"),
  ]);
  expect(download.suggestedFilename()).toMatch(/^backup-trilha-aprovacao-\d{4}-\d{2}-\d{2}\.json$/);

  const stream = await download.createReadStream();
  const partes = [];
  for await (const parte of stream) partes.push(parte);
  const conteudo = Buffer.concat(partes);
  const backup = JSON.parse(conteudo.toString("utf8"));
  expect(backup.accounts[0].name).toBe("Ana");
  expect(backup.accounts[0].sessions).toHaveLength(1);

  // Apagar
  await page.click("#clearBtn");
  await expect(page.locator("#sessionList")).toContainText("Nenhuma sessão registrada");

  // Importar
  await page.setInputFiles("#importFile", {
    name: "backup.json",
    mimeType: "application/json",
    buffer: conteudo,
  });
  await expect.poll(() => mensagens).toContain("Backup importado!");
  await expect(page.locator("#sessionList .general-record")).toHaveCount(1);
});

test("arquivo inválido não substitui os dados", async ({ page }) => {
  const mensagens = observarDialogos(page);
  await criarPerfil(page, mensagens);
  await registrarSessoes(page, 1);

  await page.setInputFiles("#importFile", {
    name: "lixo.json",
    mimeType: "application/json",
    buffer: Buffer.from("isto não é json"),
  });
  await expect.poll(() => mensagens).toContain("Arquivo inválido ou incompatível.");
  await expect(page.locator("#sessionList .general-record")).toHaveCount(1);
});

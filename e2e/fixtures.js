import { test as base, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Com COBERTURA=1 (e só no Chromium), guarda a cobertura de JS do app.js de cada teste.
// Use: npm run test:e2e:cobertura
const COBERTURA = process.env.COBERTURA === "1";
const eDoApp = (e) => /\/app\.js(\?|$)/.test(e.url);

export const test = base.extend({
  page: async ({ page, browserName }, use, testInfo) => {
    const ativa = COBERTURA && browserName === "chromium";
    const coletadas = [];

    // O Chromium descarta a cobertura de uma página ao navegar/recarregar.
    // Por isso coletamos ANTES de cada goto/reload e recomeçamos em seguida.
    const coletar = async () => {
      coletadas.push(...(await page.coverage.stopJSCoverage()).filter(eDoApp));
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
    };

    if (ativa) {
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      for (const metodo of ["goto", "reload"]) {
        const original = page[metodo].bind(page);
        page[metodo] = async (...args) => {
          await coletar();
          return original(...args);
        };
      }
    }

    await use(page);

    if (ativa) {
      coletadas.push(...(await page.coverage.stopJSCoverage()).filter(eDoApp));
      if (coletadas.length) {
        const pasta = join("coverage-e2e", "brutos");
        await mkdir(pasta, { recursive: true });
        const nome = `${testInfo.project.name}-${testInfo.testId}.json`;
        await writeFile(join(pasta, nome), JSON.stringify(coletadas));
      }
    }
  },
});

export { expect };

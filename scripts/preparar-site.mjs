// Copia só os arquivos publicados para _site/ (usado pelo Lighthouse CI).
import { mkdir, copyFile, rm } from "node:fs/promises";

await rm("_site", { recursive: true, force: true });
await mkdir("_site", { recursive: true });
for (const arquivo of ["index.html", "style.css", "app.js"]) {
  await copyFile(arquivo, `_site/${arquivo}`);
}
console.log("_site/ pronto com index.html, style.css e app.js");

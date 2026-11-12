// Junta a cobertura de JS (V8) de todos os testes e-2-e e gera um resumo do app.js.
//   node scripts/cobertura.mjs --rodar   -> roda o Playwright (desktop) com cobertura e resume
//   node scripts/cobertura.mjs           -> só resume o que já foi coletado
import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const RAIZ = "coverage-e2e";
const BRUTOS = join(RAIZ, "brutos");

if (process.argv.includes("--rodar")) {
  await rm(RAIZ, { recursive: true, force: true });
  const r = spawnSync("npx", ["playwright", "test", "--project=desktop"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, COBERTURA: "1" },
  });
  if (r.status !== 0) {
    console.error("\nOs testes falharam; a cobertura abaixo pode estar incompleta.");
  }
}

const arquivos = (await readdir(BRUTOS).catch(() => [])).filter((f) => f.endsWith(".json"));
if (!arquivos.length) {
  console.error("Nenhuma cobertura encontrada. Rode: npm run test:e2e:cobertura");
  process.exit(1);
}

let fonte = null;
let coberto = null;
const funcoes = new Map(); // chave -> { nome, inicio, chamada }

for (const arq of arquivos) {
  const entradas = JSON.parse(await readFile(join(BRUTOS, arq), "utf8"));
  for (const entrada of entradas) {
    if (fonte === null) {
      fonte = entrada.source;
      coberto = new Uint8Array(fonte.length);
    }
    if (entrada.source.length !== fonte.length) continue; // outra versão do arquivo

    const faixas = [];
    entrada.functions.forEach((fn, ordem) => {
      fn.ranges.forEach((r, i) => faixas.push({ ini: r.startOffset, fim: r.endOffset, n: r.count, ordem: ordem * 1000 + i }));
      const chave = `${fn.ranges[0].startOffset}:${fn.functionName}`;
      const atual = funcoes.get(chave) ?? { nome: fn.functionName, inicio: fn.ranges[0].startOffset, chamada: false };
      atual.chamada ||= fn.ranges[0].count > 0;
      funcoes.set(chave, atual);
    });

    // faixas externas primeiro; as internas sobrescrevem
    faixas.sort((a, b) => a.ini - b.ini || b.fim - a.fim || a.ordem - b.ordem);
    const marca = new Uint8Array(fonte.length);
    for (const f of faixas) marca.fill(f.n > 0 ? 1 : 0, f.ini, Math.min(f.fim, fonte.length));
    for (let i = 0; i < marca.length; i++) coberto[i] ||= marca[i];
  }
}

// ---- linhas ----
const linhas = fonte.split("\n");
const inicios = [];
let pos = 0;
for (const l of linhas) { inicios.push(pos); pos += l.length + 1; }
const numeroDaLinha = (offset) => {
  let lo = 0, hi = inicios.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (inicios[m] <= offset) lo = m; else hi = m - 1; }
  return lo + 1;
};

const status = []; // 'x' (não é código), 'c' coberta, 'u' não coberta
let emBloco = false;
linhas.forEach((texto, i) => {
  const t = texto.trim();
  if (emBloco) { if (t.includes("*/")) emBloco = false; status.push("x"); return; }
  if (t.startsWith("/*")) { if (!t.includes("*/")) emBloco = true; status.push("x"); return; }
  if (!t || t.startsWith("//")) { status.push("x"); return; }
  let algumCoberto = false;
  for (let j = 0; j < texto.length; j++) {
    if (!/\s/.test(texto[j]) && coberto[inicios[i] + j]) { algumCoberto = true; break; }
  }
  status.push(algumCoberto ? "c" : "u");
});

const executaveis = status.filter((s) => s !== "x").length;
const cobertas = status.filter((s) => s === "c").length;
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : "0.0");

// ---- funções ----
const todasFuncoes = [...funcoes.values()].filter((f) => !(f.inicio === 0));
const chamadas = todasFuncoes.filter((f) => f.chamada).length;
const naoChamadas = todasFuncoes
  .filter((f) => !f.chamada)
  .map((f) => {
    const linha = numeroDaLinha(f.inicio);
    const trecho = linhas[linha - 1].trim().slice(0, 80);
    return { linha, nome: f.nome || "(anônima)", trecho };
  })
  .sort((a, b) => a.linha - b.linha);

// ---- relatório ----
const saida = [];
saida.push(`# Cobertura do app.js (testes e2e, Chromium)`);
saida.push("");
saida.push(`- Linhas executáveis cobertas: **${cobertas}/${executaveis} (${pct(cobertas, executaveis)}%)**`);
saida.push(`- Funções chamadas: **${chamadas}/${todasFuncoes.length} (${pct(chamadas, todasFuncoes.length)}%)**`);
saida.push(`- Testes considerados: ${arquivos.length}`);
saida.push("");
saida.push(`## Funções que nenhum teste chamou (${naoChamadas.length})`);
saida.push("");
if (!naoChamadas.length) saida.push("Nenhuma.");
for (const f of naoChamadas) saida.push(`- linha ${f.linha}: \`${f.nome}\`  ${f.trecho ? "→ `" + f.trecho.replace(/`/g, "'") + "`" : ""}`);
saida.push("");
saida.push("> Linha coberta = alguma parte dela foi executada. É uma medida de onde os testes passam, não de quão bem verificam.");

await mkdir(RAIZ, { recursive: true });
await writeFile(join(RAIZ, "resumo.md"), saida.join("\n") + "\n");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const html = `<!doctype html><meta charset="utf-8"><title>Cobertura do app.js</title>
<style>body{font:13px/1.4 ui-monospace,Consolas,monospace;margin:16px}pre{margin:0}
.l{display:inline-block;width:56px;color:#888;text-align:right;margin-right:12px;user-select:none}
.c{background:#e6f4ea}.u{background:#fde8e8}</style>
<h1>Cobertura do app.js: ${pct(cobertas, executaveis)}% das linhas</h1>
<p>Verde: executada por algum teste. Vermelho: nenhum teste passou aqui.</p>
${linhas.map((t, i) => `<pre class="${status[i] === "x" ? "" : status[i]}"><span class="l">${i + 1}</span>${esc(t.replace(/\r$/, ""))}</pre>`).join("")}`;
await writeFile(join(RAIZ, "app.html"), html);

console.log(saida.slice(0, 5).join("\n"));
console.log(`\nFunções sem chamada: ${naoChamadas.length}. Detalhes em ${join(RAIZ, "resumo.md")} e ${join(RAIZ, "app.html")}`);

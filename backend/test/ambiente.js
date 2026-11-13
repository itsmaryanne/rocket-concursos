import { criarD1 } from "./d1-sqlite.js";
import { tratar } from "../src/index.js";

export const ORIGEM = "https://exemplo.github.io";
export const PIMENTA = "pimenta-de-teste-com-mais-de-16-caracteres";

/** Monta um "servidor" de teste: banco novo, relógio controlável, IDs previsíveis opcionais. */
export function montar({ extraEnv = {}, deps = {} } = {}) {
  const db = criarD1();
  const relogio = { agora: 1_800_000_000_000 };
  const env = {
    DB: db,
    PASSWORD_PEPPER: PIMENTA,
    PBKDF2_ITERATIONS: "1000", // rápido nos testes; em produção use o máximo que o plano suportar
    ALLOWED_ORIGINS: ORIGEM,
    ...extraEnv,
  };
  let seq = 0;
  const depsFinais = { agora: () => relogio.agora, uuid: () => `conta-${++seq}`, ...deps };

  async function req(metodo, caminho, corpo, { token, ip = "203.0.113.7", origem = ORIGEM } = {}) {
    const headers = { "CF-Connecting-IP": ip };
    if (origem) headers.Origin = origem;
    if (token) headers.Authorization = `Bearer ${token}`;
    let body;
    if (corpo !== undefined) {
      body = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
      headers["Content-Type"] = "application/json";
    }
    const resposta = await tratar(new Request("https://api.exemplo.workers.dev" + caminho, { method: metodo, headers, body }), env, depsFinais);
    const texto = await resposta.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* sem corpo */ }
    return { status: resposta.status, json, texto, headers: resposta.headers };
  }

  const cadastrar = (nome = "Ana", senha = "senha-bem-longa-1", opcoes) =>
    req("POST", "/auth/cadastro", { nome, senha }, opcoes);

  return { db, env, req, cadastrar, relogio };
}

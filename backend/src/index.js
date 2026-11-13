// API do Rocket Concursos (Cloudflare Worker + D1). Etapa 1: contas e sessões.
import { json, erro, cabecalhosCors, origensPermitidas } from "./http.js";
import { cadastrar, entrar, sair, eu, recuperar, hashFalso } from "./auth.js";
import { sortearIdPublico } from "./crypto.js";

const ROTAS = {
  "POST /auth/cadastro": cadastrar,
  "POST /auth/entrar": entrar,
  "POST /auth/sair": sair,
  "POST /auth/recuperar": recuperar,
  "GET /auth/eu": eu,
};

const DEPS_PADRAO = {
  agora: () => Date.now(),
  uuid: () => crypto.randomUUID(),
  idPublico: sortearIdPublico,
  hashFalso,
};

export async function tratar(request, env, deps = {}) {
  const d = { ...DEPS_PADRAO, ...deps };

  const cors = cabecalhosCors(request, env);
  const origem = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    if (origem && !cors["Access-Control-Allow-Origin"]) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors });
  }

  // Navegadores mandam Origin em requisições de outros sites; recusa as não listadas.
  if (origem && !cors["Access-Control-Allow-Origin"] && origensPermitidas(env).length) {
    return erro("Origem não permitida.", 403);
  }

  const url = new URL(request.url);
  const manipulador = ROTAS[`${request.method} ${url.pathname}`];

  let resposta;
  if (!manipulador) {
    const existe = Object.keys(ROTAS).some((r) => r.endsWith(" " + url.pathname));
    resposta = existe ? erro("Método não permitido.", 405) : erro("Não encontrado.", 404);
  } else {
    try {
      resposta = await manipulador(request, env, d);
    } catch (e) {
      console.error("erro interno:", e?.message);
      resposta = erro("Erro interno.", 500);
    }
  }

  const final = new Response(resposta.body, resposta);
  for (const [k, v] of Object.entries(cors)) final.headers.set(k, v);
  return final;
}

export default {
  fetch(request, env) {
    return tratar(request, env);
  },
};

import {
  hashSenha, verificarSenha, iteracoesDe, novoToken, sha256Hex, hmacSha256, toHex,
  novoCodigoDeRecuperacao, hashDoCodigo, iguaisEmTempoConstante, sortearIdPublico,
} from "./crypto.js";
import { json, erro, lerJson, tokenDaRequisicao } from "./http.js";
import { estaBloqueado, registrarOcorrencia, limpar } from "./limite.js";

const SESSAO_MS = 30 * 24 * 60 * 60 * 1000;
const SENHA_MIN = 10;
const SENHA_MAX_BYTES = 256;
const NOME_MAX = 30;

const LIMITES = {
  loginPorId: { max: 5, janelaMs: 15 * 60_000, bloqueioMs: 15 * 60_000 },
  loginPorIp: { max: 30, janelaMs: 15 * 60_000, bloqueioMs: 15 * 60_000 },
  recuperarPorId: { max: 5, janelaMs: 60 * 60_000, bloqueioMs: 60 * 60_000 },
  cadastroPorIp: { max: 5, janelaMs: 60 * 60_000, bloqueioMs: 60 * 60_000 },
};

const MSG_CREDENCIAIS = "ID ou senha inválidos.";
const MSG_RECUPERACAO = "ID ou código de recuperação inválidos.";

const iteracoes = (env) => Math.max(1000, Number(env.PBKDF2_ITERATIONS) || 100000);
const pimenta = (env) => {
  if (!env.PASSWORD_PEPPER || String(env.PASSWORD_PEPPER).length < 16) {
    throw new Error("PASSWORD_PEPPER ausente ou curta demais");
  }
  return String(env.PASSWORD_PEPPER);
};

/** O IP nunca é guardado em claro: só um hash dele com a pimenta. */
async function chaveDoIp(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "desconhecido";
  return toHex((await hmacSha256(pimenta(env), "ip:" + ip)).slice(0, 12));
}

function textoUtf8Bytes(s) {
  return new TextEncoder().encode(s).length;
}

function validarSenha(senha) {
  if (typeof senha !== "string") return "Informe a senha.";
  if ([...senha].length < SENHA_MIN) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  if (textoUtf8Bytes(senha) > SENHA_MAX_BYTES) return "A senha é longa demais.";
  return null;
}

const idValido = (id) => typeof id === "string" && /^\d{5}$/.test(id);

function respostaBloqueada(esperar) {
  return erro("Muitas tentativas. Aguarde e tente de novo.", 429, { "Retry-After": String(esperar) });
}

async function corpoOuErro(request) {
  const lido = await lerJson(request);
  if (!lido) return { resposta: erro("Corpo da requisição inválido.", 400) };
  if (lido.demais) return { resposta: erro("Requisição grande demais.", 413) };
  return { dado: lido.dado };
}

async function criarSessao(db, contaId, agora) {
  const { token, hash } = await novoToken();
  const expira = agora + SESSAO_MS;
  await db
    .prepare("INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(hash, contaId, agora, expira)
    .run();
  return { token, expira };
}

/** Quem é o dono do token? Devolve a conta ou null. */
export async function contaDaSessao(request, env, agora) {
  const token = tokenDaRequisicao(request);
  if (!token) return null;
  return env.DB
    .prepare(
      `SELECT a.id, a.public_id, a.display_name
         FROM sessions s JOIN accounts a ON a.id = s.account_id
        WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
    )
    .bind(await sha256Hex(token), agora)
    .first();
}

// ---------------------------------------------------------------- cadastro
export async function cadastrar(request, env, deps) {
  const agora = deps.agora();
  const db = env.DB;
  const chaveIp = "reg:ip:" + (await chaveDoIp(request, env));

  const bloqueio = await estaBloqueado(db, chaveIp, agora);
  if (bloqueio.bloqueado) return respostaBloqueada(bloqueio.esperar);

  const { dado, resposta } = await corpoOuErro(request);
  if (resposta) return resposta;

  const nome = typeof dado.nome === "string" ? dado.nome.trim() : "";
  if (!nome || [...nome].length > NOME_MAX) return erro(`Informe um nome de 1 a ${NOME_MAX} caracteres.`, 400);
  const problema = validarSenha(dado.senha);
  if (problema) return erro(problema, 400);

  await registrarOcorrencia(db, chaveIp, agora, LIMITES.cadastroPorIp);

  const segredo = pimenta(env);
  const contaId = deps.uuid();
  const senhaHash = await hashSenha(dado.senha, segredo, iteracoes(env));
  const codigo = novoCodigoDeRecuperacao();
  const codigoHash = await hashDoCodigo(codigo, segredo);

  let idPublico = null;
  for (let tentativa = 0; tentativa < 10 && !idPublico; tentativa++) {
    const candidato = deps.idPublico();
    try {
      await db
        .prepare(
          `INSERT INTO accounts (id, public_id, display_name, password_hash, recovery_hash, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
        )
        .bind(contaId, candidato, nome, senhaHash, codigoHash, agora)
        .run();
      idPublico = candidato;
    } catch (e) {
      if (!/UNIQUE/i.test(String(e?.message))) throw e; // só repete se o ID já existir
    }
  }
  if (!idPublico) return erro("Não foi possível gerar um ID agora. Tente novamente.", 503);

  const sessao = await criarSessao(db, contaId, agora);
  return json(
    {
      conta: { id_publico: idPublico, nome },
      token: sessao.token,
      expira_em: sessao.expira,
      // Aparece uma única vez. Sem e-mail, é a única forma de recuperar a conta.
      codigo_de_recuperacao: codigo,
    },
    201,
  );
}

// ------------------------------------------------------------------- login
export async function entrar(request, env, deps) {
  const agora = deps.agora();
  const db = env.DB;
  const segredo = pimenta(env);

  const { dado, resposta } = await corpoOuErro(request);
  if (resposta) return resposta;
  const id = dado.id;
  const senha = dado.senha;
  if (!idValido(id) || typeof senha !== "string" || textoUtf8Bytes(senha) > SENHA_MAX_BYTES) {
    return erro(MSG_CREDENCIAIS, 401);
  }

  const chaveId = "login:id:" + id;
  const chaveIp = "login:ip:" + (await chaveDoIp(request, env));

  // Verifica o bloqueio ANTES de gastar CPU com o hash.
  for (const chave of [chaveId, chaveIp]) {
    const b = await estaBloqueado(db, chave, agora);
    if (b.bloqueado) return respostaBloqueada(b.esperar);
  }

  const conta = await db
    .prepare("SELECT id, public_id, display_name, password_hash FROM accounts WHERE public_id = ?1")
    .bind(id)
    .first();

  // Conta inexistente também gasta o mesmo tempo: não dá para descobrir quais IDs existem.
  const guardado = conta?.password_hash ?? (await deps.hashFalso(env));
  const confere = await verificarSenha(senha, guardado, segredo);

  if (!conta || !confere) {
    await registrarOcorrencia(db, chaveId, agora, LIMITES.loginPorId);
    await registrarOcorrencia(db, chaveIp, agora, LIMITES.loginPorIp);
    return erro(MSG_CREDENCIAIS, 401);
  }

  await limpar(db, chaveId);

  // Hash antigo (menos iterações que o configurado hoje): atualiza agora que sabemos a senha.
  if (iteracoesDe(conta.password_hash) < iteracoes(env)) {
    const novo = await hashSenha(senha, segredo, iteracoes(env));
    await db.prepare("UPDATE accounts SET password_hash = ?1, updated_at = ?2 WHERE id = ?3").bind(novo, agora, conta.id).run();
  }

  await db.prepare("DELETE FROM sessions WHERE account_id = ?1 AND expires_at <= ?2").bind(conta.id, agora).run();
  const sessao = await criarSessao(db, conta.id, agora);
  return json({
    conta: { id_publico: conta.public_id, nome: conta.display_name },
    token: sessao.token,
    expira_em: sessao.expira,
  });
}

// ------------------------------------------------------------------ logout
export async function sair(request, env, deps) {
  const token = tokenDaRequisicao(request);
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(await sha256Hex(token)).run();
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------------- eu
export async function eu(request, env, deps) {
  const conta = await contaDaSessao(request, env, deps.agora());
  if (!conta) return erro("Sessão inválida ou expirada.", 401);
  return json({ conta: { id_publico: conta.public_id, nome: conta.display_name } });
}

// --------------------------------------------------------------- recuperar
export async function recuperar(request, env, deps) {
  const agora = deps.agora();
  const db = env.DB;
  const segredo = pimenta(env);

  const { dado, resposta } = await corpoOuErro(request);
  if (resposta) return resposta;
  const { id, codigo, nova_senha: novaSenha } = dado;
  if (!idValido(id) || typeof codigo !== "string") return erro(MSG_RECUPERACAO, 401);
  const problema = validarSenha(novaSenha);
  if (problema) return erro(problema, 400);

  const chaveId = "rec:id:" + id;
  const bloqueio = await estaBloqueado(db, chaveId, agora);
  if (bloqueio.bloqueado) return respostaBloqueada(bloqueio.esperar);

  const conta = await db
    .prepare("SELECT id, public_id, display_name, recovery_hash FROM accounts WHERE public_id = ?1")
    .bind(id)
    .first();

  const esperado = new TextEncoder().encode(conta?.recovery_hash ?? "0".repeat(64));
  const recebido = new TextEncoder().encode(await hashDoCodigo(codigo, segredo));
  const confere = iguaisEmTempoConstante(esperado, recebido);

  if (!conta || !confere) {
    await registrarOcorrencia(db, chaveId, agora, LIMITES.recuperarPorId);
    return erro(MSG_RECUPERACAO, 401);
  }

  await limpar(db, chaveId);

  const senhaHash = await hashSenha(novaSenha, segredo, iteracoes(env));
  const novoCodigo = novoCodigoDeRecuperacao(); // o código usado deixa de valer
  const novoCodigoHash = await hashDoCodigo(novoCodigo, segredo);

  await db.batch([
    db.prepare("UPDATE accounts SET password_hash = ?1, recovery_hash = ?2, updated_at = ?3 WHERE id = ?4")
      .bind(senhaHash, novoCodigoHash, agora, conta.id),
    db.prepare("DELETE FROM sessions WHERE account_id = ?1").bind(conta.id), // derruba todos os aparelhos
  ]);

  const sessao = await criarSessao(db, conta.id, agora);
  return json({
    conta: { id_publico: conta.public_id, nome: conta.display_name },
    token: sessao.token,
    expira_em: sessao.expira,
    codigo_de_recuperacao: novoCodigo,
  });
}

// Hash usado quando o ID não existe (calculado uma vez por instância do Worker).
let hashFalsoEmCache = null;
export async function hashFalso(env) {
  if (!hashFalsoEmCache) hashFalsoEmCache = await hashSenha("senha-falsa-para-igualar-o-tempo", pimenta(env), iteracoes(env), new Uint8Array(16));
  return hashFalsoEmCache;
}

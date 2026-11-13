import test from "node:test";
import assert from "node:assert/strict";
import { montar, ORIGEM } from "./ambiente.js";

const SENHA = "senha-bem-longa-1";

test("cadastro devolve ID de 5 dígitos, token e código de recuperação", async () => {
  const s = montar();
  const r = await s.cadastrar("Ana", SENHA);
  assert.equal(r.status, 201);
  assert.match(r.json.conta.id_publico, /^\d{5}$/);
  assert.equal(r.json.conta.nome, "Ana");
  assert.ok(r.json.token.length >= 40);
  assert.match(r.json.codigo_de_recuperacao, /^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/);
});

test("o banco não guarda senha, token nem código de recuperação em claro", async () => {
  const s = montar();
  const r = await s.cadastrar("Ana", SENHA);
  const tudo = JSON.stringify([
    ...s.db.sqlite.prepare("SELECT * FROM accounts").all(),
    ...s.db.sqlite.prepare("SELECT * FROM sessions").all(),
    ...s.db.sqlite.prepare("SELECT * FROM rate_limits").all(),
  ]);
  assert.ok(!tudo.includes(SENHA), "senha em claro no banco");
  assert.ok(!tudo.includes(r.json.token), "token em claro no banco");
  assert.ok(!tudo.includes(r.json.codigo_de_recuperacao.replaceAll("-", "")), "código em claro no banco");
  assert.ok(!tudo.includes("203.0.113.7"), "IP em claro no banco");
});

test("o ID gerado é único mesmo quando o sorteio repete", async () => {
  const sequencia = ["11111", "11111", "22222"];
  const s = montar({ deps: { idPublico: () => sequencia.shift() } });
  const a = await s.cadastrar("Ana", SENHA, { ip: "198.51.100.1" });
  const b = await s.cadastrar("Bia", SENHA, { ip: "198.51.100.2" });
  assert.equal(a.json.conta.id_publico, "11111");
  assert.equal(b.json.conta.id_publico, "22222");
});

test("validação do cadastro", async () => {
  const s = montar();
  const casos = [
    [{ nome: "", senha: SENHA }, /nome/i],
    [{ nome: "x".repeat(31), senha: SENHA }, /nome/i],
    [{ nome: "Ana", senha: "curta" }, /pelo menos 10/],
    [{ nome: "Ana", senha: "a".repeat(300) }, /longa demais/],
    [{ nome: "Ana" }, /senha/i],
    [{ senha: SENHA }, /nome/i],
  ];
  for (const [corpo, esperado] of casos) {
    const r = await s.req("POST", "/auth/cadastro", corpo, { ip: "198.51.100." + Math.floor(Math.random() * 250) });
    assert.equal(r.status, 400, JSON.stringify(corpo));
    assert.match(r.json.erro, esperado);
  }
  assert.equal(s.db.sqlite.prepare("SELECT count(*) n FROM accounts").get().n, 0);
});

test("corpo inválido ou grande demais é recusado", async () => {
  const s = montar();
  assert.equal((await s.req("POST", "/auth/cadastro", "isto não é json")).status, 400);
  assert.equal((await s.req("POST", "/auth/cadastro", "[1,2]")).status, 400);
  assert.equal((await s.req("POST", "/auth/cadastro", { nome: "Ana", senha: SENHA, lixo: "x".repeat(5000) })).status, 413);
});

test("login: entra com ID e senha corretos e /auth/eu mostra a conta", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const id = c.json.conta.id_publico;

  const r = await s.req("POST", "/auth/entrar", { id, senha: SENHA });
  assert.equal(r.status, 200);
  assert.equal(r.json.conta.nome, "Ana");

  const eu = await s.req("GET", "/auth/eu", undefined, { token: r.json.token });
  assert.equal(eu.status, 200);
  assert.equal(eu.json.conta.id_publico, id);
});

test("login: senha errada e ID inexistente dão a MESMA resposta (não revela quais IDs existem)", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const errada = await s.req("POST", "/auth/entrar", { id: c.json.conta.id_publico, senha: "senha-errada-123" });
  const inexistente = await s.req("POST", "/auth/entrar", { id: "00000", senha: "senha-errada-123" });
  assert.equal(errada.status, 401);
  assert.equal(inexistente.status, 401);
  assert.equal(errada.texto, inexistente.texto);
});

test("ID inexistente passa pelo mesmo trabalho de hash (o tempo não revela se o ID existe)", async () => {
  let chamadas = 0;
  const s = montar({ deps: { hashFalso: async (env) => { chamadas++; return (await import("../src/auth.js")).hashFalso(env); } } });
  const c = await s.cadastrar("Ana", SENHA);

  await s.req("POST", "/auth/entrar", { id: c.json.conta.id_publico, senha: "errada-errada-1" });
  assert.equal(chamadas, 0, "conta existente usa o hash dela");

  await s.req("POST", "/auth/entrar", { id: "00000", senha: "errada-errada-1" });
  assert.equal(chamadas, 1, "conta inexistente usa o hash falso");
});

test("/auth/eu sem token, com token falso ou expirado é 401", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  assert.equal((await s.req("GET", "/auth/eu")).status, 401);
  assert.equal((await s.req("GET", "/auth/eu", undefined, { token: "x".repeat(43) })).status, 401);

  s.relogio.agora += 31 * 24 * 60 * 60 * 1000; // 31 dias depois
  assert.equal((await s.req("GET", "/auth/eu", undefined, { token: c.json.token })).status, 401);
});

test("logout invalida o token", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  assert.equal((await s.req("POST", "/auth/sair", undefined, { token: c.json.token })).status, 200);
  assert.equal((await s.req("GET", "/auth/eu", undefined, { token: c.json.token })).status, 401);
});

test("vários aparelhos: cada login cria uma sessão e sair de um não derruba o outro", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const id = c.json.conta.id_publico;
  const a = await s.req("POST", "/auth/entrar", { id, senha: SENHA });
  const b = await s.req("POST", "/auth/entrar", { id, senha: SENHA });
  await s.req("POST", "/auth/sair", undefined, { token: a.json.token });
  assert.equal((await s.req("GET", "/auth/eu", undefined, { token: b.json.token })).status, 200);
});

test("as respostas nunca trazem hash, sal ou o id interno", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const l = await s.req("POST", "/auth/entrar", { id: c.json.conta.id_publico, senha: SENHA });
  for (const r of [c, l]) {
    assert.ok(!/pbkdf2|password|hash|recovery_hash|conta-1/.test(r.texto), r.texto);
  }
});

test("hash antigo (menos iterações) é atualizado no login seguinte", async () => {
  const s = montar({ extraEnv: { PBKDF2_ITERATIONS: "1000" } });
  const c = await s.cadastrar("Ana", SENHA);
  s.env.PBKDF2_ITERATIONS = "2000"; // o administrador aumentou o custo
  const r = await s.req("POST", "/auth/entrar", { id: c.json.conta.id_publico, senha: SENHA });
  assert.equal(r.status, 200);
  const guardado = s.db.sqlite.prepare("SELECT password_hash h FROM accounts").get().h;
  assert.match(guardado, /^pbkdf2_sha256_peppered\$2000\$/);
  // e a senha continua funcionando com o hash novo
  assert.equal((await s.req("POST", "/auth/entrar", { id: c.json.conta.id_publico, senha: SENHA })).status, 200);
});

test("sem a PASSWORD_PEPPER configurada o servidor recusa em vez de criar contas fracas", async () => {
  const s = montar({ extraEnv: { PASSWORD_PEPPER: "" } });
  const r = await s.cadastrar("Ana", SENHA);
  assert.equal(r.status, 500);
  assert.equal(s.db.sqlite.prepare("SELECT count(*) n FROM accounts").get().n, 0);
  assert.ok(!r.texto.includes("PEPPER"), "a mensagem de erro não deve expor detalhes internos");
});

// ------------------------------------------------------------- limite de tentativas
test("5 senhas erradas bloqueiam o ID, até com a senha certa", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const id = c.json.conta.id_publico;

  for (let i = 0; i < 5; i++) {
    const r = await s.req("POST", "/auth/entrar", { id, senha: "errada-errada-" + i }, { ip: `198.51.100.${i + 10}` });
    assert.equal(r.status, 401);
  }
  const bloqueada = await s.req("POST", "/auth/entrar", { id, senha: SENHA }, { ip: "198.51.100.99" });
  assert.equal(bloqueada.status, 429);
  assert.ok(Number(bloqueada.headers.get("Retry-After")) > 0);
});

test("o bloqueio termina sozinho depois do prazo", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const id = c.json.conta.id_publico;
  for (let i = 0; i < 5; i++) await s.req("POST", "/auth/entrar", { id, senha: "errada-errada-" + i });
  assert.equal((await s.req("POST", "/auth/entrar", { id, senha: SENHA })).status, 429);

  s.relogio.agora += 16 * 60_000;
  assert.equal((await s.req("POST", "/auth/entrar", { id, senha: SENHA })).status, 200);
});

test("acertar a senha zera a contagem de erros do ID", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const id = c.json.conta.id_publico;
  for (let i = 0; i < 4; i++) await s.req("POST", "/auth/entrar", { id, senha: "errada-errada-" + i });
  assert.equal((await s.req("POST", "/auth/entrar", { id, senha: SENHA })).status, 200);
  for (let i = 0; i < 4; i++) await s.req("POST", "/auth/entrar", { id, senha: "errada-errada-" + i });
  assert.equal((await s.req("POST", "/auth/entrar", { id, senha: SENHA })).status, 200, "recomeçou do zero");
});

test("o bloqueio também vale para IDs que não existem (ninguém testa IDs sem custo)", async () => {
  const s = montar();
  for (let i = 0; i < 5; i++) await s.req("POST", "/auth/entrar", { id: "00000", senha: "qualquer-coisa-" + i });
  assert.equal((await s.req("POST", "/auth/entrar", { id: "00000", senha: "qualquer-coisa-6" })).status, 429);
});

test("limite por IP: muitos erros do mesmo IP em IDs diferentes bloqueiam o IP", async () => {
  const s = montar();
  for (let i = 0; i < 30; i++) {
    await s.req("POST", "/auth/entrar", { id: String(10000 + i), senha: "qualquer-coisa-1" }, { ip: "192.0.2.50" });
  }
  const r = await s.req("POST", "/auth/entrar", { id: "99999", senha: "qualquer-coisa-1" }, { ip: "192.0.2.50" });
  assert.equal(r.status, 429);
  const outroIp = await s.req("POST", "/auth/entrar", { id: "99999", senha: "qualquer-coisa-1" }, { ip: "192.0.2.51" });
  assert.equal(outroIp.status, 401, "outro IP não é afetado");
});

test("cadastro: no máximo 5 por hora por IP", async () => {
  const s = montar();
  for (let i = 0; i < 5; i++) assert.equal((await s.cadastrar("Ana" + i, SENHA, { ip: "192.0.2.80" })).status, 201);
  assert.equal((await s.cadastrar("Ana6", SENHA, { ip: "192.0.2.80" })).status, 429);
  assert.equal((await s.cadastrar("Outra", SENHA, { ip: "192.0.2.81" })).status, 201);
});

test("senha errada não é verificada quando o ID já está bloqueado (poupa CPU)", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const id = c.json.conta.id_publico;
  for (let i = 0; i < 5; i++) await s.req("POST", "/auth/entrar", { id, senha: "errada-errada-" + i });
  const antes = s.db.sqlite.prepare("SELECT count FROM rate_limits WHERE key = ?").get("login:id:" + id).count;
  await s.req("POST", "/auth/entrar", { id, senha: "errada-de-novo-99" });
  const depois = s.db.sqlite.prepare("SELECT count FROM rate_limits WHERE key = ?").get("login:id:" + id).count;
  assert.equal(depois, antes, "tentativa bloqueada não escreve no banco");
});

// ---------------------------------------------------------------- recuperação
test("recuperação: o código define nova senha, derruba sessões e troca o código", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const id = c.json.conta.id_publico;
  const codigo = c.json.codigo_de_recuperacao;

  const r = await s.req("POST", "/auth/recuperar", {
    id, codigo: codigo.toLowerCase().replaceAll("-", " "), nova_senha: "outra-senha-forte-2",
  });
  assert.equal(r.status, 200);
  assert.notEqual(r.json.codigo_de_recuperacao, codigo, "o código usado deixa de valer");

  assert.equal((await s.req("GET", "/auth/eu", undefined, { token: c.json.token })).status, 401, "sessão antiga caiu");
  assert.equal((await s.req("POST", "/auth/entrar", { id, senha: SENHA })).status, 401, "senha antiga não vale");
  assert.equal((await s.req("POST", "/auth/entrar", { id, senha: "outra-senha-forte-2" })).status, 200);

  const reuso = await s.req("POST", "/auth/recuperar", { id, codigo, nova_senha: "mais-uma-senha-3" });
  assert.equal(reuso.status, 401, "o código antigo não funciona de novo");
});

test("recuperação: código errado e ID inexistente dão a mesma resposta", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const a = await s.req("POST", "/auth/recuperar", { id: c.json.conta.id_publico, codigo: "AAAA-AAAA-AAAA-AAAA-AAAA", nova_senha: "outra-senha-forte-2" });
  const b = await s.req("POST", "/auth/recuperar", { id: "00000", codigo: "AAAA-AAAA-AAAA-AAAA-AAAA", nova_senha: "outra-senha-forte-2" });
  assert.equal(a.status, 401);
  assert.equal(a.texto, b.texto);
});

test("recuperação: 5 códigos errados bloqueiam por 1 hora", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const id = c.json.conta.id_publico;
  for (let i = 0; i < 5; i++) await s.req("POST", "/auth/recuperar", { id, codigo: "AAAA-AAAA-AAAA-AAAA-AAA" + i, nova_senha: "outra-senha-forte-2" });
  const r = await s.req("POST", "/auth/recuperar", { id, codigo: c.json.codigo_de_recuperacao, nova_senha: "outra-senha-forte-2" });
  assert.equal(r.status, 429);
});

test("recuperação não aceita senha fraca nem derruba a conta por isso", async () => {
  const s = montar();
  const c = await s.cadastrar("Ana", SENHA);
  const r = await s.req("POST", "/auth/recuperar", { id: c.json.conta.id_publico, codigo: c.json.codigo_de_recuperacao, nova_senha: "curta" });
  assert.equal(r.status, 400);
  assert.equal((await s.req("POST", "/auth/entrar", { id: c.json.conta.id_publico, senha: SENHA })).status, 200, "senha antiga segue valendo");
});

// ----------------------------------------------------------------------- CORS
test("CORS: a origem permitida recebe os cabeçalhos; outras são recusadas", async () => {
  const s = montar();
  const ok = await s.req("GET", "/auth/eu");
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), ORIGEM);
  assert.equal(ok.headers.get("Vary"), "Origin");

  const intruso = await s.req("GET", "/auth/eu", undefined, { origem: "https://site-malicioso.example" });
  assert.equal(intruso.status, 403);
  assert.equal(intruso.headers.get("Access-Control-Allow-Origin"), null);
});

test("CORS: a requisição de verificação (OPTIONS) responde sem executar nada", async () => {
  const s = montar();
  const permitido = await s.req("OPTIONS", "/auth/entrar");
  assert.equal(permitido.status, 204);
  assert.match(permitido.headers.get("Access-Control-Allow-Headers"), /Authorization/);

  const negado = await s.req("OPTIONS", "/auth/entrar", undefined, { origem: "https://site-malicioso.example" });
  assert.equal(negado.status, 403);
});

test("rotas: 404 para caminho desconhecido e 405 para método errado", async () => {
  const s = montar();
  assert.equal((await s.req("GET", "/nada")).status, 404);
  assert.equal((await s.req("GET", "/auth/entrar")).status, 405);
  assert.equal((await s.req("POST", "/auth/eu")).status, 405);
});

test("as respostas não são guardadas em cache", async () => {
  const s = montar();
  const r = await s.cadastrar("Ana", SENHA);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
});

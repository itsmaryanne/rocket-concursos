import test from "node:test";
import assert from "node:assert/strict";
import {
  hashSenha, verificarSenha, iteracoesDe, novoCodigoDeRecuperacao, normalizarCodigo,
  sortearIdPublico, novoToken, iguaisEmTempoConstante,
} from "../src/crypto.js";

const PIMENTA = "pimenta-de-teste-com-mais-de-16-caracteres";

test("a senha confere e uma senha errada não", async () => {
  const h = await hashSenha("minha-senha-forte", PIMENTA, 1000);
  assert.equal(await verificarSenha("minha-senha-forte", h, PIMENTA), true);
  assert.equal(await verificarSenha("minha-senha-forte!", h, PIMENTA), false);
});

test("a pimenta faz parte do hash: outra pimenta não confere", async () => {
  const h = await hashSenha("minha-senha-forte", PIMENTA, 1000);
  assert.equal(await verificarSenha("minha-senha-forte", h, "outra-pimenta-bem-diferente"), false);
});

test("duas contas com a mesma senha têm hashes diferentes (sal aleatório)", async () => {
  const a = await hashSenha("igual-igual-igual", PIMENTA, 1000);
  const b = await hashSenha("igual-igual-igual", PIMENTA, 1000);
  assert.notEqual(a, b);
});

test("o hash guarda algoritmo e iterações, e não contém a senha", async () => {
  const h = await hashSenha("segredo-que-nao-pode-vazar", PIMENTA, 2345);
  assert.match(h, /^pbkdf2_sha256_peppered\$2345\$[\w-]+\$[\w-]+$/);
  assert.equal(iteracoesDe(h), 2345);
  assert.ok(!h.includes("segredo"));
});

test("registro corrompido ou de outro formato é recusado sem erro", async () => {
  assert.equal(await verificarSenha("x", "lixo", PIMENTA), false);
  assert.equal(await verificarSenha("x", "md5$1$a$b", PIMENTA), false);
  assert.equal(iteracoesDe("lixo"), 0);
});

test("código de recuperação: 20 símbolos em 5 grupos, sem caracteres ambíguos", () => {
  for (let i = 0; i < 200; i++) {
    const c = novoCodigoDeRecuperacao();
    assert.match(c, /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/);
  }
  assert.notEqual(novoCodigoDeRecuperacao(), novoCodigoDeRecuperacao());
});

test("o código aceita minúsculas, espaços e hífens ao digitar", () => {
  assert.equal(normalizarCodigo("abcd-efgh ijkl-mnpq-rstu"), "ABCDEFGHIJKLMNPQRSTU");
});

test("ID público tem sempre 5 dígitos e cobre a faixa inteira", () => {
  const vistos = new Set();
  for (let i = 0; i < 3000; i++) {
    const id = sortearIdPublico();
    assert.match(id, /^\d{5}$/);
    vistos.add(id[0]);
  }
  assert.equal(vistos.size, 10, "o primeiro dígito deveria variar de 0 a 9");
});

test("token de sessão: o hash não revela o token", async () => {
  const { token, hash } = await novoToken();
  assert.ok(token.length >= 40);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes(token));
});

test("comparação em tempo constante", () => {
  assert.equal(iguaisEmTempoConstante(new Uint8Array([1, 2]), new Uint8Array([1, 2])), true);
  assert.equal(iguaisEmTempoConstante(new Uint8Array([1, 2]), new Uint8Array([1, 3])), false);
  assert.equal(iguaisEmTempoConstante(new Uint8Array([1]), new Uint8Array([1, 2])), false);
});

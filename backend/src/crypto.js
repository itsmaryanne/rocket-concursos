// Funções de segurança usando só a Web Crypto API (funciona no Workers e no Node 20+).

const enc = new TextEncoder();

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toB64u(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(texto) {
  const b64 = texto.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (texto.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256(chave, dado) {
  const k = await crypto.subtle.importKey(
    "raw", enc.encode(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(dado)));
}

export async function sha256Hex(texto) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(texto))));
}

/** Comparação em tempo constante (não vaza onde os valores diferem). */
export function iguaisEmTempoConstante(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const ALGORITMO = "pbkdf2_sha256_peppered";

/**
 * Senha -> HMAC com a "pimenta" (segredo do servidor, fora do banco) -> PBKDF2 com sal aleatório.
 * Formato guardado: pbkdf2_sha256_peppered$ITERACOES$SAL$HASH
 */
export async function hashSenha(senha, pimenta, iteracoes, sal = randomBytes(16)) {
  const comPimenta = await hmacSha256(pimenta, senha);
  const chave = await crypto.subtle.importKey("raw", comPimenta, "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteracoes }, chave, 256),
  );
  return `${ALGORITMO}$${iteracoes}$${toB64u(sal)}$${toB64u(bits)}`;
}

export function iteracoesDe(guardado) {
  const partes = String(guardado).split("$");
  return partes[0] === ALGORITMO ? Number(partes[1]) || 0 : 0;
}

export async function verificarSenha(senha, guardado, pimenta) {
  const [alg, iter, sal, hash] = String(guardado).split("$");
  if (alg !== ALGORITMO || !iter || !sal || !hash) return false;
  const refeito = await hashSenha(senha, pimenta, Number(iter), fromB64u(sal));
  return iguaisEmTempoConstante(enc.encode(refeito), enc.encode(guardado));
}

/** Token de sessão: o cliente recebe `token`; o banco guarda só o hash dele. */
export async function novoToken() {
  const token = toB64u(randomBytes(32));
  return { token, hash: await sha256Hex(token) };
}

// 32 símbolos sem O, 0, I, 1: 5 bits cada, sorteio uniforme (256 é múltiplo de 32).
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Código de recuperação: 20 símbolos = 100 bits, no formato XXXX-XXXX-XXXX-XXXX-XXXX. */
export function novoCodigoDeRecuperacao() {
  const bytes = randomBytes(20);
  const simbolos = [...bytes].map((b) => ALFABETO[b & 31]);
  return [0, 4, 8, 12, 16].map((i) => simbolos.slice(i, i + 4).join("")).join("-");
}

export function normalizarCodigo(texto) {
  return String(texto ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function hashDoCodigo(codigo, pimenta) {
  return toHex(await hmacSha256(pimenta, "recuperacao:" + normalizarCodigo(codigo)));
}

/** Sorteia 5 dígitos sem viés. */
export function sortearIdPublico() {
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < 4_294_900_000) return String(buf[0] % 100000).padStart(5, "0");
  }
}

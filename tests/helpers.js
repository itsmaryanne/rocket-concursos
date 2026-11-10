import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const $ = (id) => document.getElementById(id);

// Janela real do jsdom. Os onclick="window.goToPage(...)" do app rodam nela,
// então o app.js precisa ser executado nela também (e não no global do Node).
const janela = () => globalThis.jsdom?.window ?? window;

/**
 * Carrega o index.html no jsdom e executa o app.js (IIFE) do zero.
 * Chame em beforeEach: cada teste começa com localStorage vazio.
 */
export function loadApp() {
  const win = janela();
  win.localStorage.clear();

  const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];
  win.document.body.innerHTML = body; // <script> inserido por innerHTML não executa

  // O jsdom não implementa estas APIs; o app usa todas.
  win.alert = vi.fn();
  win.confirm = vi.fn(() => true);
  win.scrollTo = vi.fn();
  win.Element.prototype.scrollIntoView = vi.fn();
  win.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    scale() {}, clearRect() {}, fillText() {}, beginPath() {},
    moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {},
  }));

  if (!win.crypto?.randomUUID) {
    Object.defineProperty(win, "crypto", {
      configurable: true,
      value: {
        randomUUID: () =>
          "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      },
    });
  }

  const code = readFileSync(resolve(process.cwd(), "app.js"), "utf8");
  win.eval(code);
}

export const alertas = () => janela().alert.mock.calls.map((c) => String(c[0]));

export const submitDe = (formId) =>
  document.querySelector(`#${formId} button[type="submit"]`);

/** Cria um perfil pela tela e devolve a ID de 5 números. */
export async function criarPerfil(user, nome = "Ana", senha = "senha1234") {
  await user.type($("regName"), nome);
  await user.type($("regPassword"), senha);
  await user.click(submitDe("registerForm"));
  const msg = alertas().filter((m) => /Sua ID/.test(m)).at(-1);
  return msg?.match(/\d{5}/)?.[0];
}

export async function sair(user) {
  await user.click($("menuLogout"));
}

export async function entrar(user, id, senha) {
  await user.type($("loginId"), id);
  await user.type($("loginPassword"), senha);
  await user.click(submitDe("loginForm"));
}

export function estadoSalvo() {
  return JSON.parse(localStorage.getItem("trilha_aprovacao_v3") || "null");
}

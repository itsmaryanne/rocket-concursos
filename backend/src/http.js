// Respostas JSON, CORS e leitura segura do corpo da requisição.

export const TAMANHO_MAXIMO_CORPO = 4096;

export function origensPermitidas(env) {
  return String(env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Cabeçalhos CORS só para origens da lista; para as outras, nenhum. */
export function cabecalhosCors(request, env) {
  const origem = request.headers.get("Origin");
  if (!origem || !origensPermitidas(env).includes(origem)) return {};
  return {
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(corpo, status = 200, extras = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extras,
    },
  });
}

export const erro = (mensagem, status, extras) => json({ erro: mensagem }, status, extras);

/** Lê o JSON do corpo com limite de tamanho. Devolve null se for inválido. */
export async function lerJson(request) {
  const declarado = Number(request.headers.get("Content-Length") ?? 0);
  if (declarado > TAMANHO_MAXIMO_CORPO) return { demais: true };
  const texto = await request.text();
  if (texto.length > TAMANHO_MAXIMO_CORPO) return { demais: true };
  try {
    const dado = JSON.parse(texto);
    return dado && typeof dado === "object" && !Array.isArray(dado) ? { dado } : null;
  } catch {
    return null;
  }
}

export function tokenDaRequisicao(request) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(request.headers.get("Authorization") ?? "");
  return m ? m[1] : null;
}

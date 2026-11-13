// Limite de tentativas guardado no D1 (uma linha por chave).
// Só escrevemos quando há falha: isso poupa a cota diária de gravações do plano gratuito.

export async function estaBloqueado(db, chave, agora) {
  const linha = await db
    .prepare("SELECT blocked_until FROM rate_limits WHERE key = ?1")
    .bind(chave)
    .first();
  if (linha && linha.blocked_until > agora) {
    return { bloqueado: true, esperar: Math.ceil((linha.blocked_until - agora) / 1000) };
  }
  return { bloqueado: false, esperar: 0 };
}

/**
 * Conta uma ocorrência. Ao chegar em `max` dentro da janela, bloqueia por `bloqueioMs`.
 * Fora da janela, recomeça a contagem.
 */
export async function registrarOcorrencia(db, chave, agora, { max, janelaMs, bloqueioMs }) {
  await db
    .prepare(
      `INSERT INTO rate_limits (key, count, window_start, blocked_until)
       VALUES (?1, 1, ?2, 0)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN ?2 - window_start > ?3 THEN 1 ELSE count + 1 END,
         blocked_until = CASE
           WHEN (CASE WHEN ?2 - window_start > ?3 THEN 1 ELSE count + 1 END) >= ?4
           THEN ?2 + ?5 ELSE 0 END,
         window_start = CASE WHEN ?2 - window_start > ?3 THEN ?2 ELSE window_start END`,
    )
    .bind(chave, agora, janelaMs, max, bloqueioMs)
    .run();
}

export async function limpar(db, chave) {
  await db.prepare("DELETE FROM rate_limits WHERE key = ?1").bind(chave).run();
}

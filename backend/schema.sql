-- =====================================================================
-- Rocket Concursos: banco do backend (Cloudflare D1 = SQLite)
-- Etapa 1: contas, sessões, limite de tentativas.
-- Também já cria as tabelas de estudo e amizades, prontas para sincronizar
-- (cada linha tem updated_at e deleted_at), mas ainda sem endpoints.
-- =====================================================================

-- ---------- Contas ----------
-- id         : identificador interno (UUID), nunca muda, nunca aparece para outros usuários
-- public_id  : os 5 dígitos usados para entrar e para achar amigos. NÃO é segredo.
CREATE TABLE accounts (
  id              TEXT PRIMARY KEY,
  public_id       TEXT NOT NULL UNIQUE
                  CHECK (length(public_id) = 5 AND public_id NOT GLOB '*[^0-9]*'),
  display_name    TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 30),
  password_hash   TEXT NOT NULL,
  recovery_hash   TEXT NOT NULL,
  goals_questions INTEGER NOT NULL DEFAULT 150 CHECK (goals_questions >= 1),
  goals_sessions  INTEGER NOT NULL DEFAULT 15  CHECK (goals_sessions  >= 1),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- ---------- Sessões ----------
-- Guardamos só o hash do token: quem ler o banco não consegue usar as sessões.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_account_idx ON sessions (account_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- ---------- Limite de tentativas ----------
-- key: "login:id:12345", "login:ip:<hash>", "rec:id:12345", "reg:ip:<hash>"
CREATE TABLE rate_limits (
  key           TEXT PRIMARY KEY,
  count         INTEGER NOT NULL,
  window_start  INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

-- ---------- Dados de estudo (prontos para sincronizar) ----------
-- A chave é (account_id, id): o id vem do navegador, e assim dois usuários
-- nunca colidem nem sobrescrevem dados um do outro.
-- deleted_at preenchido = "apagado" (o aparelho que ficou offline precisa saber).
CREATE TABLE records (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  id         TEXT NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
  date       TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  subject    TEXT NOT NULL DEFAULT '' CHECK (length(subject) <= 80),
  topic      TEXT NOT NULL DEFAULT '' CHECK (length(topic) <= 120),
  source     TEXT NOT NULL DEFAULT '' CHECK (length(source) <= 120),
  total      INTEGER NOT NULL CHECK (total >= 1),
  correct    INTEGER NOT NULL CHECK (correct >= 0),
  difficulty TEXT NOT NULL DEFAULT 'ok' CHECK (difficulty IN ('ok', 'medio', 'dificil')),
  error      TEXT NOT NULL DEFAULT '' CHECK (length(error) <= 80),
  notes      TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, id),
  CHECK (correct <= total)
);

CREATE TABLE reviews (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  id         TEXT NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
  date       TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  subject    TEXT NOT NULL DEFAULT '' CHECK (length(subject) <= 80),
  topic      TEXT NOT NULL DEFAULT '' CHECK (length(topic) <= 120),
  type       TEXT NOT NULL DEFAULT '' CHECK (length(type) <= 80),
  done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE mocks (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  id         TEXT NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
  date       TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  name       TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 120),
  total      INTEGER NOT NULL CHECK (total >= 1),
  correct    INTEGER NOT NULL CHECK (correct >= 0),
  minutes    INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  notes      TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, id),
  CHECK (correct <= total)
);

CREATE TABLE study_sessions (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  id         TEXT NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
  date       TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  minutes    INTEGER NOT NULL CHECK (minutes >= 1),
  notes      TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 120),
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, id)
);

-- Buscar "o que mudou desde X" é a consulta central da sincronização.
CREATE INDEX records_sync_idx        ON records        (account_id, updated_at);
CREATE INDEX reviews_sync_idx        ON reviews        (account_id, updated_at);
CREATE INDEX mocks_sync_idx          ON mocks          (account_id, updated_at);
CREATE INDEX study_sessions_sync_idx ON study_sessions (account_id, updated_at);

-- ---------- Amizades ----------
-- Todas as mudanças passam por endpoints do backend que validam cada ação
-- (pedir, aceitar, recusar, remover). Nada de atualizar colunas livremente.
CREATE TABLE friendships (
  requester_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

-- Impede o mesmo par nos dois sentidos (A->B e B->A).
CREATE UNIQUE INDEX friendships_par_unico
  ON friendships (min(requester_id, addressee_id), max(requester_id, addressee_id));
CREATE INDEX friendships_addressee_idx ON friendships (addressee_id);

import test from "node:test";
import assert from "node:assert/strict";
import { criarD1 } from "./d1-sqlite.js";

const conta = (db, id, publico) =>
  db.sqlite.prepare("INSERT INTO accounts (id, public_id, display_name, password_hash, recovery_hash, created_at, updated_at) VALUES (?, ?, 'Ana', 'h', 'r', 1, 1)").run(id, publico);

const recusa = (fn, trecho) => assert.throws(fn, (e) => new RegExp(trecho, "i").test(e.message));

test("ID público: só 5 dígitos e único", () => {
  const db = criarD1();
  conta(db, "a", "12345");
  recusa(() => conta(db, "b", "12345"), "UNIQUE");
  for (const ruim of ["1234", "123456", "12a45", "abcde", "12 45", ""]) recusa(() => conta(db, "c", ruim), "CHECK");
});

test("registros: total >= 1, acertos entre 0 e o total, data válida, dificuldade conhecida", () => {
  const db = criarD1();
  conta(db, "a", "11111");
  const ins = (extra = {}) => {
    const v = { id: "r1", date: "2026-11-03", total: 20, correct: 14, difficulty: "ok", ...extra };
    db.sqlite.prepare("INSERT INTO records (account_id, id, date, total, correct, difficulty, updated_at) VALUES ('a', ?, ?, ?, ?, ?, 1)").run(v.id, v.date, v.total, v.correct, v.difficulty);
  };
  ins();
  recusa(() => ins({ id: "r2", total: 0, correct: 0 }), "CHECK");
  recusa(() => ins({ id: "r3", total: 5, correct: 9 }), "CHECK");
  recusa(() => ins({ id: "r4", correct: -1 }), "CHECK");
  recusa(() => ins({ id: "r5", date: "03/11/2026" }), "CHECK");
  recusa(() => ins({ id: "r6", difficulty: "facil" }), "CHECK");
});

test("em TODAS as tabelas de estudo, o mesmo id vale em contas diferentes mas não duas vezes na mesma", () => {
  const db = criarD1();
  conta(db, "a", "11111");
  conta(db, "b", "22222");
  const inserts = {
    records: "INSERT INTO records (account_id, id, date, total, correct, updated_at) VALUES (?, 'mesmo-id', '2026-11-03', 10, 5, 1)",
    reviews: "INSERT INTO reviews (account_id, id, date, updated_at) VALUES (?, 'mesmo-id', '2026-11-03', 1)",
    mocks: "INSERT INTO mocks (account_id, id, date, total, correct, updated_at) VALUES (?, 'mesmo-id', '2026-11-03', 60, 30, 1)",
    study_sessions: "INSERT INTO study_sessions (account_id, id, date, minutes, updated_at) VALUES (?, 'mesmo-id', '2026-11-03', 50, 1)",
  };
  for (const [tabela, sql] of Object.entries(inserts)) {
    db.sqlite.prepare(sql).run("a");
    db.sqlite.prepare(sql).run("b"); // outra conta pode usar o mesmo id
    recusa(() => db.sqlite.prepare(sql).run("a"), "UNIQUE|PRIMARY"); // a mesma não
    assert.equal(db.sqlite.prepare(`SELECT count(*) n FROM ${tabela}`).get().n, 2, tabela);
  }
});

test("apagar a conta apaga sessões e dados (ON DELETE CASCADE)", () => {
  const db = criarD1();
  conta(db, "a", "11111");
  db.sqlite.prepare("INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES ('t', 'a', 1, 2)").run();
  db.sqlite.prepare("INSERT INTO study_sessions (account_id, id, date, minutes, updated_at) VALUES ('a', 's1', '2026-11-03', 50, 1)").run();
  db.sqlite.prepare("DELETE FROM accounts WHERE id = 'a'").run();
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM sessions").get().n, 0);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM study_sessions").get().n, 0);
});

test("dados não podem apontar para uma conta que não existe", () => {
  const db = criarD1();
  recusa(() => db.sqlite.prepare("INSERT INTO study_sessions (account_id, id, date, minutes, updated_at) VALUES ('fantasma', 's', '2026-11-03', 50, 1)").run(), "FOREIGN");
});

test("amizades: ninguém é amigo de si mesmo e o par não repete nos dois sentidos", () => {
  const db = criarD1();
  conta(db, "a", "11111");
  conta(db, "b", "22222");
  const pedir = (de, para) => db.sqlite.prepare("INSERT INTO friendships (requester_id, addressee_id, created_at, updated_at) VALUES (?, ?, 1, 1)").run(de, para);
  recusa(() => pedir("a", "a"), "CHECK");
  pedir("a", "b");
  recusa(() => pedir("a", "b"), "UNIQUE|PRIMARY");
  recusa(() => pedir("b", "a"), "UNIQUE");
});

test("o status da amizade só aceita 'pending' ou 'accepted'", () => {
  const db = criarD1();
  conta(db, "a", "11111");
  conta(db, "b", "22222");
  recusa(() => db.sqlite.prepare("INSERT INTO friendships (requester_id, addressee_id, status, created_at, updated_at) VALUES ('a', 'b', 'blocked', 1, 1)").run(), "CHECK");
});

test("o nome de exibição tem de 1 a 30 caracteres", () => {
  const db = criarD1();
  const ins = (nome) => db.sqlite.prepare("INSERT INTO accounts (id, public_id, display_name, password_hash, recovery_hash, created_at, updated_at) VALUES (?, ?, ?, 'h', 'r', 1, 1)").run("x" + nome.length, String(10000 + nome.length), nome);
  ins("a");
  ins("a".repeat(30));
  recusa(() => ins(""), "CHECK");
  recusa(() => ins("a".repeat(31)), "CHECK");
});

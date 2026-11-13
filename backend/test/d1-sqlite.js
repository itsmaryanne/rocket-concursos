// Imita a API do Cloudflare D1 usando o SQLite embutido do Node (node:sqlite),
// para testar o backend sem internet e sem conta na Cloudflare.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SCHEMA = fileURLToPath(new URL("../schema.sql", import.meta.url));

class Instrucao {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Instrucao(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() {
    const results = this.db.prepare(this.sql).all(...this.args);
    return { results, success: true, meta: {} };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
}

export function criarD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(readFileSync(SCHEMA, "utf8"));
  return {
    sqlite,
    prepare: (sql) => new Instrucao(sqlite, sql),
    async batch(instrucoes) {
      sqlite.exec("BEGIN");
      try {
        const saidas = [];
        for (const i of instrucoes) saidas.push(await i.run());
        sqlite.exec("COMMIT");
        return saidas;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

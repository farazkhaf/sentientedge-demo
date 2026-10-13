import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import type { SqlDatabase, SqlValue } from "./sql";

// Only the Node adapter opens a file. Workers uses the D1 binding instead.
export function openLocalDatabase(
  filename = process.env.SQLITE_PATH ||
    path.join(process.cwd(), ".data", "sentientedge.sqlite"),
): SqlDatabase {
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  return {
    async all<T>(sql: string, params: SqlValue[] = []) {
      return database.prepare(sql).all(...params) as T[];
    },
    async run(sql: string, params: SqlValue[] = []) {
      return Number(database.prepare(sql).run(...params).changes);
    },
  };
}

import "./env";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedSnapshot } from "./seed-fixtures";
import { buildSeedSql } from "./seed-sql";

const sql = buildSeedSql(seedSnapshot);
if (process.argv.includes("--sql")) {
  mkdirSync(".data", { recursive: true });
  // D1 wraps file imports itself and rejects explicit transaction statements.
  writeFileSync(
    ".data/seed.sql",
    sql.replace(/^BEGIN;\n/, "").replace(/\nCOMMIT;\n$/, "\n"),
  );
  console.log("Generated .data/seed.sql for D1.");
} else {
  const filename =
    process.env.SQLITE_PATH ||
    path.join(process.cwd(), ".data", "sentientedge.sqlite");
  mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(readFileSync("migrations/0001_initial.sql", "utf8"));
  db.exec(sql);
  db.close();
  console.log(
    "Seeded the local snapshot: 23 areas, 156 source records, 171 places.",
  );
}

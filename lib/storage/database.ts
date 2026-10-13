import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SqlDatabase, SqlValue } from "./sql";

let local: Promise<SqlDatabase> | undefined;
export async function getDatabase(): Promise<SqlDatabase> {
  // A deployed binding must never silently fall back to an ephemeral local file.
  if (process.env.DATA_DRIVER === "d1") {
    const { env } = await getCloudflareContext({ async: true });
    const binding = env.DB;
    if (!binding) throw new Error("D1 binding DB is required.");
    return {
      async all<T>(sql: string, params: SqlValue[] = []) {
        return (
          await binding
            .prepare(sql)
            .bind(...params)
            .all<T>()
        ).results;
      },
      async run(sql: string, params: SqlValue[] = []) {
        return (
          await binding
            .prepare(sql)
            .bind(...params)
            .run()
        ).meta.changes;
      },
    };
  }
  local ??= import("./local")
    .then(({ openLocalDatabase }) => openLocalDatabase())
    .catch((error) => {
      local = undefined;
      throw error;
    });
  return local;
}

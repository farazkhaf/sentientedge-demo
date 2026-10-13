import type { SqlDatabase } from "./sql";

export const AI_MAX_ROUNDS = 4;
export const AI_MAX_BODY_BYTES = 64000;
export const AI_MAX_OUTPUT_TOKENS = 1600;
// A conservative byte-sized input allowance, including room for token framing.
export const AI_RESERVATION_TOKENS =
  AI_MAX_ROUNDS * (AI_MAX_BODY_BYTES + AI_MAX_OUTPUT_TOKENS + 4000);
export const defaultLimits = {
  session: 5,
  ip: 8,
  daily: 50,
  concurrent: 2,
  dailyTokens: 1000000,
};
export type UsageLimits = typeof defaultLimits;

export async function reserveUsage(
  db: SqlDatabase,
  sessionKey: string,
  ipKey: string,
  now = Date.now(),
  limits: UsageLimits = defaultLimits,
) {
  const id = crypto.randomUUID();
  const dayStart = Math.floor(now / 86400000) * 86400000;
  // One conditional write is atomic on both SQLite and D1, including concurrent callers.
  const changes = await db.run(
    `INSERT INTO ai_reservations(id,session_key,ip_key,created_at,expires_at,tokens)
    SELECT ?,?,?,?,?,? WHERE
    (SELECT COUNT(*) FROM ai_reservations WHERE session_key=? AND created_at>?) < ? AND
    (SELECT COUNT(*) FROM ai_reservations WHERE ip_key=? AND created_at>?) < ? AND
    (SELECT COUNT(*) FROM ai_reservations WHERE created_at>=?) < ? AND
    (SELECT COALESCE(SUM(tokens),0) FROM ai_reservations WHERE created_at>=?) + ? <= ? AND
    (SELECT COUNT(*) FROM ai_reservations WHERE active=1 AND expires_at>?) < ?`,
    [
      id,
      sessionKey,
      ipKey,
      now,
      now + 75000,
      AI_RESERVATION_TOKENS,
      sessionKey,
      now - 600000,
      limits.session,
      ipKey,
      now - 600000,
      limits.ip,
      dayStart,
      limits.daily,
      dayStart,
      AI_RESERVATION_TOKENS,
      limits.dailyTokens,
      now,
      limits.concurrent,
    ],
  );
  if (!changes) return null;
  return id;
}
export async function settleUsage(
  db: SqlDatabase,
  id: string,
  tokens: number | null,
) {
  // Unknown usage retains the full reservation. Crashes and timeouts cannot refund capacity.
  await db.run("UPDATE ai_reservations SET active=0, tokens=? WHERE id=?", [
    tokens === null ? AI_RESERVATION_TOKENS : Math.max(0, Math.ceil(tokens)),
    id,
  ]);
}

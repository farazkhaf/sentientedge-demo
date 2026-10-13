import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readSnapshot } from "../lib/storage/repository";
import { createDataset } from "../lib/storage/dataset";
import {
  reserveUsage,
  settleUsage,
  defaultLimits,
  AI_RESERVATION_TOKENS,
} from "../lib/storage/quota";
import { anonymousSession } from "../lib/storage/session";
import { getAvailability } from "../lib/storage/availability";
import { seedSnapshot } from "../scripts/seed-fixtures";
import { buildSeedSql } from "../scripts/seed-sql";
import type { SqlDatabase, SqlValue } from "../lib/storage/sql";

function database(filename = ":memory:") {
  const db = new DatabaseSync(filename);
  db.exec(readFileSync("migrations/0001_initial.sql", "utf8"));
  const sql: SqlDatabase = {
    async all<T>(query: string, params: SqlValue[] = []) {
      return db.prepare(query).all(...params) as T[];
    },
    async run(query: string, params: SqlValue[] = []) {
      return Number(db.prepare(query).run(...params).changes);
    },
  };
  return { db, sql };
}

test("database round trip preserves every displayed profile, briefing and source record", async () => {
  const { db, sql } = database();
  try {
    db.exec(buildSeedSql(seedSnapshot));
    await sql.run("UPDATE settings SET value='offline' WHERE key='demo_state'");
    const reservation = await reserveUsage(
      sql,
      "preserved-session",
      "preserved-ip",
    );
    assert.ok(reservation);
    await settleUsage(sql, reservation, 100);
    db.exec(buildSeedSql(seedSnapshot));
    assert.equal((await getAvailability(sql)).state, "offline");
    assert.equal(
      (
        await sql.all<{ tokens: number }>("SELECT tokens FROM ai_reservations")
      )[0].tokens,
      100,
    );
    const actual = createDataset(await readSnapshot(sql));
    const expected = createDataset(seedSnapshot);
    for (const area of expected.dataService.getAllNeighborhoods()) {
      assert.deepEqual(
        actual.dataService.getAllDataForNeighborhood(area.id),
        expected.dataService.getAllDataForNeighborhood(area.id),
      );
      assert.deepEqual(
        actual.areaBriefing(area.id),
        expected.areaBriefing(area.id),
      );
    }
    assert.deepEqual(actual.briefings.city, expected.briefings.city);
    assert.deepEqual(actual.evidenceRecords, expected.evidenceRecords);
    assert.deepEqual(actual.hotspotData, expected.hotspotData);
    assert.equal(actual.permits.length, 23);
    assert.equal(
      actual.permits.find((p) => p.neighborhood_id === "flagami_/_grapeland")
        ?.permit_count_30d,
      expected.permits.find((p) => p.neighborhood_id === "flagami_/_grapeland")
        ?.permit_count_30d,
    );
    // An actual SQL edit, rather than a fixture import, must determine the displayed data.
    const record = actual.evidenceRecords[0];
    const changed = { ...record, text: "Database-backed test record" };
    await sql.run("UPDATE records SET text=?,payload=? WHERE id=?", [
      changed.text,
      JSON.stringify(changed),
      record.id,
    ]);
    assert.equal(
      createDataset(await readSnapshot(sql)).evidenceById.get(record.id)?.text,
      changed.text,
    );
  } finally {
    db.close();
  }
});

test("atomic quota reservations cap concurrent callers and retain uncertain usage", async () => {
  const { db, sql } = database();
  const now = Date.UTC(2026, 9, 13, 12);
  try {
    const ids = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        reserveUsage(sql, `session-${i}`, `ip-${i}`, now),
      ),
    );
    assert.equal(ids.filter(Boolean).length, 2);
    await settleUsage(sql, ids.find(Boolean)!, null);
    const charged = await sql.all<{ tokens: number }>(
      "SELECT tokens FROM ai_reservations WHERE active=0",
    );
    assert.equal(charged[0].tokens, AI_RESERVATION_TOKENS);
    // A global token allowance stops new sessions and addresses alike.
    assert.equal(
      await reserveUsage(sql, "new-session", "new-ip", now, {
        ...defaultLimits,
        dailyTokens: AI_RESERVATION_TOKENS * 2,
      }),
      null,
    );
  } finally {
    db.close();
  }
});

test("session, IP and daily limits survive reopening the database and reset by period", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sentientedge-"));
  const file = path.join(dir, "usage.sqlite");
  let current = database(file);
  const now = Date.UTC(2026, 9, 13, 12);
  const limits = { ...defaultLimits, session: 1, ip: 2, daily: 3 };
  try {
    const first = await reserveUsage(current.sql, "a", "ip", now, limits);
    assert.ok(first);
    await settleUsage(current.sql, first, 100);
    current.db.close();
    current = database(file);
    assert.equal(await reserveUsage(current.sql, "a", "ip", now, limits), null);
    const second = await reserveUsage(current.sql, "b", "ip", now, limits);
    assert.ok(second);
    await settleUsage(current.sql, second, 100);
    assert.equal(await reserveUsage(current.sql, "c", "ip", now, limits), null);
    const third = await reserveUsage(current.sql, "c", "other-ip", now, limits);
    assert.ok(third);
    await settleUsage(current.sql, third, 100);
    assert.equal(
      await reserveUsage(current.sql, "d", "third-ip", now + 600001, limits),
      null,
    );
    assert.ok(
      await reserveUsage(current.sql, "a", "ip", now + 86400000, limits),
    );
  } finally {
    current.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("anonymous cookies resist forgery and expire without storing raw identities", async () => {
  const secret = "a-test-secret-with-at-least-thirty-two-characters";
  const now = Date.UTC(2026, 9, 13, 12);
  const first = await anonymousSession(
    new Request("https://example.test/api/assistant"),
    secret,
    now,
  );
  assert.ok(first.cookie?.includes("HttpOnly; SameSite=Strict"));
  assert.ok(first.cookie?.endsWith("Secure"));
  const cookie = first.cookie!.split(";")[0];
  const valid = await anonymousSession(
    new Request("https://example.test/api/assistant", { headers: { cookie } }),
    secret,
    now + 100,
  );
  assert.equal(valid.cookie, null);
  assert.equal(valid.sessionKey, first.sessionKey);
  const forged = await anonymousSession(
    new Request("https://example.test/api/assistant", {
      headers: {
        cookie: cookie.slice(0, -1) + (cookie.endsWith("0") ? "1" : "0"),
      },
    }),
    secret,
    now + 100,
  );
  assert.notEqual(forged.sessionKey, first.sessionKey);
  const expired = await anonymousSession(
    new Request("https://example.test/api/assistant", { headers: { cookie } }),
    secret,
    now + 8 * 86400000,
  );
  assert.notEqual(expired.sessionKey, first.sessionKey);
});

test("owner pause and offline states are persistent and enforced independently of credentials", async () => {
  const { db, sql } = database();
  const previous = process.env.DEMO_STATE;
  const previousKey = process.env.OPENAI_API_KEY;
  const previousSecret = process.env.SESSION_SECRET;
  delete process.env.DEMO_STATE;
  try {
    assert.equal((await getAvailability(sql)).assistantAvailable, false);
    process.env.OPENAI_API_KEY = "test-key";
    process.env.SESSION_SECRET =
      "a-test-signing-secret-with-at-least-32-characters";
    await sql.run("UPDATE settings SET value='online' WHERE key='demo_state'");
    assert.equal((await getAvailability(sql)).assistantAvailable, true);
    process.env.SESSION_SECRET = "too-short";
    assert.equal((await getAvailability(sql)).assistantAvailable, false);
    await sql.run("UPDATE settings SET value='offline' WHERE key='demo_state'");
    assert.equal((await getAvailability(sql)).state, "offline");
    process.env.DEMO_STATE = "ai-paused";
    assert.equal((await getAvailability(sql)).state, "ai-paused");
    process.env.DEMO_STATE = "invalid";
    assert.equal((await getAvailability(sql)).state, "offline");
  } finally {
    if (previous === undefined) delete process.env.DEMO_STATE;
    else process.env.DEMO_STATE = previous;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
    db.close();
  }
});

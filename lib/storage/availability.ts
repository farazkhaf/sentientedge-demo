import type { SqlDatabase } from "./sql";
import type { DemoAvailability, DemoState } from "./snapshot";

export async function getAvailability(
  db: SqlDatabase,
): Promise<DemoAvailability> {
  const stored = await db.all<{ value: string }>(
    "SELECT value FROM settings WHERE key='demo_state'",
  );
  const configured = process.env.DEMO_STATE || stored[0]?.value || "ai-paused";
  const state: DemoState =
    configured === "online" || configured === "ai-paused"
      ? configured
      : "offline";
  const assistantAvailable =
    state === "online" &&
    !!process.env.OPENAI_API_KEY &&
    (process.env.SESSION_SECRET?.length ?? 0) >= 32;
  return {
    state,
    assistantAvailable,
    message:
      state === "offline"
        ? "The demo is currently turned off. Please check back later."
        : assistantAvailable
          ? ""
          : "The AI demo is currently paused. Briefings, evidence, and map exploration remain available.",
  };
}

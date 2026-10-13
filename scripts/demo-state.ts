import { openLocalDatabase } from "../lib/storage/local";
const state = process.argv[2];
if (!["online", "ai-paused", "offline"].includes(state))
  throw new Error("Choose online, ai-paused, or offline.");
void openLocalDatabase()
  .run(
    "INSERT INTO settings(key,value) VALUES('demo_state',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [state],
  )
  .then(() =>
    console.log(
      `Demo state: ${state}. A DEMO_STATE environment override takes precedence.`,
    ),
  );
import "./env";

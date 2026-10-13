import { existsSync } from "node:fs";

// Match local Next.js configuration without replacing explicit shell values.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

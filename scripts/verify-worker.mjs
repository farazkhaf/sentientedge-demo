import { readFile, writeFile, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(".open-next");
const envFile = path.join(root, "cloudflare", "next-env.mjs");
const compiled = await import(pathToFileURL(envFile).href);
const privateValues = new Set();
const lines = ["production", "development", "test"].map((mode) => {
  const values = compiled[mode];
  const publicValues = {};
  for (const [name, value] of Object.entries(values)) {
    if (name.startsWith("NEXT_PUBLIC_")) publicValues[name] = value;
    else if (
      /KEY|SECRET|TOKEN|PASSWORD/.test(name) &&
      typeof value === "string" &&
      value.length >= 16
    )
      privateValues.add(value);
  }
  return `export const ${mode} = ${JSON.stringify(publicValues)};`;
});
// OpenNext compiles local env files as fallbacks. Worker secrets must come from bindings.
await writeFile(envFile, lines.join("\n") + "\n");

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".data")
        throw new Error("Local database included in Worker output.");
      if (entry.name !== "node_modules") await inspect(filename);
    } else if (entry.name === ".env" || entry.name.startsWith(".env.")) {
      await rm(filename); // Known copied build artifact, always inside .open-next.
    } else if (/\.(mjs|js|json|html|map)$/.test(entry.name)) {
      const content = await readFile(filename, "utf8");
      if ([...privateValues].some((value) => content.includes(value))) {
        throw new Error(
          `Private credential found in Worker output: ${path.relative(root, filename)}`,
        );
      }
    }
  }
}
await inspect(root);
console.log("Worker output verified: runtime secrets only; no local database.");

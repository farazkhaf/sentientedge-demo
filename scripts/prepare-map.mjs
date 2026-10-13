import { copyFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await mkdir(new URL("public/maplibre/", root), { recursive: true });
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(
    new URL(`node_modules/maplibre-gl/dist/${name}`, root),
    new URL(`public/maplibre/${name}`, root),
  );
}
console.log("MapLibre worker prepared from the installed version.");

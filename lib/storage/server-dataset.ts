import { getDatabase } from "./database";
import { readSnapshot } from "./repository";
import { createDataset } from "./dataset";

let cached:
  | { expires: number; value: ReturnType<typeof createDataset> }
  | undefined;
let loading: Promise<ReturnType<typeof createDataset>> | undefined;
export async function getServerDataset() {
  if (cached && cached.expires > Date.now()) return cached.value;
  loading ??= getDatabase()
    .then(readSnapshot)
    .then(createDataset)
    .then((value) => {
      cached = { expires: Date.now() + 60000, value };
      return value;
    })
    .finally(() => {
      loading = undefined;
    });
  return loading;
}

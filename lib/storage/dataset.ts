import { DataService } from "@/lib/services/data-service";
import { createBriefingIndex } from "@/lib/intelligence/briefings";
import type { WorkspaceSnapshot } from "./snapshot";

export function createDataset(snapshot: WorkspaceSnapshot) {
  const dataService = new DataService(snapshot);
  return {
    snapshot,
    dataService,
    ...createBriefingIndex(snapshot.briefings, dataService),
    permits: snapshot.permits,
    hotspotData: { features: snapshot.places },
  };
}
export type Dataset = ReturnType<typeof createDataset>;

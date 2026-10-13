import type { SqlDatabase } from "./sql";
import type {
  WorkspaceSnapshot,
  PreparedBriefings,
  EvidenceRecord,
} from "./snapshot";
import type { NewsEventData, SocialSentimentData } from "@/lib/types/data";

export async function readSnapshot(
  db: SqlDatabase,
): Promise<WorkspaceSnapshot> {
  const [metadata, profiles, records, sections, permits, places] =
    await Promise.all([
      db.all<{ id: string; label: string; version: number }>(
        "SELECT * FROM snapshot_metadata",
      ),
      db.all<{ dimension: string; payload: string }>(
        "SELECT dimension,payload FROM profiles ORDER BY area_id",
      ),
      db.all<{ payload: string }>(
        "SELECT payload FROM records ORDER BY position",
      ),
      db.all<{
        area_id: string;
        kind: string;
        headline: string;
        summary: string;
        themes: string;
      }>("SELECT * FROM briefings"),
      db.all<{ payload: string }>(
        "SELECT payload FROM permits ORDER BY area_id",
      ),
      db.all<{ payload: string }>(
        "SELECT payload FROM places ORDER BY position",
      ),
    ]);
  if (metadata.length !== 1 || metadata[0].version !== 1)
    throw new Error("Initialize the snapshot database with npm run db:seed.");
  const profile = (dimension: string) =>
    profiles
      .filter((p) => p.dimension === dimension)
      .map((p) => JSON.parse(p.payload));
  const evidence: EvidenceRecord[] = records.map((r) => JSON.parse(r.payload));
  const news: NewsEventData[] = profile("news");
  for (const entry of news)
    entry.events = evidence
      .filter((r) => r.areaId === entry.neighborhood_id && r.kind === "news")
      .map((r) => ({
        id: r.id.slice(5),
        summary: r.text,
        timestamp: r.date,
        category: r.category as NewsEventData["events"][number]["category"],
        significance_score: r.significance ?? 0,
        sources: r.sources,
      }));
  const social: SocialSentimentData[] = profile("social");
  for (const entry of social)
    entry.posts = evidence
      .filter((r) => r.areaId === entry.neighborhood_id && r.kind === "social")
      .map((r) => ({
        id: r.id.slice(7),
        text: r.text,
        timestamp: r.date,
        sentiment: r.tone as "positive" | "neutral" | "negative",
        source: r.sources[0]?.name ?? "",
        url: r.sources[0]?.url ?? "",
      }));
  const areas = new Map<string, Record<string, unknown>>();
  for (const section of sections) {
    const area = areas.get(section.area_id) ?? { id: section.area_id };
    area[section.kind] = {
      headline: section.headline,
      summary: section.summary,
      themes: JSON.parse(section.themes),
    };
    areas.set(section.area_id, area);
  }
  const briefings = {
    id: metadata[0].id,
    label: metadata[0].label,
    city: {
      combined: areas.get("miami")!.combined,
      news: areas.get("miami")!.news,
      social: areas.get("miami")!.social,
    },
    areas: [...areas.entries()]
      .filter(([id]) => id !== "miami")
      .map(([, a]) => a),
  } as PreparedBriefings;
  return {
    version: 1,
    demographics: profile("demographics"),
    crime: profile("crime"),
    amenities: profile("amenities"),
    social,
    news,
    permits: permits.map((p) => JSON.parse(p.payload)),
    places: places.map((p) => JSON.parse(p.payload)),
    briefings,
  };
}

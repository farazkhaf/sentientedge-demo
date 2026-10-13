import type { DataService } from "@/lib/services/data-service";
import type { PreparedBriefings } from "@/lib/storage/snapshot";
import type { LayerType } from "@/lib/types/data";

export type BriefingKind = "combined" | "news" | "social";
export type BriefingTheme = {
  title: string;
  summary: string;
  recordIds: string[];
};
export type BriefingSection = {
  headline: string;
  summary: string;
  themes: BriefingTheme[];
};
export type AreaBriefing = { id: string } & Record<
  BriefingKind,
  BriefingSection
>;
export const dimensions: {
  id: LayerType;
  label: string;
  short: string;
  meaning: string;
  color: string;
}[] = [
  {
    id: "demographics",
    label: "Demographics",
    short: "Population & income",
    meaning: "Demographic profile index",
    color: "#897b9e",
  },
  {
    id: "crime",
    label: "Safety",
    short: "Incident context",
    meaning: "Safety profile index",
    color: "#b67570",
  },
  {
    id: "amenities",
    label: "Amenities",
    short: "Access & walkability",
    meaning: "Amenity access index",
    color: "#628f80",
  },
  {
    id: "social",
    label: "Community",
    short: "Reported perspectives",
    meaning: "Community tone index",
    color: "#b99253",
  },
  {
    id: "news",
    label: "News & events",
    short: "Reported developments",
    meaning: "News activity index",
    color: "#628aa4",
  },
];
export const signed = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
export const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
export const currency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
export type EvidenceRecord = {
  id: string;
  areaId: string;
  areaName: string;
  kind: "news" | "social";
  text: string;
  date: string;
  category: string;
  tone?: string;
  significance?: number;
  sources: { name: string; url: string }[];
};
export function distribution(
  records: EvidenceRecord[],
  field: "category" | "tone",
) {
  const counts = new Map<string, number>();
  records.forEach((r) => {
    const key = r[field];
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts, ([label, value]) => ({ label, value })).sort(
    (a, b) => b.value - a.value,
  );
}
export function sourceCount(records: EvidenceRecord[]) {
  return new Set(
    records.flatMap((r) =>
      r.sources.map((s) => {
        try {
          return new URL(s.url).hostname.replace(/^www\./, "");
        } catch {
          return s.name.trim().toLowerCase();
        }
      }),
    ),
  ).size;
}
export function monthlyActivity(records: EvidenceRecord[]) {
  const counts = new Map<string, number>();
  records.forEach((r) => {
    const month = r.date.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  });
  return Array.from(counts, ([month, count]) => ({ month, count })).sort(
    (a, b) => a.month.localeCompare(b.month),
  );
}

export function createBriefingIndex(
  briefings: PreparedBriefings,
  dataService: DataService,
) {
  function areaBriefing(id: string) {
    return briefings.areas.find((area) => area.id === id);
  }
  const evidenceRecords: EvidenceRecord[] = dataService
    .getAllNeighborhoods()
    .flatMap((a) => {
      const data = dataService.getAllDataForNeighborhood(a.id)!;
      return [
        ...(data.news?.events ?? []).map((e) => ({
          id: `news:${e.id}`,
          areaId: a.id,
          areaName: a.name,
          kind: "news" as const,
          text: e.summary,
          date: e.timestamp,
          category: e.category,
          significance: e.significance_score,
          sources: e.sources,
        })),
        ...(data.social?.posts ?? []).map((p) => ({
          id: `social:${p.id}`,
          areaId: a.id,
          areaName: a.name,
          kind: "social" as const,
          text: p.text,
          date: p.timestamp,
          category: "Community",
          tone: p.sentiment,
          sources: [{ name: p.source, url: p.url }],
        })),
      ];
    });
  function recordsFor(areaId: string | null, kind: BriefingKind = "combined") {
    return evidenceRecords.filter(
      (r) =>
        (!areaId || r.areaId === areaId) &&
        (kind === "combined" || r.kind === kind),
    );
  }

  const evidenceById = new Map(evidenceRecords.map((r) => [r.id, r]));
  return { briefings, areaBriefing, evidenceRecords, evidenceById, recordsFor };
}

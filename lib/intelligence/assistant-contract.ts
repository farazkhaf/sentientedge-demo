import type { BriefingSection, EvidenceRecord } from "./briefings";
import type { LayerType } from "@/lib/types/data";

export type InvestigationAction = {
  view: "explore" | "intelligence" | "compare";
  areaIds: string[];
  layer: "profile" | "permits";
  dimensions: LayerType[];
};
export type Profile = {
  id: string;
  name: string;
  headline: string;
  weightedProfile?: { value: number | null; dimensions: number };
  dimensions: { id: LayerType; label: string; value: number | null }[];
  metrics: {
    income: number | null;
    density: number | null;
    walkability: number | null;
    permits: number | null;
    news: number;
    community: number;
  };
};
export type InvestigationArtifact =
  | {
      type: "briefing";
      areaId: string | null;
      areaName: string;
      kind: "combined" | "news" | "social";
      section: BriefingSection;
    }
  | { type: "comparison"; profiles: Profile[] }
  | {
      type: "chart";
      title: string;
      unit: string;
      period: string;
      points: { label: string; value: number }[];
      missing: string[];
    }
  | {
      type: "trend";
      title: string;
      unit: string;
      series: { name: string; points: { date: string; score: number }[] }[];
      missing: string[];
    }
  | {
      type: "timeline";
      title: string;
      records: EvidenceRecord[];
      total: number;
    }
  | { type: "map"; action: InvestigationAction; areaNames: string[] };
export type InvestigationResponse = {
  text: string;
  artifacts: InvestigationArtifact[];
  evidence: EvidenceRecord[];
};
export type InvestigationMessage = InvestigationResponse & {
  id: string;
  role: "user" | "assistant";
};

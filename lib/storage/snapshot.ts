import type {
  AmenitiesData,
  CrimeData,
  DemographicsData,
  HotspotFeature,
  NewsEventData,
  SocialSentimentData,
} from "@/lib/types/data";
import type {
  AreaBriefing,
  BriefingKind,
  BriefingSection,
  EvidenceRecord,
} from "@/lib/intelligence/briefings";

export type PreparedBriefings = {
  id: string;
  label: string;
  areas: AreaBriefing[];
  city: Record<BriefingKind, BriefingSection>;
};
export type PermitRecord = {
  neighborhood_id: string;
  permit_count_30d: number;
  total_value_30d: number;
  residential_ratio: number;
  avg_project_size: number;
  last_updated: string;
};
export type WorkspaceSnapshot = {
  version: 1;
  demographics: DemographicsData[];
  crime: CrimeData[];
  amenities: AmenitiesData[];
  social: SocialSentimentData[];
  news: NewsEventData[];
  permits: PermitRecord[];
  places: HotspotFeature[];
  briefings: PreparedBriefings;
};
export type DemoState = "online" | "ai-paused" | "offline";
export type DemoAvailability = {
  state: DemoState;
  assistantAvailable: boolean;
  message: string;
};
export type { EvidenceRecord };

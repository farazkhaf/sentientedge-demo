// Fixture normalization runs only during database seeding, never in the application bundle.
import { demographicsData } from "../lib/data/demographics";
import { crimeData } from "../lib/data/crime";
import { amenitiesData } from "../lib/data/amenities";
import { socialSentimentData } from "../lib/data/social";
import { newsEventsData } from "../lib/data/news";
import permits from "../lib/data/permits_latest.json";
import places from "../lib/data/hotspots.json";
import briefings from "../lib/data/briefings.json";
import type { WorkspaceSnapshot } from "../lib/storage/snapshot";

export const seedSnapshot = {
  version: 1,
  demographics: demographicsData,
  crime: crimeData,
  amenities: amenitiesData,
  social: socialSentimentData,
  news: newsEventsData,
  permits: permits.map((permit) => ({
    ...permit,
    neighborhood_id:
      (
        {
          "flagami/grapeland": "flagami_/_grapeland",
          "health_district/_civic_center": "health_district_/_civic_center",
        } as Record<string, string>
      )[permit.neighborhood_id] ?? permit.neighborhood_id,
  })),
  places: places.features,
  briefings,
} as unknown as WorkspaceSnapshot;

// lib/types/data.ts

// ─── Layer types ──────────────────────────────────────────────────────────────

export type LayerType = 'demographics' | 'crime' | 'amenities' | 'social' | 'news';

// ─── Trend system ─────────────────────────────────────────────────────────────

export type TrendCadence = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type TrendWindow = '7d' | '30d' | '90d';

/**
 * Pre-computed trend object.
 * Python computes all fields before writing to DB.
 * Frontend never re-derives — just reads and renders.
 */
export interface TrendData {
  cadence: TrendCadence;
  window: TrendWindow;
  points: Array<{
    date: string;   // ISO 8601 date only e.g. "2026-01-15"
    score: number;  // -1.0 to +1.0, same scale as base score
  }>;
  delta: number;              // points[last].score - points[first].score
  delta_pct: number | null;   // % change; null when base score is near zero (< 0.05)
  direction: 'up' | 'down' | 'stable'; // |delta| < 0.03 = stable
}

/**
 * Static config — what trend windows each category supports.
 * Never stored in DB. Used by frontend to know what to request / display.
 *
 * Fast-changing  (crime, social, news)      → 7d and 30d valid
 * Slow-changing  (demographics, amenities)  → 90d only meaningful
 */
export const TREND_CONFIG: Record<
  LayerType,
  {
    supported_windows: TrendWindow[];
    cadence: TrendCadence;
    label: string;           // shown in UI
    default_window: TrendWindow;
  }
> = {
  crime: {
    supported_windows: ['7d', '30d'],
    cadence: 'weekly',
    label: 'past week / past month',
    default_window: '7d',
  },
  social: {
    supported_windows: ['7d', '30d'],
    cadence: 'daily',
    label: 'past week / past month',
    default_window: '7d',
  },
  news: {
    supported_windows: ['7d', '30d'],
    cadence: 'weekly',
    label: 'past week / past month',
    default_window: '7d',
  },
  demographics: {
    supported_windows: ['90d'],
    cadence: 'quarterly',
    label: 'past quarter',
    default_window: '90d',
  },
  amenities: {
    supported_windows: ['90d'],
    cadence: 'quarterly',
    label: 'past quarter',
    default_window: '90d',
  },
};

// ─── Geography ────────────────────────────────────────────────────────────────

export interface NeighborhoodBoundary {
  id: string;
  name: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    centroid: [number, number];
  };
}

export interface NeighborhoodFeature {
  type: 'Feature';
  properties: {
    id: string;
    name: string;
    centroid?: [number, number];
  };
  id: number;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface NeighborhoodGeoJSON {
  type: 'FeatureCollection';
  features: NeighborhoodFeature[];
}

// ─── Base interfaces ──────────────────────────────────────────────────────────

export interface DataQualityMetrics {
  data_quality: number;   // 0.0–1.0
  last_updated: string;   // ISO 8601 timestamp of this snapshot
  source_count?: number;
  completeness?: number;
}

/**
 * Base for all scored data types.
 * `trend` is optional — omitted in basic fetches, populated on demand
 * via GET /api/neighborhoods/:id/:category/trend?window=7d
 */
export interface ScoredData extends DataQualityMetrics {
  neighborhood_id: string;
  score: number;          // current score, -1.0 to +1.0
  trend?: TrendData;      // lazy-loaded, absent until user requests chart
  raw_data?: Record<string, unknown>;
}

// ─── Category interfaces ──────────────────────────────────────────────────────

export interface DemographicsData extends ScoredData {
  demographic_desirability_score: number;
  metrics: {
    population_density: number;
    median_income: number;
    age_distribution: Record<string, number>;
    education: Record<string, number>;
    homeownership: number;
  };
  // trend (from ScoredData): supported_windows ['90d'] only
}

export interface CrimeData extends ScoredData {
  crime_risk_score: number;
  crime_types: {
    violent: number;
    property: number;
    quality_of_life: number;
  };
  /**
   * Qualitative directional signal for the current period.
   * Named trend_direction (not trend) to avoid collision with
   * ScoredData.trend which is the quantitative TrendData object.
   */
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  hotspots: Array<{
    lat: number;
    lng: number;
    radius: number;
    intensity?: number;
  }>;
  // trend (from ScoredData): supported_windows ['7d', '30d']
}

export interface AmenitiesData extends ScoredData {
  amenity_access_score: number;
  categories: {
    schools: number;
    parks: number;
    transit: number;
    healthcare: number;
    retail: number;
  };
  walkability_score: number;
  // trend (from ScoredData): supported_windows ['90d'] only
}

export interface SocialPost {
  id: string;
  source: string;
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  url: string;
  timestamp: string;  // ISO 8601
}

export interface SocialSentimentData extends ScoredData {
  sentiment_score: number;
  post_count: number;
  post_count_delta?: number;     // e.g. +42 posts vs same window prior period
  sentiment_distribution?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  posts: SocialPost[];
  // trend (from ScoredData): supported_windows ['7d', '30d']
}

export interface NewsEvent {
  id: string;
  category:
    | 'Infrastructure'
    | 'Economic'
    | 'Government Policy'
    | 'Environmental'
    | 'Construction'
    | 'Demographic';
  summary: string;
  sources: Array<{ name: string; url: string }>;
  timestamp: string;  // ISO 8601
  significance_score?: number;  // 0.0–1.0
}

export interface NewsEventData extends ScoredData {
  event_density_score: number;
  event_count_delta?: number;    // e.g. +3 events vs same window prior period
  events: NewsEvent[];
  // trend (from ScoredData): supported_windows ['7d', '30d']
}

// ─── Composite score ──────────────────────────────────────────────────────────

export interface CompositeScoreResult {
  composite_score: number;   // -1.0 to +1.0
  confidence: number;        // 0.0–1.0
  breakdown: Array<{
    category: string;
    raw_score: number;
    weighted_score: number;
    weight: number;
    data_quality: number;
  }>;
  calculation_method: 'weighted_average' | 'user_defined';
}

// ─── User / auth ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'planner' | 'investor' | 'guest';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  preferences?: {
    defaultLayers: LayerType[];
    layerWeights: Record<LayerType, number>;
    theme: 'light' | 'dark';
  };
}

// ─── Map / UI state ───────────────────────────────────────────────────────────

export interface MapState {
  activeLayers: LayerType[];
  layerWeights: Record<LayerType, number>;
  selectedNeighborhood: string | null;
  viewport: {
    center: [number, number];
    zoom: number;
  };
}

export interface WatchlistItem {
  neighborhoodId: string;
  customName?: string;
  alertThresholds?: Record<string, number>;
  addedAt: string;
}

// ─── Aggregated neighborhood view ────────────────────────────────────────────

export interface NeighborhoodAllData {
  id: string;
  name: string;
  demographics?: DemographicsData;
  crime?: CrimeData;
  amenities?: AmenitiesData;
  social?: SocialSentimentData;
  news?: NewsEventData;
  compositeScore?: CompositeScoreResult;
}


export type HotspotProperties = {
  id: string;
  anchor_origin: string;
  intensity: number;
  radius_m: number;
  amenity_count: number;
  categories: {
    schools: number;
    parks: number;
    transit: number;
    healthcare: number;
    retail: number;
  };
  dominant: string[];
  sample_names: string[];
};

export type HotspotFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: HotspotProperties;
};

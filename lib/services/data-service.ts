import {
  neighborhoodsGeoJSON,
  getAllNeighborhoods,
} from "@/lib/data/neighborhoods";
import type { WorkspaceSnapshot } from "@/lib/storage/snapshot";
import type {
  NeighborhoodGeoJSON,
  DemographicsData,
  CrimeData,
  AmenitiesData,
  SocialSentimentData,
  NewsEventData,
  LayerType,
  CompositeScoreResult,
  NeighborhoodAllData,
  TrendData,
  TrendWindow,
} from "@/lib/types/data";
import { TREND_CONFIG } from "@/lib/types/data";

export class DataService {
  constructor(private snapshot: WorkspaceSnapshot) {}
  getNeighborhoodBoundaries(): NeighborhoodGeoJSON {
    return neighborhoodsGeoJSON;
  }

  getAllNeighborhoods() {
    return getAllNeighborhoods();
  }

  getNeighborhoodData(
    neighborhoodId: string,
    category: LayerType,
  ):
    | DemographicsData
    | CrimeData
    | AmenitiesData
    | SocialSentimentData
    | NewsEventData
    | null {
    switch (category) {
      case "demographics":
        return (
          this.snapshot.demographics.find(
            (entry) => entry.neighborhood_id === neighborhoodId,
          ) ?? null
        );
      case "crime":
        return (
          this.snapshot.crime.find(
            (entry) => entry.neighborhood_id === neighborhoodId,
          ) ?? null
        );
      case "amenities":
        return (
          this.snapshot.amenities.find(
            (entry) => entry.neighborhood_id === neighborhoodId,
          ) ?? null
        );
      case "social":
        return (
          this.snapshot.social.find(
            (entry) => entry.neighborhood_id === neighborhoodId,
          ) ?? null
        );
      case "news":
        return (
          this.snapshot.news.find(
            (entry) => entry.neighborhood_id === neighborhoodId,
          ) ?? null
        );
      default:
        return null;
    }
  }

  getAllDataForNeighborhood(
    neighborhoodId: string,
  ): NeighborhoodAllData | null {
    const neighborhood = neighborhoodsGeoJSON.features.find(
      (f) => f.properties.id === neighborhoodId,
    );
    if (!neighborhood) return null;

    return {
      id: neighborhoodId,
      name: neighborhood.properties.name,
      demographics: this.snapshot.demographics.find(
        (entry) => entry.neighborhood_id === neighborhoodId,
      ),
      crime: this.snapshot.crime.find(
        (entry) => entry.neighborhood_id === neighborhoodId,
      ),
      amenities: this.snapshot.amenities.find(
        (entry) => entry.neighborhood_id === neighborhoodId,
      ),
      social: this.snapshot.social.find(
        (entry) => entry.neighborhood_id === neighborhoodId,
      ),
      news: this.snapshot.news.find(
        (entry) => entry.neighborhood_id === neighborhoodId,
      ),
    };
  }

  calculateCompositeScore(
    neighborhoodId: string,
    activeLayers: LayerType[],
    weights: Record<LayerType, number>,
  ): CompositeScoreResult {
    const breakdown: CompositeScoreResult["breakdown"] = [];
    let totalWeightedScore = 0;
    let totalEffectiveWeight = 0;
    let totalDataQuality = 0;

    for (const layer of activeLayers) {
      const data = this.getNeighborhoodData(neighborhoodId, layer);
      if (!data) continue;

      const weight = weights[layer] ?? 1;
      if (weight <= 0) continue;
      const effectiveWeight = weight * data.data_quality;
      const score = this.getDimensionScore(neighborhoodId, layer)!;
      const weightedScore = score * effectiveWeight;

      breakdown.push({
        category: layer,
        raw_score: score,
        weighted_score: weightedScore,
        weight,
        data_quality: data.data_quality,
      });

      totalWeightedScore += weightedScore;
      totalEffectiveWeight += effectiveWeight;
      totalDataQuality += data.data_quality;
    }

    const compositeScore =
      totalEffectiveWeight > 0 ? totalWeightedScore / totalEffectiveWeight : 0;
    const confidence =
      breakdown.length > 0 ? totalDataQuality / breakdown.length : 0;

    return {
      composite_score: Math.max(-1, Math.min(1, compositeScore)),
      confidence,
      breakdown,
      calculation_method: "weighted_average",
    };
  }

  /**
   * Returns the TrendData for a given category and window.
   * In mock mode: returns the pre-baked trend on the data object (ignores window
   * if only one window is available for that category).
   * After backend swap: this will call GET /api/neighborhoods/:id/:category/trend?window=
   */
  getTrendData(
    neighborhoodId: string,
    category: LayerType,
    window: TrendWindow,
  ): TrendData | null {
    const config = TREND_CONFIG[category];

    // Validate window is supported for this category
    if (!config.supported_windows.includes(window)) {
      console.warn(
        `[dataService] Window "${window}" not supported for "${category}". ` +
          `Supported: ${config.supported_windows.join(", ")}`,
      );
      // Fall back to default window for this category
    }

    const data = this.getNeighborhoodData(neighborhoodId, category);
    const trend = data?.trend;
    if (!data || !trend || trend.points.length < 2) return null;
    const last = trend.points[trend.points.length - 1];
    const score = this.getDimensionScore(neighborhoodId, category)!;
    // A historical series must describe the same index as the current profile.
    if (Math.abs(last.score - score) > 0.025) return null;
    if (
      Math.abs(Date.parse(data.last_updated) - Date.parse(last.date)) >
      3 * 86400000
    )
      return null;
    return trend;
  }

  getDimensionScore(
    neighborhoodId: string,
    category: LayerType,
  ): number | null {
    const data = this.getNeighborhoodData(neighborhoodId, category);
    if (!data) return null;
    if (category === "social")
      return (data as SocialSentimentData).sentiment_score;
    if (category === "news") return (data as NewsEventData).event_density_score;
    return data.score;
  }

  /**
   * Returns the score delta for a neighborhood/category if trend data exists.
   * Used to show ↑/↓ badges on cards without a full chart.
   */
  getScoreDelta(
    neighborhoodId: string,
    category: LayerType,
  ): { delta: number; direction: "up" | "down" | "stable" } | null {
    const trend = this.getTrendData(
      neighborhoodId,
      category,
      TREND_CONFIG[category].default_window,
    );
    if (!trend) return null;
    return {
      delta: trend.delta,
      direction: trend.direction,
    };
  }

  getScoreColor(score: number): string {
    if (score < -0.6) return "#9d4c45";
    if (score < -0.3) return "#986f37";
    if (score < 0.3) return "#74817d";
    if (score < 0.6) return "#568369";
    return "#35749b";
  }

  getDataQualityLevel(quality: number): "high" | "medium" | "low" {
    if (quality >= 0.8) return "high";
    if (quality >= 0.6) return "medium";
    return "low";
  }

  getAllDemographicsData(): DemographicsData[] {
    return this.snapshot.demographics;
  }

  getAllCrimeData(): CrimeData[] {
    return this.snapshot.crime;
  }

  getAllAmenitiesData(): AmenitiesData[] {
    return this.snapshot.amenities;
  }

  getAllSocialData(): SocialSentimentData[] {
    return this.snapshot.social;
  }

  getAllNewsData(): NewsEventData[] {
    return this.snapshot.news;
  }
}

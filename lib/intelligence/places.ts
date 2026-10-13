import { neighborhoodsGeoJSON } from "@/lib/data/neighborhoods";
import type { HotspotFeature } from "@/lib/types/data";

export function areaPolygons(geometry: unknown): number[][][][] {
  const shape = geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
  return shape.type === "MultiPolygon"
    ? shape.coordinates
    : [shape.coordinates];
}

function insideRing([x, y]: number[], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function placeArea(coordinates: [number, number]) {
  return neighborhoodsGeoJSON.features.find((f) =>
    areaPolygons(f.geometry).some(
      (rings) =>
        insideRing(coordinates, rings[0]) &&
        !rings.slice(1).some((ring) => insideRing(coordinates, ring)),
    ),
  )?.properties;
}

export function placeName(place: HotspotFeature) {
  const origin = place.properties.anchor_origin;
  const named = origin.match(/^[^(]*\((.*)\)$/)?.[1];
  if (named) return named;
  return origin ? `${origin} amenity cluster` : "Local amenity cluster";
}

// A ground-distance catchment, independent of zoom or screen-pixel size.
export function placeCatchment(
  place: HotspotFeature,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = place.geometry.coordinates;
  const longitude = (lng * Math.PI) / 180;
  const latitude = (lat * Math.PI) / 180;
  const angular = place.properties.radius_m / 6371008.8;
  const ring = Array.from({ length: 65 }, (_, i) => {
    const bearing = (i * Math.PI * 2) / 64;
    const nextLat = Math.asin(
      Math.sin(latitude) * Math.cos(angular) +
        Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing),
    );
    const nextLng =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude),
        Math.cos(angular) - Math.sin(latitude) * Math.sin(nextLat),
      );
    return [(nextLng * 180) / Math.PI, (nextLat * 180) / Math.PI];
  });
  ring[64] = [...ring[0]];
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

export const placeCategories = [
  { id: "transit", label: "Transit", color: "#628aa4" },
  { id: "retail", label: "Shops & services", color: "#b99253" },
  { id: "parks", label: "Parks", color: "#628f80" },
  { id: "schools", label: "Schools", color: "#897b9e" },
  { id: "healthcare", label: "Healthcare", color: "#b67570" },
] as const;

export function placeCategory(place: HotspotFeature) {
  const anchor = place.properties.anchor_origin
    .split("(")[0]
    .trim()
    .toLowerCase();
  return (
    placeCategories.find((category) => category.id === anchor) ?? {
      id: "other",
      label: "Other places",
      color: "#62787e",
    }
  );
}

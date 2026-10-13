// lib/data/neighborhoods.ts
import type { NeighborhoodGeoJSON } from '@/lib/types/data';
import boundariesRaw from './neighborhoods_boundaries.json';

export const neighborhoodsGeoJSON = boundariesRaw as NeighborhoodGeoJSON;

const numericIdMap: Record<string, number> = {};

neighborhoodsGeoJSON.features.forEach((f, index) => {
  const id = f.properties?.id;
  if (id) {
    numericIdMap[id] = (f.id as number) || (index + 1);
  }
});

export const getAllNeighborhoods = () => {
  return neighborhoodsGeoJSON.features.map(f => ({
    id: f.properties.id,
    name: f.properties.name,
  }));
};

export const neighborhoodNumericId = (id: string): number => {
  return numericIdMap[id] || 0;
};

export const getNeighborhoodFeatureById = (id: string) => {
  return neighborhoodsGeoJSON.features.find(f => f.properties.id === id);
};

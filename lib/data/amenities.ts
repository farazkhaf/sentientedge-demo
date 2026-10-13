// lib/data/amenities.ts
import type { AmenitiesData } from '@/lib/types/data';
import amenitiesRaw from './amenities_data.json';

// Type assertion to match your strict interface
export const amenitiesData: AmenitiesData[] = amenitiesRaw.neighborhoods as AmenitiesData[];

export const getAmenitiesByNeighborhood = (neighborhoodId: string): AmenitiesData | undefined => {
  return amenitiesData.find(a => a.neighborhood_id === neighborhoodId);
};

export const getAllAmenities = (): AmenitiesData[] => amenitiesData;

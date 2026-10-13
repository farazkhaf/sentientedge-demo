import type { DemographicsData } from '@/lib/types/data';
import { loadDemographicsData } from './demographicsLoader';

// Replace the mock data with the safely loaded data
export const demographicsData: DemographicsData[] = loadDemographicsData();

export const getDemographicsByNeighborhood = (neighborhoodId: string) => {
  return demographicsData.find((d) => d.neighborhood_id === neighborhoodId);
};

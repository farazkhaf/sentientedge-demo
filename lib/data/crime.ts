import type { CrimeData } from '@/lib/types/data';
import { loadCrimeData } from './crimeloader';

// Replace the mock data with the safely loaded data
export const crimeData: CrimeData[] = loadCrimeData();

export const getCrimeByNeighborhood = (neighborhoodId: string) => {
  return crimeData.find((c) => c.neighborhood_id === neighborhoodId);
};

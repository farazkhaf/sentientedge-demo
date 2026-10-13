import type { CrimeData } from '@/lib/types/data';
import crimeJson from './crime.json';
//lib\data\crimeloader.ts
function isValidCrimeData(data: any): data is CrimeData {
  // Basic structure checks
  if (!data || typeof data !== 'object') return false;
  if (typeof data.neighborhood_id !== 'string') return false;
  if (typeof data.score !== 'number') return false;
  if (typeof data.crime_risk_score !== 'number') return false;
  if (typeof data.data_quality !== 'number') return false;
  if (typeof data.last_updated !== 'string') return false;

  // crime_types validation
  if (!data.crime_types || typeof data.crime_types !== 'object') return false;
  if (typeof data.crime_types.violent !== 'number') return false;
  if (typeof data.crime_types.property !== 'number') return false;
  if (typeof data.crime_types.quality_of_life !== 'number') return false;

  // trend_direction validation
  if (!['increasing', 'decreasing', 'stable'].includes(data.trend_direction)) return false;

  // hotspots validation
  if (!Array.isArray(data.hotspots)) return false;
  if (!data.hotspots.every((h: any) =>
    typeof h.lat === 'number' &&
    typeof h.lng === 'number' &&
    typeof h.radius === 'number'
  )) return false;

  // trend validation
  if (!data.trend || typeof data.trend !== 'object') return false;
  if (!['weekly'].includes(data.trend.cadence)) return false;
  if (!['7d'].includes(data.trend.window)) return false;
  if (!Array.isArray(data.trend.points)) return false;
  if (!data.trend.points.every((p: any) =>
    typeof p.date === 'string' &&
    typeof p.score === 'number'
  )) return false;
  if (typeof data.trend.delta !== 'number') return false;
  if (typeof data.trend.delta_pct !== 'number' && data.trend.delta_pct !== null) return false;
  if (!['up', 'down', 'stable'].includes(data.trend.direction)) return false;

  return true;
}

/**
 * Validates the entire dataset
 */
function isValidCrimeDataset(data: any): data is CrimeData[] {
  return Array.isArray(data) && data.every(isValidCrimeData);
}

/**
 * Safely load crime data with validation and fallback
 */
export function loadCrimeData(): CrimeData[] {
  try {
    if (isValidCrimeDataset(crimeJson)) {
      return crimeJson;
    }

    console.error('Crime data validation failed. Using minimal fallback data.');
    return getFallbackCrimeData();
  } catch (error) {
    console.error('Error loading crime data:', error);
    return getFallbackCrimeData();
  }
}

/**
 * Fallback data for when main data fails
 */
function getFallbackCrimeData(): CrimeData[] {
  return [{
    neighborhood_id: 'downtown-miami',
    score: -0.5,
    crime_risk_score: -0.5,
    data_quality: 0.7,
    last_updated: new Date().toISOString(),
    crime_types: {
      violent: 15,
      property: 40,
      quality_of_life: 25
    },
    trend_direction: 'stable',
    hotspots: [{ lat: 25.7617, lng: -80.1918, radius: 0.003 }],
    trend: {
      cadence: 'weekly',
      window: '7d',
      points: [
        { date: new Date(Date.now() - 6*86400000).toISOString().split('T')[0], score: -0.5 },
        { date: new Date(Date.now() - 5*86400000).toISOString().split('T')[0], score: -0.5 },
        { date: new Date(Date.now() - 4*86400000).toISOString().split('T')[0], score: -0.5 },
        { date: new Date(Date.now() - 3*86400000).toISOString().split('T')[0], score: -0.5 },
        { date: new Date(Date.now() - 2*86400000).toISOString().split('T')[0], score: -0.5 },
        { date: new Date(Date.now() - 1*86400000).toISOString().split('T')[0], score: -0.5 },
        { date: new Date().toISOString().split('T')[0], score: -0.5 }
      ],
      delta: 0,
      delta_pct: 0,
      direction: 'stable'
    }
  }];
}

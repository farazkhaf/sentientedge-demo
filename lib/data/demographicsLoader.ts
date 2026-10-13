import type { DemographicsData } from '@/lib/types/data';
import demographicsJson from './demographics.json';

/**
 * Validates if the imported data matches the DemographicsData structure
 */
function isValidDemographicsData(data: any): data is DemographicsData {
  // Basic structure checks
  if (!data || typeof data !== 'object') return false;
  if (typeof data.neighborhood_id !== 'string') return false;
  if (typeof data.score !== 'number') return false;
  if (typeof data.demographic_desirability_score !== 'number') return false;
  if (typeof data.data_quality !== 'number') return false;
  if (typeof data.last_updated !== 'string') return false;

  // metrics validation
  if (!data.metrics || typeof data.metrics !== 'object') return false;
  if (typeof data.metrics.population_density !== 'number') return false;
  if (typeof data.metrics.median_income !== 'number') return false;

  // age distribution validation
  if (!data.metrics.age_distribution || typeof data.metrics.age_distribution !== 'object') return false;
  const ageDist = data.metrics.age_distribution;
  if (typeof ageDist.under_18 !== 'number' ||
      typeof ageDist['18_34'] !== 'number' ||
      typeof ageDist['35_54'] !== 'number' ||
      typeof ageDist['55_plus'] !== 'number') {
    return false;
  }

  // education validation
  if (!data.metrics.education || typeof data.metrics.education !== 'object') return false;
  const education = data.metrics.education;
  if (typeof education.high_school !== 'number' ||
      typeof education.bachelors !== 'number' ||
      typeof education.graduate !== 'number') {
    return false;
  }

  // homeownership validation
  if (typeof data.metrics.homeownership !== 'number') return false;

  // trend validation
  if (!data.trend || typeof data.trend !== 'object') return false;
  if (!['quarterly'].includes(data.trend.cadence)) return false;
  if (!['90d'].includes(data.trend.window)) return false;
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
function isValidDemographicsDataset(data: any): data is DemographicsData[] {
  return Array.isArray(data) && data.every(isValidDemographicsData);
}

/**
 * Safely load demographics data with validation and fallback
 */
export function loadDemographicsData(): DemographicsData[] {
  try {
    if (isValidDemographicsDataset(demographicsJson)) {
      return demographicsJson;
    }

    console.error('Demographics data validation failed. Using minimal fallback data.');
    return getFallbackDemographicsData();
  } catch (error) {
    console.error('Error loading demographics data:', error);
    return getFallbackDemographicsData();
  }
}

/**
 * Fallback data for when main data fails
 */
function getFallbackDemographicsData(): DemographicsData[] {
  const today = new Date().toISOString().split('T')[0];
  const ninetyDaysAgo = new Date(Date.now() - 90*86400000).toISOString().split('T')[0];

  return [{
    neighborhood_id: 'downtown-miami',
    score: 0.5,
    demographic_desirability_score: 0.5,
    data_quality: 0.7,
    last_updated: new Date().toISOString(),
    metrics: {
      population_density: 5000,
      median_income: 50000,
      age_distribution: {
        under_18: 15,
        '18_34': 35,
        '35_54': 30,
        '55_plus': 20
      },
      education: {
        high_school: 85,
        bachelors: 35,
        graduate: 15
      },
      homeownership: 30
    },
    trend: {
      cadence: 'quarterly',
      window: '90d',
      points: [
        { date: ninetyDaysAgo, score: 0.5 },
        { date: new Date(Date.now() - 75*86400000).toISOString().split('T')[0], score: 0.5 },
        { date: new Date(Date.now() - 60*86400000).toISOString().split('T')[0], score: 0.5 },
        { date: new Date(Date.now() - 45*86400000).toISOString().split('T')[0], score: 0.5 },
        { date: new Date(Date.now() - 30*86400000).toISOString().split('T')[0], score: 0.5 },
        { date: today, score: 0.5 }
      ],
      delta: 0,
      delta_pct: 0,
      direction: 'stable'
    }
  }];
}

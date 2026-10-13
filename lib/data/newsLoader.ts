import type { NewsEventData } from '@/lib/types/data';
import newsJson from './news.json';

const VALID_NEWS_CADENCES = ['daily', 'weekly'] as const;
const VALID_TREND_WINDOWS = ['7d', '30d'] as const;
const VALID_DIRECTIONS = ['up', 'down', 'stable'] as const;
const VALID_NEWS_CATEGORIES = [
  'Infrastructure',
  'Economic',
  'Government Policy',
  'Environmental',
  'Construction',
  'Demographic',
] as const;

type RawNewsSource = {
  name?: string;
  url?: string;
};

type RawNewsEvent = {
  id?: string;
  category?: string;
  summary?: string;
  sources?: RawNewsSource[];
  timestamp?: string;
  significance_score?: number;
};

type RawNewsEntry = {
  neighborhood_id?: string;
  score?: number;
  event_density_score?: number;
  data_quality?: number;
  last_updated?: string;
  event_count?: number;
  event_count_delta?: number;
  events?: RawNewsEvent[];
  trend?: any;
};

function normalizeNeighborhoodId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const withSlashes = trimmed.replace(/[\s_]*\/[\s_]*/g, '_/_');
  return withSlashes.replace(/[\s-]+/g, '_');
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  const mdMatch = raw.match(/^\[(.+)\]\((.*)\)$/);
  if (mdMatch) {
    const text = mdMatch[1].trim();
    const link = mdMatch[2].trim();
    if (text.startsWith('http')) return text;
    if (link.startsWith('http')) return link;
  }
  return raw;
}

function parseDate(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function normalizeTrend(raw: any): NewsEventData['trend'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  if (!VALID_NEWS_CADENCES.includes(raw.cadence)) return undefined;
  if (!VALID_TREND_WINDOWS.includes(raw.window)) return undefined;
  if (!Array.isArray(raw.points)) return undefined;

  const points = raw.points
    .filter((p: any) => p && typeof p.date === 'string' && typeof p.score === 'number')
    .map((p: any) => ({ date: p.date, score: p.score }));

  if (!points.length) return undefined;

  const delta = typeof raw.delta === 'number'
    ? raw.delta
    : points[points.length - 1].score - points[0].score;
  const delta_pct =
    typeof raw.delta_pct === 'number' || raw.delta_pct === null ? raw.delta_pct : null;
  const direction = VALID_DIRECTIONS.includes(raw.direction) ? raw.direction : 'stable';

  return {
    cadence: raw.cadence,
    window: raw.window,
    points,
    delta,
    delta_pct,
    direction,
  };
}

function normalizeEvent(
  raw: RawNewsEvent,
  neighborhoodId: string,
  index: number,
  fallbackTimestamp: string
) {
  if (!raw || typeof raw !== 'object') return null;
  const summary = typeof raw.summary === 'string' ? raw.summary : '';
  if (!summary) return null;
  const id = typeof raw.id === 'string' ? raw.id : `${neighborhoodId}-event-${index}`;
  const category = VALID_NEWS_CATEGORIES.includes(raw.category as any)
    ? (raw.category as NewsEventData['events'][number]['category'])
    : 'Economic';
  const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : fallbackTimestamp;
  const sources = Array.isArray(raw.sources)
    ? raw.sources
        .map((source) => {
          const name = typeof source.name === 'string' ? source.name : '';
          const url = normalizeUrl(source.url);
          return name && url ? { name, url } : null;
        })
        .filter((source): source is { name: string; url: string } => Boolean(source))
    : [];

  if (!sources.length) return null;

  const significance_score =
    typeof raw.significance_score === 'number' ? raw.significance_score : undefined;

  return { id, category, summary, sources, timestamp, significance_score };
}

function mergeEvents(entries: RawNewsEntry[], neighborhoodId: string) {
  const byId = new Map<string, NewsEventData['events'][number]>();
  for (const entry of entries) {
    const fallbackTimestamp =
      typeof entry.last_updated === 'string' ? entry.last_updated : new Date().toISOString();
    const events = Array.isArray(entry.events) ? entry.events : [];
    events.forEach((event, index) => {
      const normalized = normalizeEvent(event, neighborhoodId, index, fallbackTimestamp);
      if (normalized && !byId.has(normalized.id)) {
        byId.set(normalized.id, normalized);
      }
    });
  }
  return Array.from(byId.values());
}

function pickPrimaryEntry(entries: RawNewsEntry[]): RawNewsEntry {
  return [...entries].sort((a, b) => {
    const dateDiff = parseDate(b.last_updated) - parseDate(a.last_updated);
    if (dateDiff !== 0) return dateDiff;
    const qualityDiff = (b.data_quality ?? 0) - (a.data_quality ?? 0);
    if (qualityDiff !== 0) return qualityDiff;
    const countDiff = (b.event_count ?? b.events?.length ?? 0) - (a.event_count ?? a.events?.length ?? 0);
    return countDiff;
  })[0];
}

function normalizeNewsEntry(
  entry: RawNewsEntry,
  neighborhoodId: string,
  mergedEvents: NewsEventData['events']
): NewsEventData {
  const lastUpdated =
    typeof entry.last_updated === 'string' ? entry.last_updated : new Date().toISOString();

  return {
    neighborhood_id: neighborhoodId,
    score: typeof entry.score === 'number' ? entry.score : 0,
    event_density_score:
      typeof entry.event_density_score === 'number' ? entry.event_density_score : 0,
    event_count_delta:
      typeof entry.event_count_delta === 'number' ? entry.event_count_delta : undefined,
    data_quality: typeof entry.data_quality === 'number' ? entry.data_quality : 0.5,
    last_updated: lastUpdated,
    events: mergedEvents,
    trend: normalizeTrend(entry.trend),
  };
}

function normalizeNewsDataset(data: any): NewsEventData[] {
  if (!Array.isArray(data)) return [];
  const grouped = new Map<string, RawNewsEntry[]>();

  for (const entry of data as RawNewsEntry[]) {
    const id = normalizeNeighborhoodId(entry?.neighborhood_id);
    if (!id) continue;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)?.push(entry);
  }

  const normalized: NewsEventData[] = [];
  for (const [id, entries] of grouped.entries()) {
    const primary = pickPrimaryEntry(entries);
    const mergedEvents = mergeEvents(entries, id);
    normalized.push(normalizeNewsEntry(primary, id, mergedEvents));
  }

  return normalized;
}

/**
 * Validates if the imported data matches the NewsEventData structure
 */
function isValidNewsData(data: any): data is NewsEventData {
  // Basic structure checks
  if (!data || typeof data !== 'object') return false;
  if (typeof data.neighborhood_id !== 'string') return false;
  if (typeof data.score !== 'number') return false;
  if (typeof data.event_density_score !== 'number') return false;
  if (typeof data.data_quality !== 'number') return false;
  if (typeof data.last_updated !== 'string') return false;

  // Event count validation
  if (typeof data.event_count_delta !== 'number' && data.event_count_delta !== undefined) return false;
  if (!Array.isArray(data.events)) return false;

  // Events validation
  if (Array.isArray(data.events)) {
    if (!data.events.every((event: any) =>
      typeof event.id === 'string' &&
      VALID_NEWS_CATEGORIES.includes(event.category) &&
      typeof event.summary === 'string' &&
      Array.isArray(event.sources) &&
      event.sources.length > 0 &&
      event.sources.every((source: any) =>
        typeof source.name === 'string' &&
        typeof source.url === 'string'
      ) &&
      typeof event.timestamp === 'string' &&
      (typeof event.significance_score === 'number' || event.significance_score === undefined)
    )) return false;
  }

  // Trend validation (optional)
  if (data.trend) {
    if (typeof data.trend !== 'object') return false;
    if (!VALID_NEWS_CADENCES.includes(data.trend.cadence)) return false;
    if (!VALID_TREND_WINDOWS.includes(data.trend.window)) return false;
    if (!Array.isArray(data.trend.points)) return false;
    if (!data.trend.points.every((p: any) =>
      typeof p.date === 'string' &&
      typeof p.score === 'number'
    )) return false;
    if (typeof data.trend.delta !== 'number') return false;
    if (typeof data.trend.delta_pct !== 'number' && data.trend.delta_pct !== null) return false;
    if (!VALID_DIRECTIONS.includes(data.trend.direction)) return false;
  }

  return true;
}

/**
 * Validates the entire dataset
 */
function isValidNewsDataset(data: any): data is NewsEventData[] {
  return Array.isArray(data) && data.every(isValidNewsData);
}

/**
 * Safely load news data with validation and fallback
 */
export function loadNewsData(): NewsEventData[] {
  try {
    const normalized = normalizeNewsDataset(newsJson);
    if (isValidNewsDataset(normalized)) {
      return normalized;
    }

    console.warn('News data validation failed. Using minimal fallback data.');
    return getFallbackNewsData();
  } catch (error) {
    console.error('Error loading news data:', error);
    return getFallbackNewsData();
  }
}

/**
 * Fallback data for when main data fails
 */
function getFallbackNewsData(): NewsEventData[] {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7*86400000).toISOString().split('T')[0];

  return [{
    neighborhood_id: 'downtown_miami',
    score: 0.0,
    event_density_score: 0.0,
    event_count_delta: 0,
    data_quality: 0.5,
    last_updated: new Date().toISOString(),
    events: [],
    trend: {
      cadence: 'weekly',
      window: '7d',
      points: [
        { date: sevenDaysAgo, score: 0.0 },
        { date: new Date(Date.now() - 6*86400000).toISOString().split('T')[0], score: 0.0 },
        { date: new Date(Date.now() - 5*86400000).toISOString().split('T')[0], score: 0.0 },
        { date: new Date(Date.now() - 4*86400000).toISOString().split('T')[0], score: 0.0 },
        { date: new Date(Date.now() - 3*86400000).toISOString().split('T')[0], score: 0.0 },
        { date: new Date(Date.now() - 2*86400000).toISOString().split('T')[0], score: 0.0 },
        { date: today, score: 0.0 }
      ],
      delta: 0,
      delta_pct: 0,
      direction: 'stable'
    }
  }];
}

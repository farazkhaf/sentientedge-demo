import type { SocialSentimentData } from '@/lib/types/data';
import socialJson from './social.json';

const VALID_SOCIAL_CADENCES = ['daily'] as const;
const VALID_TREND_WINDOWS = ['7d', '30d'] as const;
const VALID_DIRECTIONS = ['up', 'down', 'stable'] as const;
const VALID_SENTIMENTS = ['positive', 'neutral', 'negative'] as const;

type RawSocialSource = {
  id?: string;
  source?: string;
  text?: string;
  summary?: string;
  sentiment?: string;
  url?: string;
  timestamp?: string;
};

type RawSocialEntry = {
  neighborhood_id?: string;
  score?: number;
  sentiment_score?: number;
  data_quality?: number;
  last_updated?: string;
  post_count?: number;
  post_count_delta?: number;
  sentiment_distribution?: {
    positive?: number;
    neutral?: number;
    negative?: number;
  };
  posts?: RawSocialSource[];
  sources_found?: RawSocialSource[];
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

function normalizeSentiment(value: unknown): 'positive' | 'neutral' | 'negative' {
  return VALID_SENTIMENTS.includes(value as any) ? (value as any) : 'neutral';
}

function parseDate(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function normalizeDistribution(dist: RawSocialEntry['sentiment_distribution']) {
  if (!dist || typeof dist !== 'object') return undefined;
  const positive = typeof dist.positive === 'number' ? dist.positive : undefined;
  const neutral = typeof dist.neutral === 'number' ? dist.neutral : undefined;
  const negative = typeof dist.negative === 'number' ? dist.negative : undefined;
  if (positive === undefined || neutral === undefined || negative === undefined) return undefined;
  const total = positive + neutral + negative;
  if (!Number.isFinite(total) || total <= 0) return undefined;
  if (Math.abs(total - 100) > 1) {
    const factor = 100 / total;
    const normPositive = Math.round(positive * factor);
    const normNeutral = Math.round(neutral * factor);
    const normNegative = 100 - normPositive - normNeutral;
    return { positive: normPositive, neutral: normNeutral, negative: normNegative };
  }
  return { positive, neutral, negative };
}

function normalizeTrend(raw: any): SocialSentimentData['trend'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  if (!VALID_SOCIAL_CADENCES.includes(raw.cadence)) return undefined;
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

function normalizePostsFromEntry(entry: RawSocialEntry, neighborhoodId: string) {
  const fallbackTimestamp =
    typeof entry.last_updated === 'string' ? entry.last_updated : new Date().toISOString();
  const rawPosts: RawSocialSource[] = [];

  if (Array.isArray(entry.posts)) rawPosts.push(...entry.posts);
  if (Array.isArray(entry.sources_found)) rawPosts.push(...entry.sources_found);

  return rawPosts
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') return null;
      const text =
        typeof raw.text === 'string'
          ? raw.text
          : typeof raw.summary === 'string'
          ? raw.summary
          : '';
      if (!text) return null;
      const id = typeof raw.id === 'string' ? raw.id : `${neighborhoodId}-post-${index}`;
      const source = typeof raw.source === 'string' ? raw.source : 'Unknown';
      const sentiment = normalizeSentiment(raw.sentiment);
      const url = normalizeUrl(raw.url);
      const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : fallbackTimestamp;
      return { id, source, text, sentiment, url, timestamp };
    })
    .filter((post): post is SocialSentimentData['posts'][number] => Boolean(post));
}

function mergePosts(entries: RawSocialEntry[], neighborhoodId: string) {
  const byId = new Map<string, SocialSentimentData['posts'][number]>();
  for (const entry of entries) {
    for (const post of normalizePostsFromEntry(entry, neighborhoodId)) {
      if (!byId.has(post.id)) {
        byId.set(post.id, post);
      }
    }
  }
  return Array.from(byId.values());
}

function pickPrimaryEntry(entries: RawSocialEntry[]): RawSocialEntry {
  return [...entries].sort((a, b) => {
    const dateDiff = parseDate(b.last_updated) - parseDate(a.last_updated);
    if (dateDiff !== 0) return dateDiff;
    const qualityDiff = (b.data_quality ?? 0) - (a.data_quality ?? 0);
    if (qualityDiff !== 0) return qualityDiff;
    const countDiff = (b.post_count ?? 0) - (a.post_count ?? 0);
    return countDiff;
  })[0];
}

function normalizeSocialEntry(
  entry: RawSocialEntry,
  neighborhoodId: string,
  mergedPosts: SocialSentimentData['posts']
): SocialSentimentData {
  const lastUpdated =
    typeof entry.last_updated === 'string' ? entry.last_updated : new Date().toISOString();

  return {
    neighborhood_id: neighborhoodId,
    score: typeof entry.score === 'number' ? entry.score : 0,
    sentiment_score:
      typeof entry.sentiment_score === 'number' ? entry.sentiment_score : 0,
    data_quality: typeof entry.data_quality === 'number' ? entry.data_quality : 0.5,
    last_updated: lastUpdated,
    post_count:
      typeof entry.post_count === 'number' ? entry.post_count : mergedPosts.length,
    post_count_delta:
      typeof entry.post_count_delta === 'number' ? entry.post_count_delta : undefined,
    sentiment_distribution: normalizeDistribution(entry.sentiment_distribution),
    posts: mergedPosts,
    trend: normalizeTrend(entry.trend),
  };
}

function normalizeSocialDataset(data: any): SocialSentimentData[] {
  if (!Array.isArray(data)) return [];
  const grouped = new Map<string, RawSocialEntry[]>();

  for (const entry of data as RawSocialEntry[]) {
    const id = normalizeNeighborhoodId(entry?.neighborhood_id);
    if (!id) continue;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)?.push(entry);
  }

  const normalized: SocialSentimentData[] = [];
  for (const [id, entries] of grouped.entries()) {
    const primary = pickPrimaryEntry(entries);
    const mergedPosts = mergePosts(entries, id);
    normalized.push(normalizeSocialEntry(primary, id, mergedPosts));
  }

  return normalized;
}

/**
 * Validates if the imported data matches the SocialSentimentData structure
 */
function isValidSocialData(data: any): data is SocialSentimentData {
  // Basic structure checks
  if (!data || typeof data !== 'object') return false;
  if (typeof data.neighborhood_id !== 'string') return false;
  if (typeof data.score !== 'number') return false;
  if (typeof data.sentiment_score !== 'number') return false;
  if (typeof data.data_quality !== 'number') return false;
  if (typeof data.last_updated !== 'string') return false;

  // Post count validation
  if (typeof data.post_count !== 'number') return false;
  if (typeof data.post_count_delta !== 'number' && data.post_count_delta !== undefined) return false;

  // Sentiment distribution validation
  if (data.sentiment_distribution) {
    const dist = data.sentiment_distribution;
    if (typeof dist.positive !== 'number' ||
        typeof dist.neutral !== 'number' ||
        typeof dist.negative !== 'number') {
      return false;
    }
    const total = dist.positive + dist.neutral + dist.negative;
    if (Math.abs(total - 100) > 1) return false; // Allow small rounding errors
  }

  // Posts validation
  if (!Array.isArray(data.posts)) return false;
  if (!data.posts.every((post: any) =>
    typeof post.id === 'string' &&
    typeof post.source === 'string' &&
    typeof post.text === 'string' &&
    ['positive', 'neutral', 'negative'].includes(post.sentiment) &&
    typeof post.url === 'string' &&
    typeof post.timestamp === 'string'
  )) return false;

  // Trend validation (optional)
  if (data.trend) {
    if (typeof data.trend !== 'object') return false;
    if (!['daily'].includes(data.trend.cadence)) return false;
    if (!['7d', '30d'].includes(data.trend.window)) return false;
    if (!Array.isArray(data.trend.points)) return false;
    if (!data.trend.points.every((p: any) =>
      typeof p.date === 'string' &&
      typeof p.score === 'number'
    )) return false;
    if (typeof data.trend.delta !== 'number') return false;
    if (typeof data.trend.delta_pct !== 'number' && data.trend.delta_pct !== null) return false;
    if (!['up', 'down', 'stable'].includes(data.trend.direction)) return false;
  }

  return true;
}

/**
 * Validates the entire dataset
 */
function isValidSocialDataset(data: any): data is SocialSentimentData[] {
  return Array.isArray(data) && data.every(isValidSocialData);
}

/**
 * Safely load social data with validation and fallback
 */
export function loadSocialData(): SocialSentimentData[] {
  try {
    const normalized = normalizeSocialDataset(socialJson);
    if (isValidSocialDataset(normalized)) {
      return normalized;
    }

    console.error('Social data validation failed. Using minimal fallback data.');
    return getFallbackSocialData();
  } catch (error) {
    console.error('Error loading social data:', error);
    return getFallbackSocialData();
  }
}

/**
 * Fallback data for when main data fails
 */
function getFallbackSocialData(): SocialSentimentData[] {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7*86400000).toISOString().split('T')[0];

  return [{
    neighborhood_id: 'downtown_miami',
    score: 0.0,
    sentiment_score: 0.0,
    data_quality: 0.5,
    last_updated: new Date().toISOString(),
    post_count: 0,
    post_count_delta: 0,
    sentiment_distribution: {
      positive: 33,
      neutral: 33,
      negative: 34
    },
    posts: [],
    trend: {
      cadence: 'daily',
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

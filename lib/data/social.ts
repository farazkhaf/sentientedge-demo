import type { SocialSentimentData } from '@/lib/types/data';
import { loadSocialData } from './socialLoader';

// Fast-changing: supports 7d and 30d trend windows.
// post_count_delta: difference in post volume vs same window prior period.

export const socialSentimentData: SocialSentimentData[] = loadSocialData();

export const getSocialByNeighborhood = (neighborhoodId: string) => {
  return socialSentimentData.find((s) => s.neighborhood_id === neighborhoodId);
};

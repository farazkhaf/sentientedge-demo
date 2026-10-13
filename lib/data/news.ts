import type { NewsEventData } from '@/lib/types/data';
import { loadNewsData } from './newsLoader';

// Fast-changing: supports 7d and 30d trend windows.
// event_count_delta: difference in event volume vs same window prior period.

export const newsEventsData: NewsEventData[] = loadNewsData();

export const getNewsByNeighborhood = (neighborhoodId: string) => {
  return newsEventsData.find((n) => n.neighborhood_id === neighborhoodId);
};

// src/search.ts
import { Env } from './types';

export interface RawArticle {
  title: string;
  content: string;
  url: string;
  publishedAt: string;
}

// Control how many news items you keep per topic per cron run
const MAX_ARTICLES_PER_TOPIC = 10;

function buildQueryForTopic(topicKey: string): string {
  // Very simple mapping based on topic prefixes
  if (topicKey.startsWith('driver_')) {
    const name = topicKey.replace('driver_', '').replace(/_/g, ' ');
    return `${name} 2025 F1 news site:formula1.com OR site:autosport.com OR site:motorsport.com`;
  }

  if (topicKey.startsWith('team_')) {
    const team = topicKey.replace('team_', '').replace(/_/g, ' ');
    return `${team} F1 2025 team news site:formula1.com OR site:autosport.com OR site:motorsport.com`;
  }

  if (topicKey.startsWith('race_2025_')) {
    // Example: race_2025_r18_singapore -> "Singapore Grand Prix 2025"
    const parts = topicKey.split('_');
    const location = parts[parts.length - 1];
    return `${location} Grand Prix 2025 F1 race results summary site:formula1.com OR site:autosport.com OR site:motorsport.com`;
  }

  // Default: overall 2025 season news
  return `Formula 1 2025 season news site:formula1.com OR site:autosport.com OR site:motorsport.com`;
}

/**
 * Fetch F1-related news for a specific topic using Serper.
 * This returns up to MAX_ARTICLES_PER_TOPIC items, already mapped to RawArticle.
 */
export async function fetchF1NewsForTopic(env: Env, topicKey: string): Promise<RawArticle[]> {
  const query = buildQueryForTopic(topicKey);

  const res = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: {
      'X-API-KEY': env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: MAX_ARTICLES_PER_TOPIC,
    }),
  });

  if (!res.ok) {
    console.error(`[Serper] Request failed for topic=${topicKey}, status=${res.status}`);
    return [];
  }

  const data = await res.json() as any;

  // Optional: log raw news results for debugging
  console.log(
    `[Serper][${topicKey}] fetched ${Array.isArray(data.news) ? data.news.length : 0} items`,
  );

  const news = (data.news ?? []) as any[];

  const articles: RawArticle[] = news.slice(0, MAX_ARTICLES_PER_TOPIC).map((item) => ({
    title: item.title,
    content: item.snippet || item.description || '',
    url: item.link,
    publishedAt: item.date || new Date().toISOString(),
  }));

  return articles;
}

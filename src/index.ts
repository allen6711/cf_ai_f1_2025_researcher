// src/index.ts
import { Env, QueryRequest } from './types';
import { fetchF1NewsForTopic } from './search';
import { TopicMemory } from './topicMemory';

// All topics that are periodically refreshed by the Cron job
const TRACKED_TOPICS = [
  'season_2025',
  'team_ferrari',
  'driver_hamilton',
  'race_2025_r01_bahrain',
  'race_2025_r02_saudi_arabia',
  'race_2025_r03_australia',
  'race_2025_r04_japan',
  'race_2025_r05_bahrain',
  'race_2025_r06_miami',
  'race_2025_r07_emilia_romagna',
  'race_2025_r08_monaco',
  'race_2025_r09_spain',
  'race_2025_r10_canada',
  'race_2025_r11_austria',
  'race_2025_r12_uk',
  'race_2025_r13_belgium',
  'race_2025_r14_hungary',
  'race_2025_r15_netherlands',
  'race_2025_r16_italy',
  'race_2025_r17_azerbaijan',
  'race_2025_r18_singapore',
  'race_2025_r19_usa_austin',
  'race_2025_r20_mexico',
  'race_2025_r21_brazil',
  'race_2025_r22_las_vegas',
  'race_2025_r23_qatar',
  'race_2025_r24_abu_dhabi',
];

// Human-friendly aliases used for auto-detecting topics from a question
const TOPIC_ALIASES: Record<string, string[]> = {
  season_2025: ['season 2025', '2025 season', 'championship', 'standings'],
  team_ferrari: ['ferrari', 'sf-25', 'sf25', 'maranello'],
  driver_hamilton: ['hamilton', 'lewis'],

  race_2025_r01_bahrain: ['bahrain', 'sakhir'],
  race_2025_r02_saudi_arabia: ['saudi', 'jeddah'],
  race_2025_r03_australia: ['australia', 'melbourne', 'albert park'],
  race_2025_r04_japan: ['japan', 'suzuka'],
  race_2025_r05_bahrain: ['bahrain', 'sakhir'], // second Bahrain round or sprint
  race_2025_r06_miami: ['miami'],
  race_2025_r07_emilia_romagna: ['imola', 'emilia romagna'],
  race_2025_r08_monaco: ['monaco'],
  race_2025_r09_spain: ['spain', 'barcelona'],
  race_2025_r10_canada: ['canada', 'montreal'],
  race_2025_r11_austria: ['austria', 'red bull ring'],
  race_2025_r12_uk: ['silverstone', 'british gp', 'uk', 'britain'],
  race_2025_r13_belgium: ['belgium', 'spa'],
  race_2025_r14_hungary: ['hungary', 'hungaroring'],
  race_2025_r15_netherlands: ['netherlands', 'zandvoort'],
  race_2025_r16_italy: ['italy', 'monza'],
  race_2025_r17_azerbaijan: ['azerbaijan', 'baku'],
  race_2025_r18_singapore: ['singapore', 'marina bay'],
  race_2025_r19_usa_austin: ['austin', 'cota', 'united states gp', 'usa gp'],
  race_2025_r20_mexico: ['mexico', 'mexico city'],
  race_2025_r21_brazil: ['brazil', 'interlagos', 'sao paulo'],
  race_2025_r22_las_vegas: ['vegas', 'las vegas'],
  race_2025_r23_qatar: ['qatar', 'lusail'],
  race_2025_r24_abu_dhabi: ['abu dhabi', 'yas marina'],
};

// Common CORS headers for all responses
function corsHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

// Decide which topicKey should handle a given question + optional topicHint
function resolveTopicKey(question: string, topicHint?: string): { topicKey: string; reason: string } {
  const q = (question || '').toLowerCase();

  // 1. If the user manually selected a topic and it is known, trust it
  if (topicHint && topicHint !== 'auto' && TRACKED_TOPICS.includes(topicHint)) {
    return { topicKey: topicHint, reason: 'hint' };
  }

  // 2. Try matching via alias table
  for (const [topicKey, aliases] of Object.entries(TOPIC_ALIASES)) {
    for (const alias of aliases) {
      if (q.includes(alias)) {
        return { topicKey, reason: `alias:${alias}` };
      }
    }
  }

  // 3. Fallback: use the last segment of the topic key as a simple keyword
  for (const topicKey of TRACKED_TOPICS) {
    const parts = topicKey.split('_');
    const keyword = parts[parts.length - 1];
    if (q.includes(keyword)) {
      return { topicKey, reason: `keyword:${keyword}` };
    }
  }

  // 4. Final fallback: season overview
  return { topicKey: 'season_2025', reason: 'default' };
}

export default {
  // 1. HTTP handler: handles user queries from the frontend
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/query' && request.method === 'POST') {
      try {
        const body = (await request.json()) as QueryRequest;
        const question = body.question ?? '';

        const { topicKey, reason } = resolveTopicKey(question, body.topicHint);
        console.log(`[Router] User asked: "${question}" -> topicKey="${topicKey}" (reason=${reason})`);

        const id = env.TOPIC_MEMORY.idFromName(topicKey);
        const stub = env.TOPIC_MEMORY.get(id);

        const doResponse = await stub.fetch('http://internal/query', {
          method: 'POST',
          body: JSON.stringify({ question }),
        });

        const data = await doResponse.json();

        return new Response(JSON.stringify(data), {
          headers: corsHeaders({ 'Content-Type': 'application/json' }),
        });
      } catch (err) {
        console.error('[fetch] Error handling /api/query:', err);
        return new Response(JSON.stringify({ error: 'Internal Error' }), {
          status: 500,
          headers: corsHeaders({ 'Content-Type': 'application/json' }),
        });
      }
    }

    // Any other path just returns 404
    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders(),
    });
  },

  // 2. Cron handler: periodically refreshes all topics using Serper
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[Cron] Starting F1 2025 update workflow...');

    ctx.waitUntil(
      (async () => {
        for (const topicKey of TRACKED_TOPICS) {
          console.log(`[Cron] Processing topic: ${topicKey}...`);

          try {
            const articles = await fetchF1NewsForTopic(env, topicKey);

            if (articles.length > 0) {
              const id = env.TOPIC_MEMORY.idFromName(topicKey);
              const stub = env.TOPIC_MEMORY.get(id);

              await stub.fetch('http://internal/update', {
                method: 'POST',
                body: JSON.stringify({ articles, topicKey }),
              });

              console.log(`[Cron] Updated ${topicKey} with ${articles.length} articles`);
            } else {
              console.log(`[Cron] No articles found for ${topicKey}`);
            }
          } catch (err) {
            console.error(`[Cron] Error processing ${topicKey}:`, err);
          }

          // Avoid hitting Serper rate limits: sleep 2 seconds between requests
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        console.log('[Cron] All topics processed successfully!');
      })(),
    );
  },
};

// Re-export the Durable Object class so Wrangler can bind it
export { TopicMemory };

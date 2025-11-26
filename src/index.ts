import { Env, QueryRequest } from './types';
import { fetchF1NewsForTopic } from './search';
import { TopicMemory } from './topicMemory';

// Topics tracked by the Cron job
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
  'race_2025_r24_abu_dhabi'
];

export default {
  // 1. HTTP HANDLER (User Query)
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS Handling
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/query" && request.method === "POST") {
      try {
        const body = await request.json() as QueryRequest;
        const q = body.question.toLowerCase();

        // --- ROUTING LOGIC ---
        let topicKey = 'season_2025'; // 1. Default fallback (if no match found, query season overview)

        // 2. Priority check: Did the user manually select a scope in the UI?
        if (body.topicHint && body.topicHint !== 'auto') {
          topicKey = body.topicHint;
        } else {
          // 3. Smart Auto-detection
          // Iterate through all TRACKED_TOPICS to find matching keywords in the user's query.
          for (const topic of TRACKED_TOPICS) {
            // Simple keyword extraction logic:
            // Split topicKey (e.g., 'race_2025_r18_singapore') and take the last part ('singapore').
            const parts = topic.split('_');
            const keyword = parts[parts.length - 1]; 

            // If the user's query (q) contains this keyword, select this Topic.
            if (q.includes(keyword)) {
              topicKey = topic;
              break; // Match found, stop searching.
            }
            
            // Edge case: specific handling for 'uk' to match 'british' or 'silverstone'.
            if (keyword === 'uk' && (q.includes('british') || q.includes('silverstone'))) {
              topicKey = topic;
              break;
            }
          }
        }
        
        console.log(`[Router] User asked: "${q}" -> Routed to: ${topicKey}`);

        // Get Durable Object Stub
        const id = env.TOPIC_MEMORY.idFromName(topicKey);
        const stub = env.TOPIC_MEMORY.get(id);

        // Forward to DO
        const doResponse = await stub.fetch(new Request("http://internal/query", {
          method: "POST",
          body: JSON.stringify({ question: body.question })
        }));

        const data = await doResponse.json();

        return new Response(JSON.stringify(data), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" 
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Internal Error" }), { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },

  // 2. CRON HANDLER (Scheduled Updates)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log("[Cron] Starting F1 2025 update workflow...");

    for (const topicKey of TRACKED_TOPICS) {
      ctx.waitUntil((async () => {
        // A. Fetch Real Data from Serper
        const articles = await fetchF1NewsForTopic(env, topicKey);
        
        if (articles.length === 0) {
          console.log(`[Cron] No articles found for ${topicKey}`);
          return;
        }

        // B. Send to Durable Object for summarization and storage
        const id = env.TOPIC_MEMORY.idFromName(topicKey);
        const stub = env.TOPIC_MEMORY.get(id);

        await stub.fetch(new Request("http://internal/update", {
          method: "POST",
          body: JSON.stringify({ articles, topicKey })
        }));

        console.log(`[Cron] Updated ${topicKey} with ${articles.length} articles`);
      })());
    }
  }
};
export { TopicMemory };
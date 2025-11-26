import { Env, QueryRequest } from './types';
import { fetchF1NewsForTopic } from './search';
import { TopicMemory } from './topicMemory';

// Topics tracked by the Cron job
const TRACKED_TOPICS = [
  'season_2025', 
  'team_ferrari', 
  'driver_hamilton', 
  'race_2025_r01_bahrain'
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

        // --- TOPIC ROUTING HEURISTICS ---
        let topicKey = 'season_2025'; // Default fallback

        if (body.topicHint && body.topicHint !== 'auto') {
          topicKey = body.topicHint;
        } else {
          // Heuristic Auto-detection
          if (q.includes('ferrari') || q.includes('red') || q.includes('scuderia')) topicKey = 'team_ferrari';
          else if (q.includes('hamilton') || q.includes('lewis')) topicKey = 'driver_hamilton';
          else if (q.includes('bahrain') || q.includes('sakhir')) topicKey = 'race_2025_r01_bahrain';
        }

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
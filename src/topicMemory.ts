import { DurableObject } from "cloudflare:workers";
import { Env, KnowledgeEntry, RawArticle, QueryResponse } from './types';
import { generateAnswer, summarizeArticle } from './ai';

export class TopicMemory extends DurableObject {
  state: DurableObjectState;
  env: Env;
  
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- HANDLE QUERY ---
    if (path === "/query" && request.method === "POST") {
      const { question } = await request.json() as { question: string };
      
      // Retrieve stored entries
      const entries =
        (await this.state.storage.get<KnowledgeEntry[]>('entries')) || [];
        
      
      // Select most recent 15 entries for context to fit in context window
      const context = entries;
      
      const answer = await generateAnswer(this.env, question, context);
      
      const response: QueryResponse = { answer, contextUsed: context };
      return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json" } });
    }

    // --- HANDLE UPDATE (CRON) ---
    if (path === "/update" && request.method === "POST") {
      const { articles, topicKey } = await request.json() as { articles: RawArticle[], topicKey: string };
      
      const currentEntries = await this.state.storage.get<KnowledgeEntry[]>("entries") || [];
      const newEntries: KnowledgeEntry[] = [];

      for (const article of articles) {
        // Summarize raw article using AI
        const summary = await summarizeArticle(this.env, article);
        
        const entry: KnowledgeEntry = {
          id: crypto.randomUUID(),
          topicKey,
          scope: 'season', // Default, logic could be refined
          type: 'news',
          summary,
          source: article.url,
          timestamp: article.publishedAt,
          createdAt: new Date().toISOString()
        };
        newEntries.push(entry);
      }

      // Merge and Save
      const updatedList = [...currentEntries, ...newEntries];
      await this.state.storage.put("entries", updatedList);
      await this.state.storage.put("lastUpdated", new Date().toISOString());

      return new Response(JSON.stringify({ status: "updated", count: newEntries.length }), { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  }
}
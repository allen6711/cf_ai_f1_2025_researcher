import { Env, KnowledgeEntry, RawArticle } from './types';

// Using the requested Llama 3.3 model
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"; 

export async function summarizeArticle(env: Env, article: RawArticle): Promise<string> {
  const prompt = `
    Summarize the following F1 2025 news article into a concise, factual paragraph. 
    Focus on key stats, race results, or technical updates.
    
    Title: ${article.title}
    Snippet: ${article.content}
  `;

  try {
    const response: any = await env.AI.run(MODEL_ID, {
      messages: [{ role: 'user', content: prompt }]
    });
    return response.response || "Summary unavailable.";
  } catch (e) {
    console.error("AI Summary failed", e);
    return "Summary unavailable.";
  }
}

export async function generateAnswer(
  env: Env, 
  question: string, 
  context: KnowledgeEntry[]
): Promise<string> {
  // Format context for the LLM
  const contextText = context.map(c => 
    `[${c.timestamp}] Source: ${c.source}\nInfo: ${c.summary}`
  ).join("\n\n");

  const systemPrompt = `
    You are an expert F1 2025 Season Research Assistant.
    Answer the user's question using ONLY the provided context entries below.
    If the context does not contain the answer, explicitly state that you do not have that information in your database.
    Do not hallucinate results that are not in the context.
    
    CONTEXT DATABASE:
    ${contextText}
  `;

  try {
    const response: any = await env.AI.run(MODEL_ID, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ]
    });
    return response.response || "I could not generate an answer.";
  } catch (e) {
    return "Error generating answer via Workers AI.";
  }
}
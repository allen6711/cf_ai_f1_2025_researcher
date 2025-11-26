import { Env, RawArticle } from './types';

// Map specific topics to targeted search queries
function buildQueryForTopic(topicKey: string): string {
  const trustedSites = "site:formula1.com OR site:autosport.com OR site:motorsport.com";
  
  // 1. Customized search queries for specific topics
  switch (topicKey) {
    case 'season_2025':
      return `Formula 1 2025 season latest news standings ${trustedSites}`;
    case 'team_ferrari':
      return `Ferrari F1 team 2025 updates news ${trustedSites}`;
    case 'driver_hamilton':
      return `Lewis Hamilton F1 2025 performance news ${trustedSites}`;
  }

  // 2. Dynamic handling for all Race topics (This handles ALL 24 races automatically)
  // Example: 'race_2025_r18_singapore' -> Search for "Singapore Grand Prix 2025 race results..."
  if (topicKey.startsWith('race_')) {
    // Convert 'race_2025_r18_singapore' to 'singapore'
    // Remove the prefix pattern (race_2025_rXX_) and replace underscores with spaces
    const raceName = topicKey
      .replace(/race_\d{4}_r\d{2}_/, '') 
      .replace(/_/g, ' ');               
    
    // Capitalize the first letter (e.g., "singapore" -> "Singapore")
    const formattedName = raceName.charAt(0).toUpperCase() + raceName.slice(1);

    return `${formattedName} Grand Prix 2025 race results summary news ${trustedSites}`;
  }

  // 3. Default fallback for generic topics
  const friendlyName = topicKey.replace(/_/g, ' ');
  return `${friendlyName} F1 2025 news ${trustedSites}`;
}

export async function fetchF1NewsForTopic(env: Env, topicKey: string): Promise<RawArticle[]> {
  const query = buildQueryForTopic(topicKey);
  console.log(`[Serper] Fetching for ${topicKey}: "${query}"`);

  try {
    const response = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: {
        "X-API-KEY": env.SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, num: 5 }) // Fetch top 5 results
    });

    if (!response.ok) {
      console.error(`[Serper] Error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: any = await response.json();
    
    if (!data.news || !Array.isArray(data.news)) {
      console.warn(`[Serper] No news found for ${topicKey}`);
      return [];
    }

    // Map Serper response to our internal RawArticle format
    return data.news.map((item: any) => ({
      title: item.title,
      content: item.snippet || item.description || "",
      url: item.link,
      publishedAt: item.date || new Date().toISOString()
    }));

  } catch (error) {
    console.error(`[Serper] Fetch failed:`, error);
    return [];
  }
}
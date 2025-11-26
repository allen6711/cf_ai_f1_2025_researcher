export interface Env {
  AI: Ai;
  TOPIC_MEMORY: DurableObjectNamespace;
  SERPER_API_KEY: string;
}

export type Scope = 'season' | 'team' | 'driver' | 'race';

export interface KnowledgeEntry {
  id: string;
  topicKey: string;
  scope: Scope;
  type: 'result' | 'news' | 'technical' | 'regulation' | 'incident';
  summary: string;
  source: string;
  timestamp: string; // ISO date
  createdAt: string;
}

export interface TopicState {
  topicKey: string;
  displayName: string;
  entries: KnowledgeEntry[];
  lastUpdated: string;
  tracked: boolean;
}

export interface RawArticle {
  title: string;
  content: string; // Snippet or description
  url: string;
  publishedAt: string;
}

export interface QueryRequest {
  question: string;
  scope?: Scope;
  topicHint?: string; // e.g., 'team_ferrari'
}

export interface QueryResponse {
  answer: string;
  contextUsed: KnowledgeEntry[];
}
# AI Assistance Prompts

This project was built by me and **augmented** with AI tools (Gemini / ChatGPT).  
AI was used mainly for brainstorming architecture, looking up API usage patterns, generating small code snippets, and rephrasing documentation.  
All core design decisions, integration work, debugging, and final refactoring were done manually.

Below are representative prompts (not an exhaustive log) that I used while developing  
`cf_ai_f1_2025_researcher`.

---

## 1. Architecture & Design

- "Help me sketch an architecture for a Cloudflare-based F1 2025 research assistant that uses:
  - Workers for the HTTP API,
  - Durable Objects for topic-scoped memory,
  - Workers AI (Llama 3.3) for summarization and Q&A,
  - and a Cron trigger that refreshes data every few hours."

- "I want a system where each F1 topic (season, team, driver, race) has its own memory. Propose a simple naming scheme for topic keys and how to map them to Durable Object instances."

- "Design an actor-style flow for:
  Serper → summarization with Workers AI → Durable Object storage → retrieval → answer generation.  
  I want it to feel like a research agent, not a simple chat proxy."

- "Given that this is an assignment project and not production, what is a pragmatic way to keep the architecture clean but not over-engineered?"

---

## 2. Serper & External Data Fetching

- "Show me how to call the Serper `/news` endpoint from a Cloudflare Worker using `fetch`, including:
  - setting the `X-API-KEY` header,
  - sending a JSON body with a query string,
  - and parsing the JSON result into a `RawArticle` type with `title`, `content`, `url`, and `publishedAt`."

- "I have topic keys like `team_ferrari`, `driver_hamilton`, `race_2025_r22_las_vegas`.  
  Propose search query strings for each category (season / team / driver / race) that are biased toward F1 2025 coverage and avoid old 2023/2024 results as much as possible."

- "What are common HTTP or JSON pitfalls when calling Serper from a Worker (e.g., wrong `Content-Type`, forgetting to `await response.json()`, or mixing up `q` vs `query` parameters)?"

- "Suggest a simple rate-limiting approach for a Cron job that loops over ~40 topics and calls Serper for each.  
  I’m fine with a serial loop and a short `setTimeout`-style delay to avoid hitting free-tier limits."

---

## 3. Durable Objects & Memory

- "Implement a TypeScript Durable Object class called `TopicMemory` that:
  - exposes an internal `POST /update` endpoint,
  - takes a list of raw articles,
  - summarizes them with Workers AI,
  - and appends them to a stored `entries` array with timestamps and source URLs."

- "Show a minimal Durable Object example using storage keys like:
  - `entries`: KnowledgeEntry[]
  - `lastUpdated`: ISO string  
  and how to read/write them in `fetch()`."

- "I want to store every summary as a `KnowledgeEntry` with fields:
  `id`, `topicKey`, `scope`, `type`, `summary`, `source`, `timestamp`, `createdAt`.  
  Can you suggest a clean interface definition and how to initialize default values if storage is empty?"

- "What is a simple strategy for merging new entries into existing ones in Durable Object storage, while avoiding accidental overwrites?"

---

## 4. Llama 3.3 Prompts (Workers AI)

- "Write a helper function `summarizeArticle(env, article)` using `env.AI.run` with Llama 3.3.  
  It should return a short, factual summary focused on F1 context (results, upgrades, schedule changes), and avoid opinionated wording."

- "Create a `generateAnswer` helper that:
  - takes a user question and
  - a list of `KnowledgeEntry` items,
  and sends them to Llama 3.3 with a system prompt that says:
  - answer only using the given context,
  - don’t hallucinate,
  - say explicitly if the information is not available yet."

- "Improve this system prompt so the assistant behaves like a cautious F1 2025 researcher, especially around future races that have not happened yet. It should not invent race results or championship standings."

- "What’s a simple formatting strategy for turning an array of `KnowledgeEntry` into a text block that is friendly for the model to consume as context?"

---

## 5. Routing & Topic Detection

- "I have topic keys like `team_ferrari`, `driver_hamilton`, `race_2025_r01_bahrain`, etc.  
  Propose an alias table where:
  - ‘Ferrari’, ‘SF-25’, ‘Maranello’ → `team_ferrari`
  - ‘Hamilton’, ‘Lewis’ → `driver_hamilton`
  - ‘Vegas’, ‘Las Vegas’ → `race_2025_r22_las_vegas`, and so on."

- "Write a small `resolveTopicKey(question, topicHint)` function that:
  - trusts a manual `topicHint` if it’s not `auto`,
  - otherwise tries alias matching,
  - then falls back to simple keyword matching using the last segment of the topic key,
  - and finally defaults to `season_2025`."

- "Review this routing function and point out potential edge cases where a question like ‘How did Ferrari do in Las Vegas?’ might be misrouted.  
  I’m okay with a heuristic, but I want at least the obvious cases handled."

- "Is it reasonable in this assignment context to route to only one ‘best topic’, or should I consider merging context from team + driver + race? I’m leaning toward a single-topic approach for simplicity."

---

## 6. Front-end (HTML / CSS / JS)

- "Create a minimal F1-themed chat UI in plain HTML/CSS/JavaScript that:
  - has a scrollable chat box for messages,
  - displays different bubble styles for user and agent,
  - includes a three-dot typing indicator animation,
  - and sends POST requests to `/api/query` with `{ question, topicHint }`."

- "Extend the chat UI to include a `<select>` for scope:
  - Auto-Detect Topic,
  - Season Overview,
  - Ferrari,
  - Hamilton.  
  When the user submits, pass the selected value as `topicHint` in the JSON body."

- "Under each AI response, I want to show a line like `Sources: f1.com, autosport.com` constructed from the `source` fields in the returned `contextUsed`.  
  Suggest a simple JS function that:
  - extracts the hostname from each URL,
  - de-duplicates the domains,
  - and renders a human-readable string."

- "Give me some CSS ideas to make the chat container look slightly like an F1 dashboard:  
  subtle shadows, red accent color, and a layout that stays readable on both desktop and smaller widths."

---

## 7. Debugging & Error Handling

- "I’m getting `Unexpected token < in JSON at position 0` when parsing the response from my Durable Object.  
  Here is my `/api/query` handler and the DO `fetch` implementation.  
  Can you help me spot where I might be returning a plain text response instead of JSON?"

- "My Worker logs show a 500 error with `TypeError: Cannot read properties of undefined (reading 'response')` coming from the `env.AI.run` call.  
  Given a typical Workers AI response shape, how should I safely read the model output and handle unexpected formats?"

- "Sometimes Serper returns fewer articles than expected for certain topics.  
  Suggest a defensive coding pattern so that:
  - the Cron job doesn’t crash on an empty result,
  - and the Durable Object gracefully handles the case where `articles` is an empty array."

- "When I run `wrangler dev`, CORS preflight requests are failing for my `/api/query` endpoint.  
  Here is my current `OPTIONS` handling code. Can you point out anything missing or incorrect with headers like `Access-Control-Allow-Origin`, methods, and allowed headers?"

- "I introduced a 2-second delay between Serper calls inside the Cron job using `await new Promise(resolve => setTimeout(resolve, 2000))`.  
  Is this safe inside a Worker’s `scheduled` handler, or do I need to wrap the whole loop in `ctx.waitUntil`? Please explain the correct pattern."

- "My front-end is configured with `API_URL = 'http://localhost:8787/api/query'`, but I’m still seeing `NetworkError` in the browser.  
  What are the most likely causes when using `wrangler dev` (wrong port, HTTPS vs HTTP, missing `mode: 'cors'`, etc.)?"

---

## 8. Refactoring & Code Quality

- "Review this version of `topicMemory.ts` and suggest small refactors to:
  - reduce repetition between `/update` and `/query`,
  - make error handling more explicit,
  - and keep the code readable for someone reviewing it as a take-home assignment."

- "How can I structure the imports (`Env`, `KnowledgeEntry`, `RawArticle`, `QueryResponse`) so that the type definitions stay in `types.ts`, but the implementation files (`ai.ts`, `search.ts`, `topicMemory.ts`, `index.ts`) stay easy to navigate?"

- "I want to keep the code understandable to someone skimming it quickly.  
  Recommend a consistent commenting style for Workers, Durable Objects, and front-end code that explains *what* each part does without over-commenting every line."

- "Given that this is a single developer project, what is a reasonable level of logging in the Worker and Durable Object so that:
  - it’s easy to debug,
  - but doesn’t spam the logs too much in production?"

---

These prompts reflect how AI was used as a **supporting tool** during development  
rather than as an end-to-end code generator. All final code, wiring, debugging, and  
project-specific decisions were implemented and verified by me.


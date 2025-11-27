# F1 2025 Season Personal Researcher  
Repository: `cf_ai_f1_2025_researcher`

This repo contains an **AI-powered F1 2025 knowledge agent** built entirely on Cloudflare. It runs a scheduled ingestion pipeline that pulls recent F1 news, summarizes it with Workers AI (Llama 3.3), stores it in Durable Objects, and exposes a small F1-themed chat UI for asking questions about the 2025 season.

The goal is to show how to tie together:

- Cloudflare **Workers** + **Cron Triggers**
- **Durable Objects** as long-lived, topic-scoped memory
- **Workers AI (Llama 3.3)** for summarization and question answering
- **Serper Search API** for external news
- A lightweight **HTML/CSS/JavaScript** front-end

---

## What the agent does

At a high level:

- On a schedule (every 4 hours), a Worker:
  - Iterates over a list of F1 topics (the 2025 season, all teams, all drivers, and each race).
  - Builds a search query for each topic.
  - Calls the **Serper Search API** to get recent F1 news.
  - Uses **Workers AI (Llama 3.3)** to condense each result into a short, factual summary.
  - Stores those summaries as “knowledge entries” inside a **Durable Object** bound to that topic.

- When a user opens the web UI and asks a question:
  - The browser sends the question (and an optional “topic scope” from a dropdown) to `POST /api/query`.
  - The Worker picks the most likely topic (season / team / driver / race) using simple keyword/alias rules.
  - It forwards the question to the relevant Durable Object.
  - That Durable Object loads its stored entries, sends them to Llama 3.3 as context, and asks it to answer.
  - The UI displays the answer **plus the source domains** used, so you can see roughly where the information came from.

All answers are intended to be grounded in what has been ingested and stored. When the context does not contain the answer, the model is instructed to say it does not have that information yet, instead of guessing.

---

## Architecture

### 1. Worker entrypoint (`src/index.ts`)

The main Worker has two responsibilities.

#### a. Handling user queries (`/api/query`)

- Exposes `POST /api/query`.
- Expects a JSON body:

  ```json
  {
    "question": "How is Ferrari doing this season?",
    "topicHint": "auto"
  }
  ```

- Uses a routing function to decide which topic should handle the question:
  - If topicHint is set to a known topic key (e.g. `season_2025`, `team_ferrari`, `driver_hamilton`), that value is trusted.
  - Otherwise, it scans the question for aliases like “Ferrari”, “Hamilton”, “Bahrain”, etc. and maps them to internal topic keys using a `TOPIC_ALIASES` table.

- Once it has a topic key, it:
  - Uses `env.TOPIC_MEMORY.idFromName(topicKey)` to get the Durable Object id.
  - Calls that object’s internal `/query` endpoint with the user’s question.
  - Returns the Durable Object’s JSON response back to the front-end.

#### b. Scheduled ingestion (Cron trigger)

- A Cron trigger is configured to run every 4 hours.
- In the `scheduled` handler:
  - The Worker loops over a constant `TRACKED_TOPICS` array that includes:
    - The season (`season_2025`)
    - All 10 teams (`team_red_bull`, `team_ferrari`, …)
    - All 20 drivers (`driver_verstappen`, `driver_hamilton`, …)
    - All planned 2025 races (`race_2025_r01_bahrain`, …, `race_2025_r24_abu_dhabi`)
  - For each topic:
    - Calls fetchF1NewsForTopic(`env`, `topicKey`) to query Serper.
    - If any articles are returned, it sends them to that topic’s Durable Object via `/update`.
    - Waits briefly between topics to avoid hitting Serper rate limits.
- Over time, each topic’s Durable Object accumulates its own history of summarized news entries.


---

### 2. Durable Object: topic memory (src/topicMemory.ts)

Each F1 entity (for example, “2025 season”, “Ferrari”, “Lewis Hamilton”, “Bahrain GP”) is backed by a `TopicMemory` Durable Object instance.

It supports two internal routes.

`POST /update` – **called by the ingestion pipeline**
- Input: `{ articles: RawArticle[], topicKey: string }`.
- For each `RawArticle`:
  - Calls `summarizeArticle` (Workers AI, Llama 3.3) to get a short F1-focused summary.
  - Wraps that summary into a `KnowledgeEntry` object containing:
    - `id`(UUID)
    - `topicKey`
    - `scope` (currently a simple label such as 'season', which can be refined)
    - `type` (e.g. `'news'`)
    - `summary`
    - `source` URL
    - timestamps (`timestamp`, `createdAt`)
- Appends new entries to the stored `entries` array and updates a `lastUpdated` value.
- Responds with a JSON payload indicating how many entries were added.

`POST /query` – called when a user asks a question
- Input: `{ question: string }`.
- Loads all stored `KnowledgeEntry` items for this topic.
- Uses the full list as context (for this assignment-sized project).
- Passes that context and the question to `generateAnswer` in `src/ai.ts`.
- Returns a `QueryResponse`:

```ts
{
  answer: string;
  contextUsed: KnowledgeEntry[];
}
```

Durable Object storage is the system of record; there is no external database.

---

### 3. AI helpers (`src/ai.ts`)

AI interaction is wrapped in two helper functions:
- `summarizeArticle(env, article)`
  - Uses `env.AI.run` with Llama 3.3 (such as `@cf/meta/llama-3.3-70b-instruct-fp8-fast`).
  - The prompt asks the model to write a concise, factual summary suitable for storing as a database entry, focusing on F1-specific details (results, upgrades, context for 2025).

- `generateAnswer(env, question, context)`
  - Serializes `context` entries into a text block (timestamp, type, summary per line).
  - Sends a system prompt instructing the model that:
    - It is an F1 2025 research assistant.
    - It must answer only using the provided context.
    - If the context does not contain the answer, it should say that the information is not available yet.
  - Returns the model’s answer string (or a simple fallback error message on failure).

---

### 4. Search / ingestion layer (`src/search.ts`)

The search helper is responsible for talking to Serper and adapting its response for the rest of the system.
- Builds a query string based on the topic key, for example:
  - Drivers → driver name + “F1 2025”.
  - Teams → team name (and sometimes car code) + “F1 2025”.
  - Races → circuit / Grand Prix name + “F1 2025”.
- Calls the Serper Search API using the configured SERPER_API_KEY.
- Trims the result list to a manageable number of articles per topic.
- Normalizes each item into a RawArticle with title, content, url, and publishedAt.

All Serper-specific details live in this module so the rest of the code can work with simple RawArticle objects.

---

### 5. Types ('src/types.ts')

Key shared types:
- `Env` – Worker environment bindings (`AI`, `TOPIC_MEMORY`, `SERPER_API_KEY`).
- `Scope` – simple string union: `'season' | 'team' | 'driver' | 'race'`.
- `KnowledgeEntry` – the normalized memory unit stored per topic:
  - `id`, `topicKey`, `scope`, `type`, `summary`, `source`, `timestamp`, `createdAt`.
- `RawArticle` – normalized Serper result:
    - `title`, `content`, `url`, `publishedAt`.
- `QueryRequest` / `QueryResponse` – shapes of the request body for `/api/query` and the response from the Durable Object.

---

### 6. Front-end (public/index.html, public/style.css, public/app.js)

The front-end is intentionally minimal and dependency-free.

`index.html`
- Single-page layout that includes:
  - A header with “F1 2025 Researcher”.
  - An initial assistant message explaining what the bot does.
  - A scrollable `#chat-box` for messages.
  - An input area with:
    - A `<select>`for topic scope:
      - `Auto-Detect Topic`
      - `Season Overview`
      - `Ferrari`
      - `Lewis Hamilton`
    - A text input for the user question.
    - A “Send” button.

`style.css`
- Styles the UI with an F1-inspired look:
  - Centered card layout on a light background.
  - Separate bubble styles for user and agent messages.
  - A three-dot typing indicator animation.
- The chat panel is scrollable; messages appear with simple spacing and hierarchy.

`app.js`
- Defines a configurable `API_URL` pointing at the Worker’s `/api/query` endpoint.
- On “Send” or Enter:
  - Renders the user’s message into the chat.
  - Shows the typing indicator.
  - Sends a `POST` request:

```js
fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question, topicHint: scope })
});
```

- When the Worker responds:
  - Hides the typing indicator.
  - Renders the agent’s `answer`.
  - Extracts `contextUsed` from the response and displays a `"Sources: …"` line built from the `source` URLs (domains only, de-duplicated).
There is no front-end build step; everything under `public/` is static.

---

## Relation to the Cloudflare AI optional assignment
This project is structured to align with the Cloudflare AI optional assignment:
- **LLM**  
Uses **Workers AI** with **Llama 3.3** for both ingestion (news summarization) and question answering.
- **Workflow / coordination**  
Uses a **Worker + Cron Trigger + Durable Objects** pipeline to orchestrate ingesting external data and updating topic-scoped state.
- **User input via chat**
Provides a simple web chat interface (suitable for **Cloudflare Pages**) that sends user questions to the Worker over HTTP.
- **Memory / state**
Implements persistent, topic-scoped memory via **Durable Objects**, which store arrays of `KnowledgeEntry` objects and a `lastUpdated` timestamp per topic.  
The repository name is prefixed with `cf_ai_` as required.  
A `PROMPTS.md` file is included and documents sample prompts used with AI coding assistants during development (architecture design, Serper integration, Durable Object patterns, Workers AI helpers, and README drafting).


---

## Project scripts and tooling

The project uses TypeScript and Wrangler, with the following npm scripts defined in `package.json`:

```js
"scripts": {
  "deploy": "wrangler deploy",
  "dev": "wrangler dev",
  "start": "wrangler dev"
}
```

- `npm run dev` / `npm start` – run the Worker locally with Wrangler dev.
- `npm run deploy` – deploy the Worker to Cloudflare.

Dev dependencies include TypeScript, Wrangler, and Cloudflare Workers type definitions.

---

## Running locally
### 1. Install dependencies
```bash
npm install
```

### 2. Configure Serper API key

Set the `SERPER_API_KEY` secret for the Worker:

```bash
npx wrangler secret put SERPER_API_KEY
# Paste your Serper key when prompted
```

For quick experiments you can also populate SERPER_API_KEY under [vars] in wrangler.toml, but using wrangler secret is recommended.  

### 3. Start the Worker in dev mode
```bash
npm run dev
# or
npm start
```

Wrangler will print a dev URL, for example:
- `http://localhost:8787`

Make sure API_URL at the top of `public/app.js` matches this URL:  
```js
const API_URL = 'http://localhost:8787/api/query';
```

### 4. Open the UI

Open `public/index.html` directly in your browser, or serve the `public/` folder with any static file server. You should see the F1-styled chat and the initial assistant message.

Try queries such as:
- “What’s the latest news about Ferrari in the 2025 season?”
- “How is Lewis Hamilton doing so far in 2025?”
- “Summarize the most recent Las Vegas Grand Prix.”

Right after startup, the knowledge base may be sparse. As the Cron job runs and ingests more articles per topic, the answers become richer and more specific.

During development, you can also manually trigger the `scheduled` handler from Wrangler / Cloudflare tools if you do not want to wait for the real 4-hour schedule.

---

## Deploying
### Deploy the Worker
```bash
npm run deploy
```

This deploys:
- The main Worker (`src/index.ts`).
- The `TopicMemory` Durable Object.
- The Cron schedule defined in `wrangler.toml`.

Run `npx wrangler secret put SERPER_API_KEY` in the target Cloudflare account if you have not already configured the secret there.

### Deploy the front-end (Cloudflare Pages)

1. In the Cloudflare dashboard, create a new **Pages** project.
2. Use this repo as the source and configure the output directory as `public/` (or upload the `public` folder).
3. Update `API_URL` in `public/app.js` to point at your deployed Worker, for example:

```js
const API_URL = 'https://<your-worker-subdomain>.workers.dev/api/query';
```

4. Redeploy the Pages project so the chat UI sends requests to the live Worker.

---

### Limitations and possible extensions
- The project is aimed at F1 2025 news and general context, not official timing or historical statistics.
- Topic detection uses hand-written aliases and keyword matching. It works for common phrases (“Ferrari”, “Hamilton”, “Las Vegas”), but it is not a full natural-language router.
- All memory resides inside Durable Objects. Over a long season, you may want to:
  - Cap the number of `KnowledgeEntry` items per topic.
  - Introduce semantic search (embeddings + a vector store) to select only the most relevant entries for context.
- Multi-topic questions currently route to a single “best” topic. A more advanced version could fetch context from multiple topics (e.g. team + driver + race) and merge them before calling the LLM.

Even with these constraints, the repo demonstrates a full, Cloudflare-native AI agent: it ingests external data on a schedule, stores topic-scoped memory, routes user questions, uses Llama 3.3 with explicit context, and exposes everything through a simple, inspectable web UI.

```makefile
::contentReference[oaicite:0]{index=0}
```
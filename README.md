# F1 2025 Season Personal Researcher (cf_ai_f1_2025_researcher)

An autonomous, AI-powered research assistant dedicated strictly to the Formula 1 2025 season. This application leverages Cloudflare's full stack (Workers, Durable Objects, Workers AI) and the Serper API to self-update, store knowledge, and answer user questions with factual context.

## Features

* **Self-Updating Knowledge:** A Cron trigger automatically runs every 4 hours, fetching real F1 2025 news via Serper API.
* **Topic-Based Memory:** Uses Durable Objects to maintain isolated, persistent knowledge bases for the Season, Ferrari, Hamilton, and the Bahrain GP.
* **RAG Answering:** Answers user questions using *only* the stored knowledge to prevent hallucinations.
* **Chat Interface:** A simple web UI for interacting with the agent.

## Architecture Overview

1.  **Cloudflare Worker (`src/index.ts`):** Orchestrates the workflow. Handles HTTP requests from the UI and `scheduled` events from Cron.
2.  **Durable Objects (`src/topicMemory.ts`):** Acts as the database. Stores arrays of summarized knowledge entries per topic.
3.  **Workers AI (Llama 3.3):** Used for two distinct tasks:
    * Summarizing raw news articles into concise knowledge entries.
    * Generating answers to user questions based on retrieved context.
4.  **Serper API (`src/search.ts`):** Provides real-time access to F1 news from trusted domains (`formula1.com`, `autosport.com`).
5.  **Cloudflare Pages:** Hosts the static frontend (`public/`).

## Assignment Requirements Mapping

* **LLM:** Uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via Workers AI binding.
* **Workflow:** Implements `Cron -> Worker -> Serper -> AI -> Durable Object` automation.
* **User Input:** Chat UI hosted on Pages interacts with Worker API.
* **Memory:** Durable Objects provide persistent, stateful storage.

## Running Locally

1.  **Prerequisites:** Node.js, npm, and `wrangler` CLI installed.
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Configure API Key:**
    Get a free key from [serper.dev](https://serper.dev) and add it to `.dev.vars` or `wrangler.toml`:
    ```toml
    [vars]
    SERPER_API_KEY = "your_real_key_here"
    ```
4.  **Run Development Server:**
    ```bash
    npx wrangler dev
    ```
    *Note: The Cron trigger can be tested by pressing 'L' in the wrangler console to simulate a scheduled event.*

## Deploying

1.  **Deploy Backend:**
    ```bash
    npx wrangler deploy
    ```
2.  **Deploy Frontend:**
    Upload the `public` directory to a Cloudflare Pages project.

## Limitations & Future Work

* Currently tracks a limited set of topics (Season, Ferrari, Hamilton, Bahrain).
* Topic routing is based on simple keyword heuristics.
* Future improvements could include Vectorize (Vector DB) for semantic search over larger knowledge bases.
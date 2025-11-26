# AI Assistance Prompts

This project was developed with the assistance of AI tools (Gemini/ChatGPT). Below are examples of prompts used during the development process to generate code skeletons and architectural ideas.

## Development Prompts

* "Design a Cloudflare Worker + Durable Objects architecture for an F1 2025 research assistant that uses Workers AI and Cron triggers."
* "Show me how to call the Serper API's `/news` endpoint from a Cloudflare Worker using `fetch`, and how to map the JSON response into a TypeScript `RawArticle` interface."
* "Implement a Durable Object class in TypeScript called `TopicMemory` that handles a `POST /update` to store new data and a `POST /query` to answer questions using context."
* "Write a `wrangler.toml` configuration that binds a Durable Object, Workers AI, an environment variable for `SERPER_API_KEY`, and a Cron trigger running every 4 hours."
* "Write a helper function using `env.AI.run` with Llama 3.3 that takes a user question and a list of context strings, and returns an answer based ONLY on that context."
* "Create a minimal, dependency-free HTML/JS chat interface that sends POST requests to `/api/query` and renders User and Agent messages bubbles."
* "Draft a README for a Cloudflare AI project named `cf_ai_f1_2025_researcher` that clearly maps the features to the specific assignment requirements (LLM, Workflow, Memory, UI)."
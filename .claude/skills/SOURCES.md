# Installed dependency skills

Installed into this project's `.claude/skills/` directory using the skill-installer GitHub helper with explicit commit references. Existing `nestjs`, `react`, `resume-persistence`, `resume-ai-workflow`, and `resume-documents` skills were left intact. No application packages, MCP servers, or global skills were installed.

## LangChain and LangGraph

Source: [langchain-ai/langchain-skills](https://github.com/langchain-ai/langchain-skills/tree/88df7d9b0cf8fedf40b99c1de806135fc2e2582d/config/skills).
Revision: `88df7d9b0cf8fedf40b99c1de806135fc2e2582d`.

Installed upstream directories without modification:

- `langchain-dependencies`
- `langchain-fundamentals`
- `langchain-middleware`
- `langgraph-fundamentals`
- `langgraph-persistence`
- `langgraph-human-in-the-loop`

These include both Python and TypeScript material. Use TypeScript guidance for CVantage. Deep Agents, RAG, deployment CLI, hosted services, and standalone quickstart scaffolds are outside the current implementation plan and were not installed.

## MongoDB

Source: [mongodb/agent-skills](https://github.com/mongodb/agent-skills/tree/1e72df255e54e81eff078054c2cfb2b5d8c13503/skills).
Revision: `1e72df255e54e81eff078054c2cfb2b5d8c13503`.

Installed upstream directories without modification:

- `mongodb-connection`
- `mongodb-schema-design`
- `mongodb-query-optimizer`

License: Apache-2.0; the upstream license is retained in [MONGODB-LICENSE.txt](MONGODB-LICENSE.txt). MCP-dependent diagnostics require separately configured tools; installation of these instructions does not connect to a database or enable Atlas services.

## Coverage boundaries

- Existing NestJS and React skills cover the application frameworks and their TypeScript/Vite conventions.
- The official [BerriAI/litellm-skills](https://github.com/BerriAI/litellm-skills/tree/b13e7fc1bf2c3149625bcf5964fee2881fd3d027) collection was inspected. It manages live proxy users, keys, teams, models, and other administrative resources, so it was not installed for client integration. The existing `resume-ai-workflow` skill continues to cover this project's LiteLLM integration boundary.
- Document parser/rendering libraries have not yet been selected. Add library-specific guidance when those dependencies are chosen rather than installing skills for speculative packages.
- Upstream skills remain unmodified. Apply product constraints through `AGENT.md` and the existing project skills; review upstream changes before replacing a pinned installation.

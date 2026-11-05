# Configuration

Node.js 24 is required for the native SQLite vector cache. Keep all services on the same persistent machine for this release.

| Variable | Default | Purpose |
| --- | --- | --- |
| PAYLOAD_SECRET | Generated `apps/cms/.local-secret` | Session signing; keep stable and private |
| PAYLOAD_SCHEMA_PUSH | `0` at runtime | Seed enables it only for a fresh database |
| RELYON_FRONTEND_URL | `http://localhost:3000` | CMS preview base URL |
| OLLAMA_URL | `http://127.0.0.1:11434` | Local-only inference service |
| EMBEDDING_MODEL | `nomic-embed-text` | Embedding model; re-index after changing |
| SEMANTIC_DATA_DIR | `./.semantic` relative to CMS | Derived vector index and persistent queue |

Environment variables must be applied to both CMS and worker. Example shell configuration:

```sh
export EMBEDDING_MODEL=nomic-embed-text
npm run dev
```

The launch scripts inherit environment variables; they do not implicitly load `.env` files. Never commit `.local-secret`, `.env`, databases, sessions, or model files. `.env.semantic.example` is a reference only.

The frontend proxy currently expects Payload at port 3001. Live Preview expects localhost ports 3000/3001. Changing ports/domains requires updating both the proxy and explicit preview-origin allowlists in `VisualEditBridge.tsx` and the browser bridge. See deployment documentation before doing so.

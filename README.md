# Relyon Dev + On Site

Relyon Dev's local website and **On Site**, its Payload CMS administration workspace.

**Version:** 0.1.0 prerelease · **Runtime:** Node.js 24 LTS · **CMS:** Payload 3.x / Next.js · **Storage:** SQLite · **Semantic search:** local Ollama

This repository contains the editable CMS, website server, browser content bridge, a content export, and setup/verification scripts. The compiled website and original media are distributed in the matching public GitHub release asset. The original Next.js source of the downloaded landing site is not available.

## Quick start

Install Node.js 24 LTS and Git. Public release downloads do not require a GitHub login.

```sh
git clone https://github.com/relyondev/relyondev-site.git
cd relyondev-site
npm run setup
npm run dev
```

Setup downloads and verifies `v0.1.0` assets, installs locked CMS dependencies, creates a unique local secret, initializes an empty database, and imports content/media with remapped relationships. It does not import administrator credentials. Open [On Site](http://localhost:3001/admin) to create your first administrator.

- Website: http://localhost:3000
- Admin: http://localhost:3001/admin
- Ollama: http://127.0.0.1:11434

Ports 3000 and 3001 must be free. The repository launcher binds both apps to loopback. The current development copy can remain in its original directory; do not run both copies on the same ports simultaneously.

## Local AI search

Install [Ollama](https://docs.ollama.com/quickstart), keep its local service running, and download the model:

```sh
ollama pull nomic-embed-text
```

The launcher starts the indexing worker. It indexes English and Indonesian text, retries failures, and repairs missed changes periodically. The website/CMS can be used while indexing runs. Open **AI content search** on the dashboard; results link to the native editor. Re-indexing reuses unchanged vectors.

## Included content

| Type | Entries |
| --- | ---: |
| Media | 559 |
| Site Pages | 76 |
| Posts | 9 |
| Projects | 50 |
| Testimonials | 3 |
| Reusable sections | 3 |
| Page templates | 3 |
| Globals | Homepage and Site Builder |

Published/draft status and both locales are preserved. Media search uses filenames/alt text, not image recognition. Existing sample project material remains part of this prerelease.

## Commands

```sh
npm run setup       # Fresh install or resume setup; preserves completed seeded records
npm run dev         # Website, CMS development server, indexing worker
npm test            # Semantic lifecycle tests, TypeScript, repository checks
npm run build       # Validate website snapshot and build CMS
npm start           # Website, built CMS, indexing worker
```

Dependencies are installed under `apps/cms`; there are no root npm dependencies. `npm run setup` is the entry point, rather than a root `npm install`. No external AI API key is required. See [configuration](docs/CONFIGURATION.md) for environment variables.

## Editing workflow

Edit in On Site, then publish models that support Draft & Publish. Open website pages refresh their existing CMS content routes every 15 seconds while visible and when focused. Live Preview uses the existing iframe bridge. Site Pages and Globals are directly editable live content; Posts/Projects/Testimonials support drafts.

The CMS is the source of truth. The JSON export is a starting dataset, not a continuously synchronized backup. Re-running setup deliberately preserves already imported records. See [content and backup](docs/CONTENT.md).

## Structure

```text
apps/web/       Node server and editable brand/content bridge scripts
apps/cms/       Payload schemas, On Site UI, hooks, search and worker
content/        Seed JSON; media source restored from release
scripts/        Setup, launch, build helpers, verification
.github/        Continuous integration
```

## Release status

This is a working development prerelease, not a public-business-launch certification. The contact server reports delivery unavailable; legal/sample material needs review; full source-based visual page building is not implemented. The site uses a compiled snapshot with DOM content bindings. Some external navigation is intentionally blocked under the standalone policy.

A GitHub repository/release stores and distributes the project. It does not itself host the live Node/Payload services. GitHub Pages cannot run this backend. See [deployment](docs/DEPLOYMENT.md), [architecture](docs/ARCHITECTURE.md), [release notes](CHANGELOG.md), and [third-party notices](THIRD_PARTY_NOTICES.md).

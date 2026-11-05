# Running beyond local development

This release targets a persistent Node.js 24 host. Use the documented local setup first, then run `npm run build` and `npm start`. The launcher intentionally binds ports 3000 and 3001 to 127.0.0.1. A host reverse proxy can provide HTTPS, but this release still has explicit localhost preview origins that must be configured for the target domain.

Required persistent data: CMS SQLite database, uploads, signing secret, and seed manifest. Run one content database instance on a local disk, with a supervised CMS, website server, embedding worker, and local Ollama service. SQLite is not a shared/network filesystem deployment design. A stateless/serverless host will require storage/database and indexing changes.

Before a public launch:

1. Configure the public URLs and preview-origin allowlists together. Keep CMS API proxies server-side.
2. Configure account roles and production authentication policy; all Users currently act as trusted admins for re-indexing.
3. Add a real contact delivery adapter and verify email delivery. Current contact requests fail explicitly.
4. Replace/review sample projects, testimonials, biography, legal pages, domain ownership, and social links.
5. Decide which outbound links should be allowed; the current standalone navigation policy blocks external links.
6. Configure HTTPS, process supervision, backups, and restore testing.
7. Evaluate search quality for both languages and index performance on the deployment machine.

GitHub Pages can serve static files but cannot run Payload, the Node proxy, SQLite writes, or Ollama. Publishing this repository and release is not a hosted website deployment. No hosting/domain configuration is changed by the GitHub release.

# Vercel website deployment

The public website is deployed as a snapshot to the `relyondev-site` project in the `relyondev` Vercel team. This deployment includes compiled pages, cached images, uploaded media, and the current public `/content/*` responses exported from the local CMS.

It does not host the Payload admin, SQLite database, Ollama model, or indexing worker. Local CMS edits do not automatically update this snapshot. Export the public content again and redeploy to publish subsequent edits. The existing contact form remains unconfigured and returns an explicit error.

Deployment preparation uses the website release assets as `public/`, with the current brand scripts applied. The serverless adapter in `deployment/vercel/route.js` redirects image and content requests to the exported static files. Generated image/cache/media maps sit alongside `api/` in the deployment directory. `deployment/vercel/vercel.json` records the page and React Server Component routing configuration.

Do not import the repository root into Vercel with default Next.js detection: the full CMS requires persistent storage and a separate AI runtime. A future complete hosted CMS integration needs a supported persistent database, upload storage, queue execution, and embedding provider.

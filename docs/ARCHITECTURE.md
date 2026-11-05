# Architecture

The public app is a compiled website served by `apps/web/server.mjs`. Browser scripts under `apps/web/brand` apply CMS content to the preserved layout and are copied into the snapshot by setup. The snapshot build preserves serialized Next.js scripts; arbitrary text substitutions inside those records can break hydration.

On Site runs Payload 3.x inside Next.js. Payload owns `relyon.sqlite` and uploaded `media/`. It includes Site Pages, Posts, Projects, Testimonials, Reusable Sections, Page Templates, Media, and Homepage/Site Builder globals. Existing field-level editors, blue On Site branding, navigation, themes, and live preview are retained.

The web server proxies selected published content through `/content/*`. The frontend refreshes that content without full-page navigation. Site Builder's appended sections and shared settings retain their own existing rendering behavior. There is no independent legacy database to replicate into.

Semantic hooks enqueue both locales when searchable content changes. The worker reads current Payload records and sends short overlapping chunks to local Ollama. Normalized vectors are stored in a separate SQLite cache. Hash-based reuse, revision compare-and-swap, retry backoff, worker leases, and periodic reconciliation handle restarts and stale jobs. Search rechecks permissions and current hashes before returning excerpts.

Vector writes are deliberately outside Payload content transactions; the index is eventual derived data. Search uses exact cosine scanning, suitable for this initial corpus but not a large distributed corpus. Changing weights under the same model tag is not detectable; change the tag and re-index.

The AI search UI returns links to native editors. It is not an autonomous editing agent, an image search engine, or a complete drag-and-drop visual builder.

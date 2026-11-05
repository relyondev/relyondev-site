# Content import, updates, and backups

`content/site-content.json` contains a versioned content export. Authentication collections, preferences, sessions, API tokens, and historical versions are excluded. The public release assets contain the compiled website and media files.

The initial seed imports media before relationships, remaps original IDs to the new database IDs, restores both locales and publication status, and records progress in `apps/cms/.seed-map.json`. Reruns skip completed entries so editor changes are retained. Keep that manifest with the database. The initial seed is not a general-purpose ongoing synchronization tool.

Additional legacy JSON can be imported with `apps/cms/scripts/sync-existing-data.ts`. Its contract is `{ "records": [{ "collection": "projects", "locale": "en", "data": { "sourceKey": "stable-key", "title": "Title" } }] }`. Run from `apps/cms` using Node 24. It defaults to dry run when `--input` is supplied. Add `--apply` to create records. Existing records are preserved unless `--update-existing` and a matching `expectedUpdatedAt` are supplied. Relationships must use current Payload IDs. XML and remote media download are not supported.

## Backup

Stop the CMS and worker before making a filesystem backup, or use SQLite's online backup facility. Back up these together to private storage:

- `apps/cms/relyon.sqlite` (include WAL files if copying a running database; prefer SQLite backup)
- `apps/cms/media/`
- `apps/cms/.local-secret`
- `apps/cms/.seed-map.json`

The `.semantic` cache can be regenerated. Do not upload these private backups to the repository or release. The included seed does not contain future edits. Keep encrypted off-machine backups for any real production use.

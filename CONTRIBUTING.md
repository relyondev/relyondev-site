# Contributing

Use Node.js 24, complete README setup, and work on a branch. Run `npm test` and `npm run build` before submitting changes. Explain user-visible behavior and verification in the pull request.

Do not edit generated React flight records by raw text replacement. Keep browser bridge source under `apps/web/brand`; setup copies it into `dist/brand`. Do not commit runtime databases, generated build directories, dependencies, or credentials.

When schema changes require a migration, test against a private backup and include the migration and rollback plan. Do not enable automatic schema push against an existing production database.

For a new release, export reviewed content without authentication records, build the asset archive, calculate SHA-256, update version/changelog, pass CI, then publish a matching tag and assets. Archive paths must be relative (`apps/web/dist` and `content/media`) with no parent traversal or symlinks.

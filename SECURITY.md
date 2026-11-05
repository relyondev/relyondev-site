# Security

Do not put passwords, API keys, `.local-secret`, database backups, sessions, or personal account exports in issues or commits. Report security issues privately to the repository owner through an existing private contact channel.

The current release is intended for trusted local administrators. Search endpoints authenticate the user, enforce same-origin mutations, and resolve content permissions before returning excerpts. Re-index access currently treats every Payload Users account as a trusted administrator. Some content collections intentionally allow public reads.

This repository and its release assets are public. Do not add private content or personal account exports to future releases. Public source distribution is not a public-hosting hardening guarantee.

Release audit (2026-11-06): zero high/critical findings after compatible updates. Eleven low/moderate findings remain in transitive Payload/Drizzle tooling dependencies, including deepmerge and the older esbuild toolchain. No automatic fix was available for those dependency chains. Recheck advisories before a public deployment; the release remains a prerelease.

# Taraoke — Claude Code project rules

Instant karaoke rooms PWA — "Tara, kanta na!" (name only — UI copy is plain English,
see AGENTS.md).

@AGENTS.md

## Media policy (hard rule)

- **Never ever read media files** — images, screenshots, PDFs, video, any binary/visual
  asset. It floods and corrupts the session context. Applies even if the user attaches
  a path or the task seems to need it; describe or reason about visuals without reading
  them, and let the user's own eyes verify.

## Git hosting (hard rule)

- **Never open PRs. Never touch Forgejo** — no Forgejo MCP calls for issues, PRs,
  releases, or comments. All git work stays local: commit and merge to master only,
  when the user asks.

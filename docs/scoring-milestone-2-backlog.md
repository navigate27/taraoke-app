# Song scoring — milestone 2 backlog (deferred)

- **Date:** 2026-09-24
- **Status:** Deferred by Ivan — "im good with this current design — just dont
  implement yet in the main app." Milestone 1 (engine + Scoring Lab) is shipped
  on master; nothing below is wired into the room view.

## What milestone 1 shipped (for context)

- Commitment-based scoring engine in `src/client/src/scoring/` — VoiceScorer
  orchestration, CREPE-tiny analyzer in a Web Worker (TFJS WASM, model
  self-hosted), heuristic fallback, metric accumulators, videoke curve.
- Dev page at `/#/score-lab` (mic check, live meters, pitch trace, running
  score, "End run & score"). Server untouched.
- Design authority: `docs/superpowers/specs/2026-09-24-scoring-design.md`
  (§2 architecture, §3 score, §6 lab).

## Milestone 2 — room integration (when greenlit)

- **ScoreReveal overlay** in the host player panel: count-up score, grade
  badge, flair per `DESIGN_SYSTEM.md`; shows `addedBy` nickname; auto-dismiss
  ~6 s or host tap. Reveal at natural song end only — never for skipped songs,
  denied mic, or mid-song host leave (spec §4, §7).
- **Always-on arming + permission flow** on first play of a session; denied
  mic = scoring off, no reveal, everything else normal.
- **Player lifecycle wiring:** accumulate only while playing; host pause
  freezes; repeat-one re-scores each play; skip discards the run.
- **Docs updates (do first, per AGENTS.md):** PRD §3 (remove scoring from
  non-goals), PRD §5.7 (new section), PRD §10 (trim backlog line),
  `DESIGN_SYSTEM.md` (ScoreReveal treatment), `TECH_STACK.md` (CREPE-tiny,
  WASM backend, worker).

## Small items parked from the final review

- **Worker `reset` message:** spec §2.3 "reset between plays" needs the
  analyzer-side state (noise floors, pitch accumulators) resettable via the
  worker protocol (`init`/`pcm` today — add `reset`).
- **App.tsx hooks guard:** the `#/score-lab` early return sits before the
  component's `useState`s — an in-place hash change from home would throw a
  hooks-order error. Needs a remount guard when wired into the real router.
- **Mid-run fallback semantics (documented in `VoiceScorer.enterFallback`):**
  a worker crash mid-song rebuilds metrics, so the final score reflects only
  post-fallback frames. Room integration must accept or special-case this.

## Backlog candidates (heard in review, not committed)

- **Owned-file note-chart scoring** — SingStar-style note markers need the
  reference melody; impossible with a YouTube-only catalog (audio untouchable).
  Would require a licensed/owned karaoke file library + a different player.
- **Crowd-built references** — compare later plays of a song against the pitch
  contour of the best previous performance (first play stays commitment-based).

## Tuning knobs (if the lab feels off)

- Weights, floor, curve exponent, grade thresholds: `src/client/src/scoring/curve.ts`.
- Phrase target, streak/decay/tail constants: `src/client/src/scoring/metrics.ts`
  (`PHRASE_TARGET_SEC` exported — ScoreLab imports it).
- Frame voicing gates: analyzers in `scoring/heuristic/` and `scoring/crepe/`.
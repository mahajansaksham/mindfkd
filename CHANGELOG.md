# Releases

## 1.1.1 — 30 September 2026

Restore the prior centered UI and original gameplay sizes/spacing at the owner’s request. Keep Daily, friend challenges, Analytics and the answer-selection fix. No database changes.

## 1.1.0 — 30 September 2026

- Shared Daily: one official account attempt per UTC day, immutable escalating sequence, daily rankings and spoiler-free results.
- Asynchronous friend challenges: shared questions/options, guest acceptance, server-validated comparisons, public invite links and rematches.
- Compact desktop and mobile core layouts; next-question answer buttons no longer inherit a filled hover appearance.
- Central survival configuration and combo heat without changing historic scoring.
- Optional consent-gated GA4 configuration; private invite paths sanitized in analytics.
- Additive challenge storage migration 0006. Existing accounts, live competitions, category/overall boards and histories retained.
- Continuity/security/analytics/question/scale documentation updated. Production receipt is supplied in the delivery report.

Known limits: 1,170 approved questions, not 100,000; no scheduled external-question acquisition job; casual guest identities and scores are not prize-grade anti-cheat; production cross-region latency and traffic capacity require load testing.

## 1.0.0 / hosted version 6 — 29 September 2026

Category-only all-time boards, team naming, WebSocket-first live play, compact live arena and exact SQL no-repeat history. See PROJECT_LOG.md for earlier releases and rationale.

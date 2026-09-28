# MINDFKD project log

Update this file with every material implementation and publication. Record decisions, migrations, verification, limitations and follow-up work. Never include credentials or private player data. Deployment receipts live in the delivery report because the final commit is known only after packaging.

## 2026-09-28 — Categories, security and live competition

- Replaced ENDLESS V0 with **THINK FAST. LAST LONG.**
- Added Sports, Politics, History, Geography and Science, plus Mixed. Overall ranks each player's single highest score and displays its category, per the owner's decision. Category boards retain each player's best in that category. Season 3 separates the changed pools; past seasons/results remain available.
- Bank 2026-09-28.2: 1,146 questions including 104 authored additions to cover every category/tier. Lazy-loaded guest catalog and cached tier indexes reduce initial work. Exact history remains the authority; a Bloom filter is not necessary at this size. See QUESTIONS.md and SCALING.md.
- Security changes: remove internal player IDs from public DTOs; single-use login nonces; atomic username creation and hourly run cap; bounded streamed JSON input; validated identifiers/genres/versions; security headers. `isMe` is a server-derived UI flag, never a permission. Details and limits in SECURITY_AUDIT.md.
- Live competition: 1v1 and two teams of unequal size. Team scores are **summed**, never averaged. Larger teams can have an advantage, deliberately disclosed. Each player shows correct/wrong/unanswered counts. Operational launch cap: 50 per side. Ten shared questions, ten seconds each, two-second reveal, five-second countdown. Everyone must be ready; host starts.
- Fixed-answer points remove speed bonuses from competition. Server clock, shared deck, immutable teams after start, one answer per player/round, simultaneous answer reveal. Profile records include 1v1 wins/losses/draws and team wins/losses. Draws do not count as losses.
- SSE pushes room changes with reconnect and a one-second fallback refresh. Server checks D1 every 500ms per connected stream; this is a bounded initial architecture, not proof of low latency at large scale. See LIVE_MATCHES.md for scaling gate and transport limitations.
- Migrations 0002 adds genres/nonces; 0003 adds matches/members/answers. Additive migrations preserve existing users, runs and history.
- Verification: automated SQLite integration covers access boundaries, scoring, repeat submissions, shared timers, team totals, stream payloads and once-only results. Production build/typecheck/lint and browser verification are recorded in the release report.

## Existing baseline retained

30-second solo start, direct-tap choice answers, Google sign-in, public shareable profiles, follows, guest-visible leaderboards and ceo@mindfkd.com contact link. Optional analytics remains consent-gated and inactive without provider configuration. Prior source baseline: 90f7e5fef162b2e5bb48bdf15ac5a29f81432329.

## Open operational work

Calibrate tiers with sufficient real-player data, independently audit question facts, add edge abuse controls/monitoring, validate live-match latency with real accounts across regions, and load-test before raising room/traffic limits. For million-question ingestion, migrate the catalog to indexed server storage before importing that volume. No unattended content publishing or recurring monitoring is installed.

# MINDFKD project log

## 2026-09-30 — 1.1.1 restore the prior visual layout

At the owner’s request, restored the pre-1.1 centered homepage, original typography/spacing, large clock, live-competition link and footer. Removed compact-layout overrides on RUN/results and the global body/footer changes. Daily/friend modes and Analytics remain available; unobtrusive footer links lead to the new modes. The next-question neutral-hover bug fix remains. This intentionally restores the earlier scrolling behavior. No database, scoring, authentication or question-history changes. Verification and publication receipts are in the delivered release report.

## 2026-09-30 — Release 1.1.0: Daily, friend challenges, compact UI and GA4

- Audited gameplay, API/auth, SQL history, analytics, storage, a11y and rendering before implementation. Baseline typecheck, 22 tests and build passed; lint found two existing render-time ref reads in Competition, now corrected.
- Shared versioned survival configuration, typed future question metadata and subtle combo heat. Existing 30/+4/−6 and scoring preserved; difficulty familiarity figures remain editorial goals, not measured accuracy claims.
- Added Daily with one official signed-in attempt/day, immutable shared deck/order, UTC rollover, actual daily board and spoiler-free sharing. Added guest-friendly async friend links, server scores, comparisons and rematch lineage. Details/limitations in DAILY_CHALLENGES.md.
- Migration 0006 adds challenge sets/attempts. Version checks, ownership, atomic history updates, bounded answers and creation limits protect writes. No existing score/history migrations changed.
- Compact desktop two-column home and compact gameplay; removed filled hover so the next answer under a stationary pointer does not appear selected. Preserved keyboard focus, mobile flow, zoom and accessible scrolling for expanded/long content.
- GA4 property 556715225 / stream 15870863387 / public measurement ID G-1PWY0WZQ6H configured in the client. Enhanced measurement disabled in Google UI. Analytics stays opt-in, production-domain-only and respects DNT/GPC; no names/emails/answer text sent. Provider receipt is recorded separately after deployment.
- Package/footer version 1.1.0. 24 tests, typecheck and lint passed during release verification. Local browser: 1280×720 desktop home/game and 390×844 mobile home/game fit without scrolling; option C selection resets; two players receive matching Daily and friend questions/options. Final build and deployment receipt recorded in delivery report.
- Actual approved catalog remains 1,170. No 100,000-question source was fabricated. Daily prepares the next approved sequence on requests, with lazy fallback; no unattended external fetch/publication job is installed. Hosting linked-automation inventory is unavailable, preventing safe schedule setup under the Sites skill.

## 2026-09-29 — Category boards, fast matches and exact SQL history

- Public leaderboards combine all historical seasons by category and Overall. Overall remains each player's single highest score with its category. No old runs, scores or season provenance were deleted.
- Team members can name their own side before start (1–24 characters); names are validated and rendered as text. Readiness, unequal teams, summed scores and per-player right/wrong counts are unchanged.
- WebSocket-first match actions with immediate local locking, bounded action queue, revision-based state synchronization and SSE/HTTP recovery. Active synchronization checks every 250ms; lobby checks every second. This is still per-connection D1 synchronization, not a room-wide Durable Object broadcaster or zero-latency guarantee.
- Compact arena verified locally at 1280×720 desktop and 390×844 mobile with no page overflow in the tested match state. Long questions, zoom and large expanded rosters can still scroll accessibly.
- Bank 2026-09-29.1: **1,170 playable questions**, 24 additional editorial approvals and one rejected ribosome/DNA item. Six new answers were checked against primary references; other new approvals used editorial knowledge. No claim of an independent audit of every fact.
- Migration 0004 adds team names/revisions and an all-time category score index. Migration 0005 adds indexed `question_bank` and exact `(player_id,topic_key)` history, seeds 1,170 entries and backfills historical solo exposures and active/completed match decks.
- Authenticated question choice now happens in SQL. Selection and reservations are atomic, so simultaneous tabs cannot repeat a linked topic. Match decks are reserved atomically for every member; insufficient unseen coverage reserves nothing. Guests use retained browser history. Exhausted tiers stop rather than recycle; history is shared across ranked and match play.
- Reservations precede run/match state commits. A cancelled/racing request can conservatively consume an unseen question/deck without displaying it; reservations are never released, to preserve the no-repeat guarantee. Unknown semantic duplicates still need editorial linking. Deleting an account or clearing guest storage breaks the identity/history boundary.
- Added local SQLite candidate importer (100,000 rows/file, validation, source/license metadata and unique normalized prompt hashes). No provider or licensed 100,000-question source is configured. **The requested 100,000 playable questions remain outstanding.** Synthetic load fixtures stay outside the repository/live bank.
- Verification: typecheck and 22 tests passed, including actual workerd WebSocket upgrades, concurrent sync/action acknowledgement, revoked sessions, SQL history backfill, concurrent reservations, shared-deck exhaustion and 100,000 synthetic SQL rows. The local SQL check made 20 selections in ~2ms; this is not a remote D1 performance promise. Separate candidate import handled 100,000 synthetic rows in ~5 seconds. Deployment receipts belong in the delivered release report.


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

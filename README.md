# MINDFKD

How far can your brain go? A trivia survival game with guest play, Google login, public profiles and global rankings.

## Run

Node.js 22 or later:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. If another application uses that port, run `npm run dev -- --port 3100`.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

## Architecture

- `app/`: Next.js App Router entry point, metadata, favicon and responsive design tokens.
- `components/Game.tsx`: run orchestration, landing, HUD and results.
- `components/Question.tsx`: seven interaction renderers, keyboard controls and accessible ordering.
- `components/Timer.tsx`: isolated requestAnimationFrame clock. Only the timer rerenders every frame.
- `lib/game.ts`: pure transitions, configuration, scoring, seeded RNG and selection.
- `lib/storage.ts`: validated, versioned local statistics with graceful storage failures.
- `lib/share.ts`: answer-free share text, Web Share and clipboard fallback.
- `lib/session.ts`: versioned deterministic session contract and optional future sound adapter.
- `data/questions.ts`: 1,042 questions across all seven difficulty tiers, including attributed community questions.

The supplied remote was empty when inspected, so no Borderline code or history was removed. This implementation uses Next.js, TypeScript, React and plain token-based CSS; there was no existing Tailwind infrastructure to retain.

## Rules

30 seconds initially; correct answers add 4 seconds, wrong answers subtract 6 seconds. Time continues during feedback and in background tabs. Answers lock synchronously, preventing repeated taps from counting twice. Correct feedback lasts 520 ms, wrong feedback 850 ms. Guest games use a monotonic `performance.now()` deadline. Ranked games use a server-owned deadline and server-validated answer events; the browser timer is a display only.

Score = `(150 × difficulty + max(0, 300 − floor(answerMilliseconds / 10))) × multiplier`, rounded once. Combo thresholds are 3 → 1.2×, 5 → 1.5×, 10 → 2×, 15 → 3×. Errors reset combo. Time bonuses are never multiplied.

Levels 1–5 use tier 1, 6–10 tier 2, 11–15 tier 3, 16–20 tier 4, 21–30 tier 5, 31–40 tier 6, 41+ tier 7. Questions and answer positions are seeded and shuffled. Cross-run history prioritizes unseen facts, then least recently seen. Facts do not repeat within a run. An exhausted tier ends the run without jumping difficulty. See QUESTIONS.md for review, attribution, calibration and seasons.

Interactions: multiple choice, binary, higher/lower, chronological ordering (drag and arrow controls), true/false, numeric choice, and emoji visual choice. Number choices submit immediately with one tap, like other choices. Keyboard: 1–4 to answer, Tab/Enter for controls. Ordering still requires confirming the completed sequence. Reduced motion disables animation. Native dialogs trap focus and support Escape. No remote image or font dependencies.

Local stats include games played, best score/level/combo, total right/wrong, weighted overall accuracy, and eight recent scores. Stats are per browser, not ranked. If storage is unavailable, the run still works and shows a save warning. Sharing never exposes answers.

Development-only `?level=31` starts at a specific level. Production ignores it. `dailySession('2026-09-27')` produces a stable seed contract; daily competition is intentionally not exposed or claimed in V0.

## Question review

Questions favor stable facts; dated comparisons explicitly name the reference year. Targeted source checks include [NASA Venus facts](https://science.nasa.gov/venus/venus-facts/), [NASA Titan atmosphere](https://www.nasa.gov/general/the-titan-haze-simulation-experiment-on-cosmic/), [ITU telegraph history](https://www.itu.int/en/history/Pages/ITUsHistory.aspx), and the [UN 2020 statistics pocketbook](https://unstats.un.org/unsd/publications/pocketbook/files/world-stats-pocketbook-2020.pdf). The bank has not yet received an independent editorial audit. Difficulty is authored, not calibrated against player response data.

## Accounts and social features

Google Identity Services supplies an ID token, verified server-side against Google signing keys, issuer, audience, expiry and a per-login nonce. Only the Google subject identifier is stored, never email, passwords or tokens. Sessions use hashed random tokens in D1 and a Secure, HttpOnly, SameSite cookie. Mutations require an allowed Origin and application header.

Players choose a unique permanent username, display name and optional bio. Public profile links use `/profile?u=username`; result links add `&run=run-id`. Profiles show ranked stats, recent results, follower counts and following. Following is one-way and can be undone. Google identifiers and sessions are never exposed by public endpoints. Privacy information is at `/privacy`.

Signed-in players with completed profiles start ranked runs. The Worker chooses questions, calculates scores, enforces time and feedback delays, checks ownership and uses optimistic versions to prevent duplicate answers. The leaderboard contains each player's best finished ranked run. Guest runs remain local and cannot be uploaded as ranked scores. This prevents forged client score submissions but is not a comprehensive anti-bot system; the question bank is public in the guest bundle.

- `server/`: Google verification, sessions, API routes and authoritative ranked engine.
- `db/schema.ts`, `drizzle/`: database schema and versioned SQL migrations.
- `components/Account.tsx`, `RankedGame.tsx`, `Social.tsx`: login/profile editor, online gameplay and social views.
- `tests/ranked.test.ts`: server timing and actual SQLite integration tests for profiles, follows, authorization and score integrity.

## Hosting

The existing public Sites project serves mindfkd.com and www.mindfkd.com. `npm run build:site` exports Next assets, then bundles a Cloudflare Worker into `dist/server/index.js` with assets in `dist/client`. Sites provisions the logical `DB` D1 binding declared in `.openai/hosting.json` and applies migrations. Publish through the Sites source workflow so the archive matches the pushed source commit.

Set the production runtime variable `GOOGLE_CLIENT_ID` to the Web client ID registered for `https://mindfkd.com` and `https://www.mindfkd.com`. No client secret is used. Configure Google's consent branding and audience before enabling public sign-in. Changes to production runtime variables require redeployment.

`npm run dev` and `npm start` run the Next frontend only; ranked/auth endpoints require the Worker and D1 runtime. Guest play works without them. Tests use an isolated in-memory SQLite database and never insert sample accounts or scores into production.

## Analytics

See [ANALYTICS.md](ANALYTICS.md) for providers, configuration, consent, event definitions, validation and current hosting limitations. Analytics is optional and unconfigured by default.

## Interaction responsiveness

Number questions now use direct-submit choices and keyboard 1–4. Ranked answers highlight the selected choice immediately while the server verifies it. Accepted run requests combine authentication and run lookup in one database read; start prechecks run concurrently. Feedback wait values are calculated at response time so database work is not added to the intentional feedback delay. Home and leaderboard navigation use client-side links. Ranked verification still depends on network latency; no measured zero-latency guarantee is made.

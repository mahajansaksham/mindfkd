# MINDFKD

How far can your brain go? A complete, local-first trivia survival prototype.

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
- `data/questions.ts`: 196 authored questions across 13 categories and all seven difficulty tiers.

The supplied remote was empty when inspected, so no Borderline code or history was removed. This implementation uses Next.js, TypeScript, React and plain token-based CSS; there was no existing Tailwind infrastructure to retain.

## Rules

60 seconds initially; correct answers add 4 seconds, wrong answers subtract 6 seconds. Time continues during feedback and in background tabs. Answers lock synchronously, preventing repeated taps from counting twice. Correct feedback lasts 520 ms, wrong feedback 850 ms. The monotonic `performance.now()` deadline is authoritative, independent of rendering cadence.

Score = `(150 × difficulty + max(0, 300 − floor(answerMilliseconds / 10))) × multiplier`, rounded once. Combo thresholds are 3 → 1.2×, 5 → 1.5×, 10 → 2×, 15 → 3×. Errors reset combo. Time bonuses are never multiplied.

Levels 1–5 use tier 1, 6–10 tier 2, 11–15 tier 3, 16–20 tier 4, 21–30 tier 5, 31–40 tier 6, 41+ tier 7. Each tier has 28 questions. Questions and answer positions are seeded and shuffled, with no repeats in a run. After a tier is exhausted the selector chooses harder available questions, then the hardest remaining tier. Clearing the finite bank ends with an explicit completion result.

Interactions: multiple choice, binary, higher/lower, chronological ordering (drag and arrow controls), true/false, numeric choice, and emoji visual choice. The number interface selects a value and locks it in. Keyboard: 1–4, arrows for numeric selection, Tab/Enter for controls. Reduced motion disables animation. Native dialogs trap focus and support Escape. No remote image or font dependencies.

Local stats include games played, best score/level/combo, total right/wrong, weighted overall accuracy, and eight recent scores. Stats are per browser, not ranked. If storage is unavailable, the run still works and shows a save warning. Sharing never exposes answers.

Development-only `?level=31` starts at a specific level. Production ignores it. `dailySession('2026-09-27')` produces a stable seed contract; daily competition is intentionally not exposed or claimed in V0.

## Question review

Questions favor stable facts; dated comparisons explicitly name the reference year. Targeted source checks include [NASA Venus facts](https://science.nasa.gov/venus/venus-facts/), [NASA Titan atmosphere](https://www.nasa.gov/general/the-titan-haze-simulation-experiment-on-cosmic/), [ITU telegraph history](https://www.itu.int/en/history/Pages/ITUsHistory.aspx), and the [UN 2020 statistics pocketbook](https://unstats.un.org/unsd/publications/pocketbook/files/world-stats-pocketbook-2020.pdf). The bank has not yet received an independent editorial audit. Difficulty is authored, not calibrated against player response data.

## V1.1

Playtest completion times and per-question error rates; rebalance the curve, increase type variety, and expand/source-review the expert bank. Add a local deterministic daily practice mode before adding real ranked infrastructure. Future authenticated rankings should use versioned server-issued seeds and validate answer events server-side. No fake rankings, accounts, database, ads or payments are included.

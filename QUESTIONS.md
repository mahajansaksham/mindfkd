# Question quality, SQL storage and non-repetition

Bank **2026-09-29.1 contains 1,170 playable questions**: 196 original, 160 foundations, 104 genre additions and 710 reviewed/adapted OpenTDB questions. Tiers: 141 / 166 / 213 / 251 / 209 / 142 / 48. Sports 70; Politics 50; History 101; Geography 128; Science 242; Mixed includes all 1,170, including 579 other-subject questions.

OpenTDB adaptations remain CC BY-SA 4.0 with attribution and download at `/questions` and `/community-questions.json`. Source: https://opentdb.com/api_config.php . This does not relicense unrelated code. The 24 new editorial approvals have recorded notes; six have primary-source reference checks. One ribosome/DNA item was retired for an incorrect answer. This is not an independent audit of every question. Difficulty is editorial and awaits empirical calibration.

## Exact SQL history

Migration 0005 seeds `question_bank` with stable ID, canonical topic key, unique normalized prompt hash, genre, exact difficulty, stable random sort key, active flag, answer payload and bank version. Indexed range selection returns one question instead of loading a user's entire history or the catalog into application memory. There is no `ORDER BY RANDOM()` on the solo path.

`player_question_seen` has primary key `(player_id,topic_key)`. Selection and reservation occur in one INSERT/SELECT statement. Concurrent requests and other devices on the same account cannot select an already reserved topic. Migration backfills old ranked exposures and full decks of historical active/completed matches. Reservations survive question retirement and bank-version changes. Shared match selection reserves a complete ten-question deck for all participants atomically; it excludes the union of their histories and consumes nothing if required tiers are insufficient.

Never recycle least-recently-seen questions. When the requested tier is exhausted, end the run; when starter questions or a shared deck are unavailable, explain this and suggest another category. Do not silently raise difficulty or clear history. Small pools can exhaust quickly, especially across a large team's combined history. A lost/racing state write may leave a question reserved but never displayed; retain that conservative reservation. Account deletion ends that account's history.

Guests use local browser history with no deliberate 20,000-entry eviction. Clearing storage, changing browsers or storage failure prevents a cross-session guest guarantee; guest history is not merged into an account. Only explicitly linked topic keys catch semantic paraphrases. Normalized hashes detect wording duplicates, not semantic equivalence; review remains necessary.

## Target: 100,000 verified questions

100,000 playable questions are **not yet supplied**. Current actual count is 1,170. No licensed provider/source for the remaining volume is configured. Do not substitute synthetic rows, padded number variations or unchecked imports for this target. Local test fixtures are not live content.

`npm run questions:import -- --input candidates.ndjson [--database content/review/catalog.sqlite]` accepts up to 100,000 NDJSON records/file into a local review database. Required fields: `id`, `genre`, `difficulty` (1–7), `prompt`, `answer`, four distinct `options`, `sourceUrl` (HTTPS), and `license` (CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0, original or licensed). Licensed records also need `licenseReference`; optional `topicKey` should link the underlying fact. Import checks shape and duplicates, commits bounded batches, preserves completed batches on failure and leaves every record pending. A source's license assertion is not independently verified by this script.

The existing OpenTDB fetch/review pipeline remains: `npm run questions:fetch -- 3` stages candidates; decisions in `content/review/decisions.json` approve/retire IDs and record corrections; `npm run questions:prepare` regenerates approved bundled material. For SQL expansion, create a new additive migration with approved rows and source/rights review, retaining stable topic keys and hashes. Update the bank version, attribution/download and actual displayed count; do not edit migration 0005 after deployment. The one-time `scripts/seed-question-bank.ts` generated that bootstrap migration; it is not a recurring importer. Bulk SQL-only additions must also adapt guest delivery/count reporting before being advertised as available to guests.

Retire with `active=0`; retain question payload/provenance, reservations and old results. No unattended content publication is enabled. Synthetic tests exercised 100,000-row candidate ingestion and SQL selection; remote D1 cost, cold/exhausted-tier latency, backup policy and large-room selection still need production-scale measurement.

## Calibration and historical scores

Ranked question_events records exposure, difficulty, bank_version and one accepted answer's accuracy/elapsed time. Guest telemetry is optional analytics, not authoritative calibration. Use first answered exposure per player and bank/question to reduce practice bias, minimum 30 distinct players before reviewing a rate, and compare medians/distributions within the same tier. Exposure without an answer is abandonment, not automatically incorrect. Example private read-only report:

```sql
WITH first_answers AS (
 SELECT *, ROW_NUMBER() OVER (
   PARTITION BY player_id, bank_version, question_id ORDER BY answered_at
 ) AS attempt
 FROM question_events WHERE answered_at IS NOT NULL
)
SELECT bank_version, question_id, difficulty, COUNT(*) AS players,
 ROUND(AVG(correct)*100,1) AS accuracy_percent,
 ROUND(AVG(elapsed_ms),0) AS mean_response_ms
FROM first_answers WHERE attempt=1
GROUP BY bank_version, question_id, difficulty HAVING COUNT(*)>=30;
```

Investigate outliers manually; do not automatically change tiers from small samples. Mean is shown only for a quick SQL report; use exported distributions/median for decisions. Public leaderboards combine all historical seasons by category and Overall. Overall selects each player's single highest score and shows its category. Historical bank/season metadata remains private provenance, not a user-facing filter. Do not rewrite past scores. Bump BANK_VERSION on catalog changes so an active old-version solo run ends safely before drawing from a new bank.

# Question quality and rotation

Bank 2026-09-28.2 contains 1,146 questions: 196 original, 160 authored foundation questions, 104 genre additions and 686 reviewed/adapted Open Trivia Database questions. Tier counts are 141 / 165 / 204 / 244 / 204 / 140 / 48. OpenTDB material and adapted download at `/community-questions.json` are CC BY-SA 4.0; attribution and change notes are at `/questions`. Source: https://opentdb.com/api_config.php . This content license does not relicense unrelated application code.

Selection uses the requested difficulty exactly, balances away from recent categories where possible, and prefers facts not previously shown to that player. If all eligible questions were seen in previous runs, least-recently-seen questions can return. No promise of infinite non-repetition is possible with a finite bank. Within a run, topic groups never repeat; exhausting the exact tier ends the run rather than jumping difficulty. Guests store exposure history locally; ranked history is private in the existing database and survives sign-in on another device. Simultaneous starts in separate tabs can race before history is written.

Difficulty is editorial, not yet empirically calibrated. Broad knowledge is easier than specialist knowledge; arithmetic/fact complexity and likely familiarity guide assignment. It is still subjective and the community bank has not received a separate independent factual audit. Do not label the tiers scientifically consistent before real-player calibration.

## Imports and review

`npm run questions:fetch -- 3` fetches up to three batches of 50 candidates, with a session token and delay respecting API limits. Network failures preserve completed batches. It writes only `content/review/opentdb.json`; it cannot publish. It deduplicates normalized prompts against queue and active data. The current queue has 1,195 candidates; 686 approved, 114 retired and 395 unreviewed. `content/review/decisions.json` records approval/retirement, tier and corrections by stable source ID. Review new candidates for correct answers, ambiguity, cultural specificity, time sensitivity, duplicate facts and clear distractors. Link semantic duplicates with a shared topicKey when wording differs.

After editing decisions and/or authored TSV: `npm run questions:prepare`, tests, source review, then build and publish. Weekly candidate imports are a reasonable operating cadence; no unattended fetch/publish schedule is installed. New questions must pass review before entering the live bank. Retirement removes an item from active selection but retains its source record, stable ID, past exposures and ranked score history. Do not destructively delete old results.

## Calibration and seasons

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

Investigate outliers manually; do not automatically change tiers from small samples. Mean is shown only for a quick SQL report; use exported distributions/median for decisions. The public leaderboard defaults to Choose your category (season-3), retaining Fresh questions (season-2) and Launch scores as archives. Overall selects each player’s single highest score and shows its category. Profiles retain historical runs. Existing runs started under an older bank are finished safely before further question selection. A new bank/difficulty policy should receive a new version and, when comparisons materially change, a new season. Never rewrite past scores to match a new bank.

## Genre coverage

Sports 67; Politics 47; History 95; Geography 122; Science 236; Mixed includes all 1,146. Science includes animals, technology and numbers. Mixed retains other legacy subjects too. Every category has at least five items in tiers 1–4 and 7, and ten in tiers 5–6, enough for the current solo progression. Additions are reproducibly generated from `data/genre-additions.tsv`. This is coverage, not proof of calibrated difficulty or infinite variety. Live rooms use a shared random deck; past individual exposure is not excluded across matches because all competitors must share the same deck.

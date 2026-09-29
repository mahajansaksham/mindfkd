# Question-bank scaling — September 29, 2026

Target: 100,000 checked playable questions. Actual: **1,170**. No bulk licensed content source is connected. A 100,000-row synthetic benchmark is a storage/selection test, not content fulfillment.

Implemented: indexed SQL catalog, stable normalized hashes/topic IDs, atomic exact account/topic reservations, historical backfill, shared-deck exclusion for every participant, bounded local candidate importer and strict exhaustion instead of recycling. Signed-in solo selection uses indexed randomized key ranges with exact NOT EXISTS history checks. Match setup uses SQL window functions to select all required tiers in one atomic reservation, avoiding partial consumption. Question/answer payloads for signed-in play come from SQL; the public guest pool remains a bundled 1,170-question subset.

Before expanding live content:

1. Obtain reusable source material and record rights, attribution and version. Review ambiguity, answers, distractors, duplicates and genre/tier coverage. Link paraphrases with common topic keys; hashes alone are insufficient.
2. Stage up to 100,000 candidates/file with `questions:import`. Pending rows cannot enter the live game automatically. Prepare reviewed additive SQL migrations, update version/attribution and adapt guest delivery/count reporting for SQL-only growth. Never ship the large raw bank as a browser bundle.
3. Benchmark remote D1 cold reads, nearly exhausted histories, match deck windows and realistic concurrency/cost. A local 100,000-row test passed; it does not prove remote scale. Measure storage growth: history grows with players × reserved topics.
4. Exact SQL history is authoritative. Bloom filters are optional later cache optimizations; confirm possible matches against SQL so false positives cannot permanently hide unseen content. They do not create questions or solve semantic duplication.
5. Keep inactive questions and historical scores; back up before operational migrations. Never clear history to make a finite pool appear fresh. Calibrate tiers using enough first-exposure data, retaining old score/version provenance.

Live-room transport has separate scaling limits documented in LIVE_MATCHES.md. No recurring content publisher, Bloom filter or million-question claim is enabled.

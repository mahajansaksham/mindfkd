# Question-bank scaling plan

Current implementation serves 1,146 questions, not one million. Genre/difficulty indexes are cached in memory; guest data is loaded when playing rather than in the landing bundle. Selection stays in the requested tier and genre. A run never repeats a topic. Across runs, exact exposure history prefers unseen facts then least-recently-seen facts after exhaustion. Finite pools cannot promise permanent non-repetition; small category pools recycle sooner than Mixed.

Before growing to one million:

1. Move active catalog and answer keys to indexed server storage, with stable question/topic IDs, genre, tier, version, review status and retirement date. Query bounded candidates by `(genre,tier,status,shuffle_bucket)` rather than loading the entire catalog into a Worker/browser. Serve bounded guest batches without answer keys when verification is server-side.
2. Keep normalized prompt hashes and canonical topic IDs for duplicate wording/fact detection. A prompt hash alone cannot detect paraphrases. Review candidate imports; do not auto-publish external trivia or erase old question/results records.
3. Store exact exposure rows or compressed ID bitmaps by player/catalog version. Current history reads the player's full exposure aggregate and local storage caps history at 20,000 entries; both need bounded/indexed replacement at that scale.
4. A Bloom filter can cheaply say a question is **definitely not seen** or **possibly seen**. Confirm possible matches against exact history before exclusion; false positives must not permanently hide unseen questions. Version/rebuild filters on catalog changes. It is an optimization, not the source of truth or a semantic duplicate detector.
5. Calibrate within genre/tier using sufficient distinct players and first exposures, including response distributions. Preserve seasons when difficulty changes. Retire bad items from selection, retaining provenance and historical records.
6. Load-test selection latency, bundle size, D1 row/query/storage limits and cost with representative data before importing massive batches. Shard/move catalog storage according to measured provider limits. Room real-time scaling is separate; see LIVE_MATCHES.md.

No million-question import, Bloom filter, automatic weekly publisher or wholesale deletion was enabled in this release. This avoids claiming capacity the app has not tested.

# Daily and friend challenges — release 1.1.0

## Rules and architecture

RUN, DAILY and asynchronous friend challenges share `lib/game.ts`, versioned `lib/rules.ts`, the Question renderer and Timer. Survival starts at 30 seconds, adds 4 for correct answers and removes 6 for wrong answers. Existing scoring/multipliers are preserved. Heat labels at 3/5/8 correct do not change the historic scoring formula. Live matches retain their distinct shared-round rules and existing WebSocket transport.

Fixed sequences contain 50 questions, escalating through all seven difficulty tiers. Reaching the end completes the challenge. Deterministic selection fixes both question and option order. Correct answers are withheld until that attempt answers. Server timestamps, not browser time or submitted scores, decide outcomes. Client input locks immediately while the request is in flight. Retried answers are version-checked.

## Daily

`/daily`. Daily #1 is 2026-09-30. `challenge_sets.day` is unique and its deck is immutable after creation, including across later catalog deployments. Every account receives the same set. A unique `(set_id,actor)` index admits only one official attempt per signed-in account; restarting returns that attempt. Guests can view the board but must sign in to play officially. No replay can overwrite the official score. Only completed official attempts appear in the daily board; ties are ordered by finish time and attempt ID. There is no fabricated percentile.

The UTC date changes availability at midnight without redeployment. Opening today’s Daily also prepares tomorrow from the approved SQL catalog before midnight. If nobody visits for an entire day, the next request prepares the missing day before serving it. This is **request-driven preparation, not a scheduled external question-fetch job**. New imported trivia is not automatically approved. The hosting response currently omits its linked automation inventory, so no recurring job was created: the [Sites hosting skill](/Users/sakshammahajan/.codex/plugins/cache/openai-curated-remote/sites/0.1.75/skills/sites-hosting/SKILL.md) requires, “If these checks or the linked automation list are unavailable, do not create or suggest an automation.” The normal app release is unaffected.

Attempts expire at midnight UTC, including time bonuses. A Daily started seconds before midnight therefore has less than 30 seconds; the next UTC day provides a new attempt. The UI states the reset boundary. A future day's deck cannot be fetched through the public set endpoint.

## Friend challenges

`/challenge` creates a fixed Mixed deck. The creator finishes a server-verified run before others can accept `/v/<issued UUID>`. Anyone holding the link can accept without login; guests get a Secure, HttpOnly, SameSite=Lax cookie whose token is stored only as a hash-derived actor key. A friend link accepts multiple opponents, each with one attempt per account/browser identity. This is casual competition: clearing guest cookies or using another account can bypass the identity limit.

Creator and opponent get the same deck, ordering, starting time, feedback delays and scoring. Comparison includes score, correct/wrong counts, accuracy and average response time (including network travel, not a pure reaction-time measurement). Completed opponent scores appear to the creator on reload. Rematches create a new set with a parent link; an unfinished participant cannot request a rematch. Links expire after 30 days. Existing completed result records remain stored. Live-match profile win/loss totals continue to describe live matches; async results do not silently alter those totals.

Creation is capped at 20/hour per actor with an atomic insert condition. Client request IDs support retrying a creation without duplicate sets. These limits do not replace edge/IP abuse protection. Public responses omit actor keys, internal account IDs, cookies and deck contents. Knowing a set or attempt ID does not authorize updates to somebody else's attempt.

## Repeat policy

Daily/friend shared decks intentionally permit previously seen facts, per the owner’s decision. Authenticated exposures enter exact SQL history in the same transaction as the attempt update, so subsequent RUN/live selection excludes them. Guests retain exposed topics in browser history. RUN and live matches keep their strict no-repeat policy within retained identity/history. Semantic duplicates still require editorial linking.

## Storage and operations

Migration 0006 adds `challenge_sets`, `challenge_attempts`, uniqueness and lookup/ranking indexes. Prior migrations and records remain intact. Reviewed candidate selection is bounded to 80 rows/tier; SQL sorts the indexed tier once when a set is created, not per answer. Heavy-volume creation needs load testing and caching/edge limits. Never retroactively change decks or rule semantics for an existing rules version. A future rules change must preserve old-version replay logic or explicitly end older sets.

Tests exercise deterministic decks, server scoring/deadlines, identical options, immutable daily sets, tomorrow preparation, once-per-day attempts, midnight rollover, guest cookies, authorization, answer replay, rematch lineage and CSRF. Browser verification uses isolated local accounts and never writes fixture scores into production.

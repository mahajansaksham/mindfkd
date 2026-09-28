# Live matches

## Rules and access

`/compete` hosts 1v1 or two-team matches. Google sign-in and a public username are required. Invite links use `/compete?room=CODE`. A waiting lobby lasts 30 minutes; host cancellation ends it. Players choose either side and mark ready. The host starts only when both sides have players and everyone is ready. 1v1 permits one person per side. Team mode permits unequal sizes, up to 50 per side for this launch. Team points are summed; there is no averaging or handicapping.

Every participant receives the same shuffled ten-question deck and server deadlines: five-second countdown, ten seconds to answer and two seconds to reveal each round. Correct answers earn 100 × difficulty, wrong/missing answers zero; no speed bonus. Teams lock at start. A disconnected player can return using the same signed-in account and invite URL; the clock keeps running. Rejoining does not reset or remove missed answers. Everyone can see individual right/wrong/unanswered counts after each reveal. Ties are draws. Profile results are derived from finished matches; team results do not change solo ranked boards.

## Transport

The existing hosting binding supports Workers and D1. `GET /api/matches/stream` sends SSE state events and heartbeats, checking authoritative D1 state every 500ms. Streams last about 15 seconds then EventSource reconnects; session validity is rechecked during streams. The UI interpolates the clock locally and applies clicks immediately as pending, while the server verifies the answer. Room state can arrive out of order; older server timestamps are ignored. A six-second silence triggers a one-second recovery GET loop, clearly labelled reconnecting. Heartbeats stop the fallback loop when streaming recovers.

This is server push backed by database polling, not WebSockets. The expected change-detection interval is up to roughly 500ms plus network/database delay; it is not a latency SLA. A final answer accepted before the atomic close is counted. Stale/outside-window submissions are rejected. Client clocks are display estimates and cannot extend server deadlines.

## Storage and scaling

Migration 0003 creates matches (private deck and authoritative times), membership and unique per-round answers. A match settles on stream/read/profile access even if everyone disconnects. Finalization computes the winner atomically from accepted database answers. Results aren't increments that can be duplicated by retries.

The initial transport queries per connected client: at 100 connected players, approximately 200 room reads/second, before actions and reconnects. **Do not treat the 100-seat UI limit as a tested capacity guarantee.** Load-test and monitor database/Worker budgets before promoting large public rooms. Upgrade to one Durable Object per room with WebSocket hibernation to broadcast a single authoritative state efficiently, if the hosting provider exposes the required binding; the current Sites configuration does not. Preserve D1 for durable results. Official architecture reference: https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/ .

Local integration tests cover clock boundaries, same decks, 2v1 summed scoring, privacy, readiness, host permissions, immutable membership after start, one submission, stream response and completed win/loss records. Production real-account multi-region latency/load testing remains an operational gate. No zero-lag claim.

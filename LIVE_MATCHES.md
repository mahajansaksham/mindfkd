# Live matches

## Rules and access

`/compete` hosts 1v1 or two-team matches. Google sign-in and a public username are required. Invite links use `/compete?room=CODE`. A waiting lobby lasts 30 minutes; host cancellation ends it. Players choose either side and mark ready. The host starts only when both sides have players and everyone is ready. 1v1 permits one person per side. Team mode permits unequal sizes, up to 50 per side for this launch. Team points are summed; there is no averaging or handicapping.

Every participant receives the same shuffled ten-question deck and server deadlines: five-second countdown, ten seconds to answer and two seconds to reveal each round. Correct answers earn 100 × difficulty, wrong/missing answers zero; no speed bonus. Teams lock at start. A disconnected player can return using the same signed-in account and invite URL; the clock keeps running. Rejoining does not reset or remove missed answers. Everyone can see individual right/wrong/unanswered counts after each reveal. Ties are draws. Profile results are derived from finished matches; team results do not change solo ranked boards.

## Team names and compact display

Any member can name their own side while waiting (1–24 characters). Names lock at start and appear in shared scorecards. The desktop arena uses compact scores, clock and a two-column answer grid. Team rosters collapse during rounds and expand for individual results. Tested match states fit 1280×720 desktop and 390×844 mobile; long content/zoom can still scroll rather than being clipped.

## WebSocket-first transport

`/api/matches/socket` uses a Worker WebSocketPair with allowed-Origin and account checks. Actions receive direct acknowledgements over the open socket. The client immediately locks the selected answer. Requests queue behind synchronization rather than rejecting ordinary clicks as busy. Limits: four pending operations, 4KB/message, 20 messages/second, ten-minute connection lifetime, session checks on actions and periodically on sync.

Client sync messages run every 250ms while active and every second in the lobby. The server checks a small D1 revision/timing row and rebuilds a full room view only when revision or clock phase changes. Migration 0004 maintains revisions with membership/answer triggers and explicit state updates. Unchanged states return pongs. The displayed timer runs locally and server timestamps/revisions reject stale state.

This is WebSocket transport **with database synchronization**, not a room-wide broadcast coordinator. It reduces full snapshot work and avoids a fresh HTTP answer request on the normal path, but network/database time still matters. SSE at 500ms remains fallback when upgrades fail; reconnects retry WebSocket and throttled HTTP recovery handles silent streams. Never promise zero lag or infer production latency from local measurements.

## Storage and scaling

Migration 0003 retains authoritative matches/membership/answers. Migration 0005 selects questions from SQL at start, excluding every member's private reservation history. Decks are reserved atomically and are identical for all competitors, including option order. If there is insufficient unseen coverage, start fails clearly without consuming a partial deck. Reservations can survive a subsequent interrupted start to prevent repeats. Finalization derives the winner from accepted answers atomically; profile results are not retryable increments.

At 100 active sockets, 250ms sync can mean approximately 400 cheap revision reads/second, plus changes/actions. This is not a tested 100-player capacity guarantee. Load-test Worker/D1 budgets and cross-region latency. The next scale step is one Durable Object per room with WebSocket broadcasts/hibernation, if hosting exposes that binding; this Site currently only declares D1 and static assets. Reference: https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/ .

Local workerd tests cover real upgrades, direct acknowledgements during sync, cross-client revision propagation, bounded names, hidden answers, session revocation, shared clocks, unequal summed teams, duplicate answers and persistent results. Local acknowledgement figures are not a production SLA.

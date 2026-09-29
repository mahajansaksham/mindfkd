# MINDFKD security review — 29 September 2026

Scope: application source, SQL boundaries, local API integration, runtime dependency audit. This is not an independent penetration test or a guarantee against cheating/abuse.

## Fixed

1. **Unnecessary identifier exposure:** public account/profile responses no longer include internal player IDs. Public usernames, shareable run IDs and invite codes remain intentional references. Knowing an ID must never grant access. `isMe` is derived from the authenticated session and only controls presentation; changing a client value cannot change ownership.
2. **Login replay:** nonce hashes are persisted with a ten-minute expiry and atomically consumed before Google credential verification. Reuse and expiry fail. Google issuer, audience, signature and verified identity checks remain. Session tokens are stored hashed and delivered only in Secure/HttpOnly/SameSite cookies.
3. **Concurrent writes:** usernames can only be initially chosen or updated with the same username, enforced in SQL. Run creation checks the 120/hour cap atomically in the insert rather than trusting a prior read.
4. **Input bounds:** request bodies are capped at 16KB while reading bytes, including multibyte input; identifiers, versions, category values and answers are validated. SQL values remain bound parameters.
5. **Browser hardening:** CSP restricts origins, objects, forms and framing; nosniff, referrer policy, HSTS, permissions policy and popup-compatible opener policy are added. CSP still allows inline scripts for the static Next boot payload; this does not eliminate XSS risk.
6. **Match boundaries:** signed-in profiles required; host-only start; membership required for active-room reads and answers; server-controlled clocks/decks/scoring; one submission per player/round; no future answers or another player's selected answer in live payloads. Winner calculation and closing submissions occur in a single database write. Profile totals derive from completed matches, avoiding double increments on retries/reconnect.

## Verified controls

Automated integration exercises cross-account run writes, forged client identity fields, immutable profiles/categories, nonce reuse, malformed/oversized input, category/overall best-score queries, early/late match answers, unequal teams, duplicate submissions, stream DTO privacy and persistent win/loss results. Runtime `npm audit --omit=dev` reported no known vulnerabilities at review time. Vulnerability databases and dependencies change.

## Remaining limits

- Public guest question assets can be inspected. Ranked/match APIs hide answers until reveal but cannot prevent external lookup, collusion, bots or multiple Google accounts. These records are not a prize-grade anti-cheat system.
- Invite links act as room discovery links; signed-in invitees can view/join a waiting lobby. Do not share codes publicly for private games. A code is not a substitute for account authorization once play starts.
- Room creation is capped at 20/hour per account and teams at 50 people. Edge/IP rate limiting, nonce-flood protection, SSE connection quotas and bot detection are not configured here. Address these before heavy traffic; D1 polling has a per-connection cost.
- Authenticated production Google popup flow and cross-region match latency require real-account/device verification. Local fixtures verify application logic, not Google's production consent configuration.
- No external security scanner, infrastructure policy audit or recurring audit service was installed. Inspect logs without recording tokens, answers or personal data. Review dependency alerts and this document with each material release.

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html — authorization is required even when identifiers are difficult to guess.

## September 29 additions

WebSocket upgrades require an allowed Origin and authenticated membership. Writes revalidate sessions; synchronization revalidates periodically. Messages are bounded to 4KB and 20/second, with four queued operations at most. The upgrade response remains intact. The action queue prevents a normal answer arriving during synchronization from being rejected as busy. Connections expire/reconnect after ten minutes; fallback requests stop on component disposal and are throttled on failure.

Team names are bounded, control/markup characters rejected, and own-side/lobby permissions checked in SQL. Exact no-repeat history stays private; clients cannot upload trusted seen IDs, answer keys or ranks. SQL reservations use bound values, a primary key per player/topic and server-selected recipients. Retiring a question must retain history. Reservations may include undelivered questions following interruption; this favors avoiding repeats over maximizing pool utilization.

22 tests pass locally. Runtime dependency audit reported zero known issues; development dependencies include advisories and need routine maintenance. This does not establish production multi-region latency or a completed external security audit.

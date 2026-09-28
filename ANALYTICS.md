# MINDFKD analytics

## Status and architecture

Next.js 16 App Router. The root layout mounts one client AnalyticsRoot. Gameplay calls the typed `lib/analytics.ts` facade through `lib/analytics/run.ts`; providers are isolated in `lib/analytics/providers.ts`. There were no previous analytics integrations. Existing game statistics and Google login are independent.

Installed official packages: `@vercel/analytics` 2.0.1 and `@vercel/speed-insights` 2.0.0. GA4 uses Next `Script`, afterInteractive, with a stable ID and one configuration. This permits manual sanitized page views without a second automatic page view. See [Next Script](https://nextjs.org/docs/app/api-reference/components/script), [Google page views](https://developers.google.com/analytics/devguides/collection/ga4/views), and [Google tag setup](https://developers.google.com/tag-platform/gtagjs/configure).

**This release has no GA Measurement ID. The live site currently uses Sites, not Vercel. External analytics therefore remains inactive.** Instrumentation is implemented and locally testable. No analytics database or dashboard was added. The separate question-history table belongs to the earlier question-repeat request.

## Configuration

Copy `.env.example` to `.env.local` for a local build. Public values are embedded at build time, are not secrets, and require a fresh build and deployment:

```dotenv
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ANALYTICS_DEBUG=false
NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=false
```

Leave GA empty until there is a real web stream. Create a Google Analytics account/property for MINDFKD, add a Web data stream for `https://mindfkd.com`, then find the G- ID in Admin → Data streams → your web stream. [Google's instructions](https://support.google.com/analytics/answer/12270356?hl=en). Put the ID in `.env.local` before `npm run build:site`, or in the production build environment. Setting only a Worker runtime variable will NOT change an already exported browser bundle. Never enter a Google API secret here.

Disable the stream's Enhanced Measurement automatic page/history tracking and other automatic interaction collection before enabling this integration. The app owns `page_view`; `send_page_view:false` alone does not disable Enhanced Measurement history events. This also prevents auto-collected search, forms or link text from bypassing the allowlist. Keep Google Signals and ad personalization off. Do not add a second tag through Tag Manager. Set data retention and access roles deliberately; validate real delivery in GA Realtime/DebugView after configuration and consent. No real Google collection has been verified without an ID.

Vercel: on a Vercel deployment, enable Web Analytics and Speed Insights in the project dashboard, set `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=true`, and redeploy with Vercel's `VERCEL=1` build environment. Both official Next components are mounted only on supported hosting, production domains, and after consent. Automatic Vercel page views are not duplicated with custom page events. The present Sites host has no Vercel ingestion endpoints, so both remain gated off. Merely installing these packages does not activate a dashboard. See [Analytics setup](https://vercel.com/docs/analytics/quickstart) and [Speed Insights setup](https://vercel.com/docs/speed-insights/quickstart).

## Identity, consent and retention

Production tracking requires a configured provider, `mindfkd.com` or `www.mindfkd.com`, explicit Allow analytics, and no Do Not Track or Global Privacy Control signal. A small footer preferences disclosure appears only when configured; no overlay interrupts gameplay. With no consent, there is no analytics ID or pre-consent event backlog. Choosing Decline stops delivery, clears local analytics state and first-party `_ga` cookies. It cannot delete events already received by providers. Essential game stats and signed-in state remain independent.

`mindfkd_player_id` stores a random UUID as JSON in localStorage. It is a browser identifier, not a person's identity; it is never tied to Google identity, email, username or display name. The session UUID is in sessionStorage, renewed after 30 minutes of inactivity. This is tab-scoped, not a cross-tab session. Each guest start generates a new run UUID. Each accepted ranked start uses its authoritative server run UUID; request failures before acceptance do not create an analytics run. IDs connect events without fingerprinting. Storage failures fall back to memory for this page.

Local `mindfkd_retention` stores first_visit_date, last_visit_date, last_play_date and total_visit_days. Dates follow the browser's calendar timezone. Only distinct observed calendar days increment the count; a later day generates one returning_player event per tab state. Changing timezone, clearing storage or simultaneous tabs can affect local retention. This is V0 instrumentation, not server cohort truth. Completion summaries include locally observed guest and ranked runs; they do not import lifetime scores from another device.

## Events

All central envelopes include `player_id`, `session_id`, first-touch acquisition and current-session acquisition. GA sends `app_session_id` to avoid colliding with GA's reserved session semantics. Numeric times below are seconds except `response_time_ms`. Accuracy is a percentage 0–100. No answer text is sent.

| Event | When | Properties |
| --- | --- | --- |
| page_view | Initial consented visit and changed path; repeated StrictMode effects deduplicated | page, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term |
| game_started | Once per accepted new run | run_id, mode (guest/ranked), starting_time, previous_best_score, previous_best_level, games_played, is_returning_player |
| question_shown | Once per question displayed in a run | run_id, question_id, level, difficulty, category, question_type, time_remaining |
| question_answered | Once per accepted answer, including retried ranked responses | run_id, question_id, level, difficulty, category, question_type, correct, response_time_ms, time_before_answer, time_after_answer, combo_before, combo_after, score_awarded, current_score |
| level_reached | Levels 5,10,15,20,25,30,35,40,50 once each per run | run_id, level, score, time_remaining, combo |
| combo_reached | First occurrence of streak 5,10,15,20 per run | run_id, combo, level, score, time_remaining |
| game_over | Once when a result is observed | run_id, final_score, final_level, correct_answers, wrong_answers, accuracy, best_combo, questions_attempted, run_duration_seconds, previous_best_score, new_personal_best, mode |
| run_replayed | New run after an observed completed run in the same session | run_id, previous_run_id, previous_score, previous_level |
| score_shared | Successful native share resolution or clipboard write, not cancellation/failure | run_id, score, level, share_method (native_share/clipboard; challenge_link is reserved for a future successful operation) |
| stats_opened | Stats button opened | games_played, best_score, best_level |
| how_to_play_opened | Help button opened | none |
| returning_player | First observed visit on a later calendar day | days_since_last_visit, total_visit_days, games_played |
| challenge_opened | A valid shared ranked result loads on a profile | challenge_id, page |

Milestones are configurable constants in `lib/analytics/types.ts`. Ranked answer timings use the server receipt and include transport time; guest timings use the monotonic browser clock. Run duration is elapsed browser time until result receipt, so ranked network delay is included. An abandoned tab without a result has a start but no completion; this is intentional funnel drop-off.

GA receives the full event list. Page/start events include sanitized first/current acquisition; other events join via IDs. Parameters are capped below GA's 25-property limit. Do not register high-cardinality run/player IDs as custom report dimensions; export for analysis if needed. Register useful categorical fields and numeric metrics in GA as required. Vercel custom events are restricted to game_started, game_over, run_replayed, score_shared, challenge_opened, stats_opened and how_to_play_opened, with ID properties omitted. Per-question events go only to GA/debug to control Vercel volume/cost. Configure quotas before enabling at scale.

## Attribution

First touch is the first consented/observed landing, persisted locally. Current session attribution is captured when a session begins. Referrers contain origin only; page URLs strip all query strings, hashes and unrecognized paths. UTM labels accept 1–80 ASCII letters, digits, underscores or hyphens. Do not put names, email addresses, private search terms or other personal information in campaign labels.

Recommended links:

- Instagram: `https://mindfkd.com/?utm_source=instagram&utm_medium=social&utm_campaign=launch`
- TikTok: `https://mindfkd.com/?utm_source=tiktok&utm_medium=social&utm_campaign=launch`
- YouTube: `https://mindfkd.com/?utm_source=youtube&utm_medium=social&utm_campaign=launch`
- Reddit: `https://mindfkd.com/?utm_source=reddit&utm_medium=community&utm_campaign=launch`
- Creator: `https://mindfkd.com/?utm_source=creatorname&utm_medium=creator&utm_campaign=creator_challenge`

## Testing

```sh
npm run typecheck
npm run lint
npm test
npm run build:site
NEXT_PUBLIC_ANALYTICS_DEBUG=true npm run dev -- --webpack --port 3101
```

On machines with file-watcher limits, add `WATCHPACK_POLLING=true` to the dev command. Visit localhost with a campaign link, inspect `[MINDFKD Analytics]` console logs, start a run, submit answers, let time expire and replay. Expect one start/end per run and one answer per submission; every replay has a distinct run ID. Share cancellation must not produce score_shared. Reloading retains player ID but not a run in progress. DNT/GPC disables even debug logging. Development never sends to external providers, including with a real ID; debug defaults off. A production build on localhost is also externally disabled.

Tests cover identity stability, attribution, sessions, retention, duplicate suppression, missing configuration, privacy gates, deferred provider delivery, storage failures and provider exceptions. Gameplay tests cover score/timer rules, question history and authoritative ranked retries. Analytics schedules provider calls after game state updates; there are no analytics calls or effects inside Timer's animation-frame loop. Browser checks validate normal play and logs; no controlled before/after performance benchmark is claimed.

## Privacy work and limitations

No names, emails, manually collected IPs, exact locations, fingerprints, answer text or profile text enter event properties. Random persistent identifiers are pseudonymous and still warrant privacy controls. Providers receive normal network metadata under their own policies; review their processing terms, regional configuration, retention, deletion procedures and your site's consent/privacy wording before activating. Test withdrawal and real network payloads with the actual provider account. `/privacy` describes the optional instrumentation.

Only consenting, unblocked browsers contribute. Blockers, offline use, closing a page before a deferred send, provider queue limits and cleared storage cause losses. No durable retry queue or server reconciliation exists. Multiple devices are separate players. A successful native share means the share promise resolved, not that a friend clicked or installed anything. Profile result opens support a preliminary challenge funnel but not a measured viral coefficient. Country/device/browser reporting depends on provider configuration; the app does not collect them itself. True D1/D7/D30 cohorts and DAU/WAU/MAU require provider analysis/export, not the local counters. No dashboard or fake production data was created.

To add PostHog, Amplitude, Mixpanel or a backend later, implement `AnalyticsProvider.send(Envelope)` and register it in AnalyticsRoot. Keep its initialization and delivery behind the existing privacy/development gates, define event-volume policy, and update privacy disclosures. Do not call a provider directly from gameplay.

Category selection is included as the allowlisted `genre` field on game-start/end events. Competition invite query strings are excluded from page analytics; `/compete` is a known page path. Live submitted answers remain application data and are never analytics payloads.

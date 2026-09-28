import { track } from "@vercel/analytics";
import type { AnalyticsProvider, Envelope, Properties } from "./types";
import { safePage } from "./core";
export type GoogleWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};
export function googleParameters(event: Envelope): Properties {
  const p: Properties = {
    ...event.properties,
    player_id: event.player_id,
    app_session_id: event.session_id,
  };
  if (event.name === "page_view" || event.name === "game_started") {
    for (const [k, v] of Object.entries(event.acquisition)) if (v) p[k] = v;
    for (const [k, v] of Object.entries(event.firstTouch))
      if (v) p["first_touch_" + k.replace("utm_", "")] = v;
  }
  // Keep below GA4's 25 event-parameter limit including sanitized page metadata.
  return Object.fromEntries(Object.entries(p).slice(0, 22));
}
export function createGoogleProvider(id: string, allowed: () => boolean) {
  const buffer: Envelope[] = [];
  let ready = false,
    configured = false;
  function send(event: Envelope) {
    if (!allowed()) return;
    if (!ready) {
      if (buffer.length === 100) buffer.shift();
      buffer.push(event);
      return;
    }
    const w = window as GoogleWindow;
    const page =
      typeof event.properties.page === "string"
        ? safePage(event.properties.page)
        : safePage(location.pathname);
    w.gtag?.("event", event.name, {
      ...googleParameters(event),
      page_location: location.origin + page,
      page_referrer: event.acquisition.referrer ?? "",
      send_to: id,
    });
  }
  return {
    name: "ga4",
    send,
    load() {
      if (!allowed()) return;
      const w = window as GoogleWindow;
      w.dataLayer ??= [];
      w.gtag ??= function () {
        // Google tag requires an Arguments object, not an ordinary array.
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      };
      if (!configured) {
        configured = true;
        w.gtag("js", new Date());
        w.gtag("config", id, {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          page_location: location.origin + safePage(location.pathname),
          page_referrer: "",
        });
      }
      ready = true;
      for (const e of buffer.splice(0)) send(e);
    },
    consent(granted: boolean) {
      (window as unknown as Record<string, unknown>)["ga-disable-" + id] =
        !granted;
      if (!granted) buffer.splice(0);
    },
  } satisfies AnalyticsProvider & {
    load(): void;
    consent(granted: boolean): void;
  };
}
const vercelEvents = new Set([
  "game_started",
  "game_over",
  "run_replayed",
  "score_shared",
  "challenge_opened",
  "stats_opened",
  "how_to_play_opened",
]);
export function createVercelProvider(
  allowed: () => boolean,
): AnalyticsProvider {
  return {
    name: "vercel",
    send(event) {
      // Pageviews are automatic in <Analytics/>. Do not send per-question or ID-rich data.
      if (
        !allowed() ||
        !vercelEvents.has(event.name) ||
        (window.vaq?.length ?? 0) > 100
      )
        return;
      const properties = Object.fromEntries(
        Object.entries(event.properties).filter(([k]) => !k.endsWith("_id")),
      );
      track(event.name, properties);
    },
  };
}

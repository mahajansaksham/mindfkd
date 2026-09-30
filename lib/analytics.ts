import {
  createAnalytics,
  type AnalyticsEngine,
  type Consent,
  type Store,
} from "./analytics/core";
import type { AnalyticsEventMap, EventName } from "./analytics/types";
export { isAnalyticsLevelMilestone } from "./analytics/types";
export type {
  AnalyticsEventMap,
  AnalyticsProvider,
  Envelope,
} from "./analytics/types";
export const GA_ID = /^G-[A-Z0-9]+$/.test(
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-1PWY0WZQ6H",
)
  ? (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-1PWY0WZQ6H")
  : "";
export const ANALYTICS_DEBUG =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";
export const consentKey = "mindfkd_analytics_consent";
let engine: AnalyticsEngine | undefined;
let consentMemory: Consent = "unknown";
let vercelEnabled = false;
const listeners = new Set<() => void>();
const memory = new Map<string, string>();
function store(kind: "localStorage" | "sessionStorage"): Store {
  return {
    getItem(key) {
      try {
        return window[kind].getItem(key) ?? memory.get(kind + key) ?? null;
      } catch {
        return memory.get(kind + key) ?? null;
      }
    },
    setItem(key, value) {
      memory.set(kind + key, value);
      try {
        window[kind].setItem(key, value);
      } catch {}
    },
    removeItem(key) {
      memory.delete(kind + key);
      try {
        window[kind].removeItem(key);
      } catch {}
    },
  };
}
export function privacySignal() {
  if (typeof navigator === "undefined") return true;
  return (
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}
export function getAnalyticsConsent(): Consent {
  if (typeof window === "undefined") return "unknown";
  if (privacySignal()) return "denied";
  try {
    const saved = store("localStorage").getItem(consentKey);
    if (saved === "granted" || saved === "denied") return saved;
  } catch {}
  return consentMemory;
}
export function setAnalyticsConsent(choice: Exclude<Consent, "unknown">) {
  consentMemory = choice;
  store("localStorage").setItem(consentKey, choice);
  if (choice === "denied") {
    engine?.reset();
    store("localStorage").removeItem("mindfkd_analytics_summary");
    // Withdraw first-party GA cookies as well as stopping providers.
    if (typeof document !== "undefined")
      for (const c of document.cookie.split(";")) {
        const name = c.trim().split("=")[0];
        if (/^_ga(?:_|$)/.test(name))
          for (const domain of [
            "",
            `;domain=${location.hostname}`,
            ";domain=.mindfkd.com",
          ])
            document.cookie = `${name}=;Max-Age=0;path=/${domain};SameSite=Lax;Secure`;
      }
  }
  for (const listener of listeners) listener();
}
export function subscribeAnalyticsConsent(listener: () => void) {
  listeners.add(listener);
  const changed = () => listener();
  window.addEventListener("storage", changed);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", changed);
  };
}
export function configureVercelAnalytics(hosted: boolean) {
  vercelEnabled =
    hosted && process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === "true";
}
export function isVercelAnalyticsEnabled() {
  return vercelEnabled;
}
export function getAnalytics(): AnalyticsEngine | undefined {
  if (typeof window === "undefined") return undefined;
  engine ??= createAnalytics({
    local: store("localStorage"),
    session: store("sessionStorage"),
    now: Date.now,
    uuid: () => crypto.randomUUID(),
    href: () => location.href,
    referrer: () => document.referrer,
    hostname: () => location.hostname,
    privacySignal,
    consent: getAnalyticsConsent,
    production: process.env.NODE_ENV === "production",
    debug: ANALYTICS_DEBUG,
    get configured() {
      return !!GA_ID || vercelEnabled;
    },
    defer: (callback) => {
      setTimeout(callback, 0);
    },
    log: (e) =>
      console.log("[MINDFKD Analytics]", e.name, {
        ...e.properties,
        player_id: e.player_id,
        session_id: e.session_id,
        acquisition: e.acquisition,
        first_touch: e.firstTouch,
      }),
  });
  return engine;
}
export function trackEvent<K extends EventName>(
  event: K,
  properties: AnalyticsEventMap[K],
  dedupeKey?: string,
) {
  try {
    getAnalytics()?.track(event, properties, dedupeKey);
  } catch {}
}
export const trackGameStarted = (
  p: Omit<AnalyticsEventMap["game_started"], "is_returning_player">,
) => {
  try {
    getAnalytics()?.begin(p);
  } catch {}
};
export const trackQuestionAnswered = (
  p: AnalyticsEventMap["question_answered"],
) => trackEvent("question_answered", p, `answer:${p.run_id}:${p.question_id}`);
export const trackQuestionShown = (p: AnalyticsEventMap["question_shown"]) =>
  trackEvent("question_shown", p, `shown:${p.run_id}:${p.question_id}`);
export const trackLevelReached = (p: AnalyticsEventMap["level_reached"]) =>
  trackEvent("level_reached", p, `level:${p.run_id}:${p.level}`);
export const trackGameOver = (p: AnalyticsEventMap["game_over"]) => {
  try {
    getAnalytics()?.complete(p);
  } catch {}
};
export const trackReplay = (p: AnalyticsEventMap["run_replayed"]) =>
  trackEvent("run_replayed", p, `replay:${p.run_id}`);
export const trackShare = (p: AnalyticsEventMap["score_shared"]) =>
  trackEvent("score_shared", p);
export const trackChallengeOpened = (
  p: AnalyticsEventMap["challenge_opened"],
) => trackEvent("challenge_opened", p, `challenge:${p.challenge_id}`);
export type AnalyticsSummary = {
  gamesPlayed: number;
  bestScore: number;
  bestLevel: number;
};
export function analyticsSummary(fallback: AnalyticsSummary): AnalyticsSummary {
  try {
    if (!getAnalytics()?.canTrack()) return fallback;
    const v = JSON.parse(
      store("localStorage").getItem("mindfkd_analytics_summary") ?? "null",
    );
    if (
      v &&
      ["gamesPlayed", "bestScore", "bestLevel"].every(
        (k) => Number.isFinite(v[k]) && v[k] >= 0,
      )
    )
      return v;
  } catch {}
  return fallback;
}
export function saveAnalyticsSummary(s: AnalyticsSummary) {
  try {
    if (getAnalytics()?.canTrack())
      store("localStorage").setItem(
        "mindfkd_analytics_summary",
        JSON.stringify(s),
      );
  } catch {}
}

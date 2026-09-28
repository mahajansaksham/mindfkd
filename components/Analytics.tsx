"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  GA_ID,
  getAnalytics,
  getAnalyticsConsent,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
  configureVercelAnalytics,
  isVercelAnalyticsEnabled,
  privacySignal,
} from "../lib/analytics";
import {
  createGoogleProvider,
  createVercelProvider,
} from "../lib/analytics/providers";
import { sanitizeURL } from "../lib/analytics/core";
import { readStats } from "../lib/storage";
export default function AnalyticsRoot({
  vercelHosted,
}: {
  vercelHosted: boolean;
}) {
  const path = usePathname();
  const consent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    getAnalyticsConsent,
    () => "unknown" as const,
  );
  const google = useRef<ReturnType<typeof createGoogleProvider> | null>(null);
  const configured =
    !!GA_ID ||
    (vercelHosted &&
      process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === "true");
  useEffect(() => {
    configureVercelAnalytics(vercelHosted);
    const analytics = getAnalytics();
    if (!analytics) return;
    google.current ??= createGoogleProvider(GA_ID, analytics.externalAllowed);
    const removeGoogle = GA_ID ? analytics.register(google.current) : () => {};
    const removeVercel = isVercelAnalyticsEnabled()
      ? analytics.register(createVercelProvider(analytics.externalAllowed))
      : () => {};
    return () => {
      removeGoogle();
      removeVercel();
    };
  }, [vercelHosted]);
  useEffect(() => {
    google.current?.consent(consent === "granted" && !privacySignal());
    getAnalytics()?.visit(path, readStats().gamesPlayed);
  }, [path, consent]);
  const external =
    process.env.NODE_ENV === "production" &&
    consent === "granted" &&
    typeof window !== "undefined" &&
    ["mindfkd.com", "www.mindfkd.com"].includes(window.location.hostname) &&
    !privacySignal();
  const redact = <T extends { url: string }>(e: T) =>
    getAnalytics()?.externalAllowed()
      ? { ...e, url: sanitizeURL(e.url) }
      : null;
  return (
    <>
      {external && GA_ID && (
        <Script
          id="mindfkd-ga4"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
          strategy="afterInteractive"
          onReady={() => {
            try {
              google.current?.load();
            } catch {}
          }}
        />
      )}
      {external &&
        vercelHosted &&
        process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === "true" && (
          <>
            <Analytics mode="production" debug={false} beforeSend={redact} />
            <SpeedInsights debug={false} beforeSend={redact} />
          </>
        )}
      {configured && (
        <details className="analytics-choices">
          <summary>Analytics preferences</summary>
          <p>
            Optional usage analytics help improve MINDFKD. No names, emails or
            answer text are sent. Your choice does not affect play.
          </p>
          <div>
            <button
              type="button"
              onClick={() => setAnalyticsConsent("granted")}
            >
              Allow analytics
            </button>
            <button type="button" onClick={() => setAnalyticsConsent("denied")}>
              Decline analytics
            </button>
          </div>
          <p role="status">
            {consent === "unknown"
              ? "Off until you choose."
              : consent === "granted"
                ? "Analytics allowed."
                : "Analytics disabled."}
          </p>
        </details>
      )}
    </>
  );
}

import type {
  Acquisition,
  AnalyticsEventMap,
  AnalyticsProvider,
  Envelope,
  EventName,
  Properties,
} from "./types";
export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type Consent = "granted" | "denied" | "unknown";
export type Runtime = {
  local: Store;
  session: Store;
  now(): number;
  uuid(): string;
  href(): string;
  referrer(): string;
  hostname(): string;
  privacySignal(): boolean;
  consent(): Consent;
  production: boolean;
  debug: boolean;
  configured: boolean;
  defer(callback: () => void): void;
  log(event: Envelope): void;
};
export const KEYS = {
  player: "mindfkd_player_id",
  retention: "mindfkd_retention",
  firstTouch: "mindfkd_first_touch",
  session: "mindfkd_analytics_session",
} as const;
export const productionHost = (host: string) =>
  ["mindfkd.com", "www.mindfkd.com"].includes(host.toLowerCase());
export function safePage(path: string) {
  return ["/", "/profile", "/leaderboard", "/privacy", "/questions"].includes(
    path,
  )
    ? path
    : "/other";
}
export function sanitizeURL(url: string) {
  try {
    const u = new URL(url);
    return u.origin + safePage(u.pathname);
  } catch {
    return "https://mindfkd.com/other";
  }
}
export function acquisition(href: string, referrer: string): Acquisition {
  const out: Acquisition = {};
  try {
    const url = new URL(href);
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ] as const) {
      const v = url.searchParams.get(key);
      // Campaign labels, not arbitrary URLs, email addresses, search strings or user content.
      if (v && /^[a-zA-Z0-9_-]{1,80}$/.test(v)) out[key] = v;
    }
    if (referrer) {
      const ref = new URL(referrer);
      if (["http:", "https:"].includes(ref.protocol)) out.referrer = ref.origin;
    }
  } catch {
    /* Malformed attribution must not affect play. */
  }
  return out;
}
function read<T>(store: Store, key: string): T | null {
  try {
    return JSON.parse(store.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}
function write(store: Store, key: string, value: unknown) {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {}
}
const day = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayNumber = (date: string) => Date.parse(date + "T12:00:00Z") / 86400000;
type Retention = {
  first_visit_date: string;
  last_visit_date: string;
  last_play_date: string | null;
  total_visit_days: number;
};
type Session = {
  id: string;
  lastActive: number;
  acquisition: Acquisition;
  previousRun?: { id: string; score: number; level: number };
};
const fields: Record<EventName, string> = {
  page_view:
    "page referrer utm_source utm_medium utm_campaign utm_content utm_term",
  game_started:
    "run_id mode starting_time previous_best_score previous_best_level games_played is_returning_player",
  question_shown:
    "run_id question_id level difficulty category question_type time_remaining",
  question_answered:
    "run_id question_id level difficulty category question_type correct response_time_ms time_before_answer time_after_answer combo_before combo_after score_awarded current_score",
  level_reached: "run_id level score time_remaining combo",
  combo_reached: "run_id combo level score time_remaining",
  game_over:
    "run_id final_score final_level correct_answers wrong_answers accuracy best_combo questions_attempted run_duration_seconds previous_best_score new_personal_best mode",
  run_replayed: "run_id previous_run_id previous_score previous_level",
  score_shared: "run_id score level share_method",
  stats_opened: "games_played best_score best_level",
  how_to_play_opened: "",
  returning_player: "days_since_last_visit total_visit_days games_played",
  challenge_opened: "challenge_id page",
};
export function createAnalytics(runtime: Runtime) {
  const providers = new Map<string, AnalyticsProvider>();
  const once = new Set<string>();
  let player: string | undefined,
    session: Session | undefined,
    firstTouch: Acquisition | undefined,
    retention: Retention | undefined;
  let lastPage = "",
    knownGamesPlayed = 0;
  const allowed = () =>
    !runtime.privacySignal() &&
    (runtime.production
      ? runtime.configured &&
        productionHost(runtime.hostname()) &&
        runtime.consent() === "granted"
      : runtime.debug);
  const externalAllowed = () => allowed() && runtime.production;
  function enqueue(name: EventName, properties: Properties) {
    if (!player || !session || !firstTouch) return;
    const event: Envelope = {
      name,
      properties,
      player_id: player,
      session_id: session.id,
      acquisition: { ...session.acquisition },
      firstTouch: { ...firstTouch },
    };
    runtime.defer(() => {
      if (!allowed()) return;
      if (!runtime.production && runtime.debug) {
        try {
          runtime.log(event);
        } catch {}
      }
      if (externalAllowed())
        for (const p of providers.values()) {
          try {
            p.send(event);
          } catch {}
        }
    });
  }
  function initialize(gamesPlayed = knownGamesPlayed) {
    knownGamesPlayed = gamesPlayed;
    if (!allowed()) return false;
    const now = runtime.now();
    if (!player) {
      const saved = read<unknown>(runtime.local, KEYS.player);
      player =
        typeof saved === "string" && /^[\w-]{16,80}$/.test(saved)
          ? saved
          : runtime.uuid();
      write(runtime.local, KEYS.player, player);
    }
    if (!firstTouch) {
      const saved = read<Acquisition>(runtime.local, KEYS.firstTouch);
      firstTouch =
        saved && typeof saved === "object" && !Array.isArray(saved)
          ? acquisition(
              "https://mindfkd.com/?" + new URLSearchParams(saved).toString(),
              saved.referrer ?? "",
            )
          : acquisition(runtime.href(), runtime.referrer());
      write(runtime.local, KEYS.firstTouch, firstTouch);
    }
    session ??= read<Session>(runtime.session, KEYS.session) ?? undefined;
    if (
      !session ||
      typeof session.id !== "string" ||
      !Number.isFinite(session.lastActive) ||
      now - session.lastActive > 30 * 60 * 1000 ||
      now < session.lastActive ||
      !session.acquisition
    ) {
      session = {
        id: runtime.uuid(),
        lastActive: now,
        acquisition: acquisition(runtime.href(), runtime.referrer()),
      };
      lastPage = "";
    }
    session.lastActive = now;
    write(runtime.session, KEYS.session, session);
    retention ??= read<Retention>(runtime.local, KEYS.retention) ?? undefined;
    const today = day(now);
    if (
      !retention ||
      !Number.isFinite(dayNumber(retention.last_visit_date)) ||
      !Number.isInteger(retention.total_visit_days) ||
      retention.total_visit_days < 1
    ) {
      retention = {
        first_visit_date: today,
        last_visit_date: today,
        last_play_date: null,
        total_visit_days: 1,
      };
      write(runtime.local, KEYS.retention, retention);
    } else if (today > retention.last_visit_date) {
      const gap = Math.round(
        dayNumber(today) - dayNumber(retention.last_visit_date),
      );
      retention = {
        ...retention,
        last_visit_date: today,
        total_visit_days: retention.total_visit_days + 1,
      };
      write(runtime.local, KEYS.retention, retention);
      enqueue("returning_player", {
        days_since_last_visit: gap,
        total_visit_days: retention.total_visit_days,
        games_played: gamesPlayed,
      });
    }
    return true;
  }
  function track<K extends EventName>(
    name: K,
    properties: AnalyticsEventMap[K],
    dedupeKey?: string,
  ) {
    try {
      if (
        !initialize(
          "games_played" in properties
            ? Number(properties.games_played)
            : knownGamesPlayed,
        )
      )
        return;
      if (dedupeKey) {
        if (once.has(dedupeKey)) return;
        once.add(dedupeKey);
        if (once.size > 10000) once.delete(once.values().next().value!);
      }
      const clean: Properties = {};
      for (const key of fields[name].split(" ")) {
        const value = (properties as Properties)[key];
        if (typeof value === "string") clean[key] = value.slice(0, 100);
        else if (
          typeof value === "boolean" ||
          (typeof value === "number" && Number.isFinite(value))
        )
          clean[key] = value;
      }
      enqueue(name, clean);
    } catch {
      /* Analytics must never propagate an error into gameplay. */
    }
  }
  return {
    track,
    externalAllowed,
    canTrack: allowed,
    register(provider: AnalyticsProvider) {
      providers.set(provider.name, provider);
      return () => {
        providers.delete(provider.name);
      };
    },
    visit(path: string, gamesPlayed: number) {
      try {
        if (!initialize(gamesPlayed)) return;
        const page = safePage(path);
        if (page === lastPage) return;
        lastPage = page;
        track("page_view", { page, ...session!.acquisition });
      } catch {}
    },
    begin(
      properties: Omit<
        AnalyticsEventMap["game_started"],
        "is_returning_player"
      >,
    ) {
      try {
        if (!initialize(properties.games_played)) return;
        const previous = session?.previousRun;
        if (previous && previous.id !== properties.run_id)
          track(
            "run_replayed",
            {
              run_id: properties.run_id,
              previous_run_id: previous.id,
              previous_score: previous.score,
              previous_level: previous.level,
            },
            "replay:" + properties.run_id,
          );
        track(
          "game_started",
          {
            ...properties,
            is_returning_player:
              retention!.total_visit_days > 1 || properties.games_played > 0,
          },
          "start:" + properties.run_id,
        );
        retention!.last_play_date = day(runtime.now());
        write(runtime.local, KEYS.retention, retention);
      } catch {}
    },
    complete(properties: AnalyticsEventMap["game_over"]) {
      track("game_over", properties, "end:" + properties.run_id);
      if (session) {
        session.previousRun = {
          id: properties.run_id,
          score: properties.final_score,
          level: properties.final_level,
        };
        write(runtime.session, KEYS.session, session);
      }
    },
    reset() {
      player = undefined;
      session = undefined;
      firstTouch = undefined;
      retention = undefined;
      lastPage = "";
      once.clear();
      for (const key of [KEYS.player, KEYS.retention, KEYS.firstTouch])
        try {
          runtime.local.removeItem(key);
        } catch {}
      try {
        runtime.session.removeItem(KEYS.session);
      } catch {}
    },
  };
}
export type AnalyticsEngine = ReturnType<typeof createAnalytics>;

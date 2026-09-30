"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Run } from "../lib/game";
import { multiplier } from "../lib/game";
import { RULES, comboHeat } from "../lib/rules";
import type { SequenceResult } from "../lib/sequence";
import { createRunTracker } from "../lib/analytics/run";
import { trackEvent, trackShare } from "../lib/analytics";
import {
  readStats,
  readQuestionHistory,
  rememberQuestion,
} from "../lib/storage";
import { useAccount } from "./Account";
import Timer from "./Timer";
import Question from "./Question";
export type Snapshot = {
  id: string;
  version: number;
  remainingMs: number;
  waitMs: number;
  run: Run;
  outcomes: boolean[];
  result: SequenceResult | null;
};
export type Challenge = {
  parentId: string | null;
  opponents: (SequenceResult & { name: string })[];
  id: string;
  kind: "daily" | "friend";
  day: string | null;
  number: number | null;
  creatorName: string;
  ready: boolean;
  isCreator: boolean;
  expiresAt: number;
  creatorResult: (SequenceResult & { name: string }) | null;
  attempt: Snapshot | null;
  leaderboard: (SequenceResult & {
    name: string;
    username: string | null;
    rank: number;
  })[];
};
export default function SequenceGame({ daily = false }: { daily?: boolean }) {
  const account = useAccount();
  const [set, setSet] = useState<Challenge | null>(null),
    [snap, setSnap] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [shareFallback, setShareFallback] = useState(""),
    [pending, setPending] = useState<string | string[] | null>(null);
  const locked = useRef(false),
    latest = useRef<Snapshot | null>(null),
    tracker = useRef<ReturnType<typeof createRunTracker> | null>(null),
    retry = useRef<(() => void) | null>(null);
  const accept = useCallback(
    (s: Snapshot) => {
      s.run.deadline = performance.now() + s.remainingMs;
      if (
        s.run.question &&
        latest.current?.run.question?.id !== s.run.question.id
      )
        rememberQuestion(s.run.question, readQuestionHistory());
      latest.current = s;
      setSnap(s);
      setPending(null);
      if (tracker.current?.id !== s.id)
        tracker.current = createRunTracker(
          s.id,
          daily ? "daily" : "challenge",
          readStats(),
          "mixed",
        );
      tracker.current.observe(s.run);
    },
    [daily],
  );
  const load = useCallback(
    async (id?: string) => {
      const c = await api<Challenge>(
        daily
          ? "/api/challenges/daily"
          : `/api/challenges/set?id=${encodeURIComponent(id!)}`,
      );
      setSet(c);
      if (c.attempt) accept(c.attempt);
    },
    [daily, accept],
  );
  useEffect(() => {
    let cancelled = false;
    const id =
      location.pathname.match(/^\/v\/([a-f0-9-]{36})\/?$/)?.[1] ??
      new URLSearchParams(location.search).get("id");
    if (!daily && !id) return;
    const run = () =>
      void load(id ?? undefined).catch((e) => {
        if (!cancelled) setError(e.message);
      });
    retry.current = run;
    run();
    if (id) trackEvent("challenge_opened", { challenge_id: id, page: "/v" });
    return () => {
      cancelled = true;
    };
  }, [daily, load]);
  const request = useCallback(
    async (action: string, data: Record<string, unknown>) => {
      if (locked.current) return;
      locked.current = true;
      setBusy(true);
      setError("");
      if (action === "create" && !data.requestId)
        data = { ...data, requestId: crypto.randomUUID() };
      retry.current = () => void request(action, data);
      try {
        if (action === "create") {
          const c = await api<Challenge>("/api/challenges/create", data);
          setSet(c);
          latest.current = null;
          setSnap(null);
          setPending(null);
          window.history.replaceState(null, "", `/v/${c.id}`);
        } else accept(await api<Snapshot>("/api/challenges/" + action, data));
        retry.current = null;
      } catch (e) {
        setError((e as Error).message);
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [accept],
  );
  const finish = useCallback(() => {
    const s = latest.current;
    if (s && s.run.phase !== "gameOver" && !locked.current)
      void request("finish", { id: s.id, version: s.version });
  }, [request]);
  useEffect(() => {
    if (!snap || snap.run.phase === "gameOver" || busy || error) return;
    const feedback = snap.run.phase === "feedback";
    const t = setTimeout(
      () =>
        feedback
          ? void request("next", { id: snap.id, version: snap.version })
          : finish(),
      feedback
        ? Math.max(30, snap.waitMs + 30)
        : Math.max(30, snap.run.deadline - performance.now() + 30),
    );
    return () => clearTimeout(t);
  }, [snap, busy, error, request, finish]);
  const setId = set?.id;
  useEffect(() => {
    if (snap?.run.phase !== "gameOver" || !setId) return;
    void api<Challenge>(
      daily ? "/api/challenges/daily" : `/api/challenges/set?id=${setId}`,
    )
      .then(setSet)
      .catch(() => {});
  }, [snap?.run.phase, setId, daily]); // Refresh actual rankings/comparison after the accepted result.
  function answer(answer: string | string[]) {
    const s = latest.current;
    if (!s || locked.current) return;
    setPending(answer);
    void request("answer", { id: s.id, version: s.version, answer });
  }
  async function share() {
    if (!set || !snap) return;
    const url = daily
      ? "https://mindfkd.com/daily"
      : `https://mindfkd.com/v/${set.id}`;
    const text = `MINDFKD ${daily ? "#" + set.number : "— Think you’re smarter?"}\n🧠 Level ${snap.run.level}\n🔥 ${snap.run.bestCombo} combo\n⚡ ${snap.run.score.toLocaleString("en-US")}\n\n${
      snap.outcomes
        .map((v) => (v ? "🟩" : "🟥"))
        .join("")
        .match(/.{1,8}/gu)
        ?.join("\n") ?? ""
    }\n\n${url}`;
    let method: "native_share" | "clipboard" = "clipboard";
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: "MINDFKD", text });
          method = "native_share";
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          await navigator.clipboard.writeText(text);
        }
      } else await navigator.clipboard.writeText(text);
      setMessage(
        method === "clipboard" ? "Copied. Send it to a friend." : "Shared.",
      );
      trackShare({
        run_id: snap.id,
        score: snap.run.score,
        level: snap.run.level,
        share_method: method,
      });
    } catch {
      setShareFallback(text);
      setMessage("Select and copy your result below.");
    }
  }
  const r = snap?.run,
    result = snap?.result,
    playing = r && (r.phase === "playing" || r.phase === "feedback");
  return (
    <main className="game-shell sequence-shell">
      <header>
        <Link href="/" className="brand">
          MIND<span>FKD</span>
          <i />
        </Link>
        <div className="hud-score">
          <span className="eyebrow">
            {daily ? "DAILY" : "FRIEND CHALLENGE"}
          </span>
          <strong>{r?.score.toLocaleString() ?? "30.00"}</strong>
        </div>
      </header>
      {error && (
        <div className="network-error" role="alert">
          {error}
          <button
            className="outline-button"
            disabled={busy}
            onClick={() => retry.current?.()}
          >
            RETRY
          </button>
          {playing && (
            <p>The clock keeps running during connection interruptions.</p>
          )}
        </div>
      )}
      {playing ? (
        <div className="play">
          <div className="level-row">
            <span className="eyebrow">LEVEL {r.level}</span>
            <span className="eyebrow">
              {daily ? `DAILY #${set?.number}` : "SAME QUESTIONS. SAME RULES."}
            </span>
          </div>
          <Timer
            deadline={r.deadline}
            onExpire={finish}
            delta={
              r.feedback
                ? (r.feedback.correct ? RULES.bonusMs : -RULES.penaltyMs) / 1000
                : null
            }
          />
          <div className={`combo ${r.combo >= 3 ? "lit" : ""}`}>
            {comboHeat(r.combo)} <strong>×{multiplier(r.combo)}</strong>
          </div>
          {r.question && (
            <Question
              key={r.question.id}
              question={r.question}
              feedback={r.feedback}
              onAnswer={answer}
              disabled={busy || !!error}
              pendingAnswer={pending}
            />
          )}
          <div className="play-bottom eyebrow">
            +4 SECONDS CORRECT · −6 SECONDS WRONG
          </div>
        </div>
      ) : r?.phase === "gameOver" ? (
        <div className="results">
          <div className="eyebrow">
            {daily
              ? `MINDFKD #${set?.number} · ${set?.day}`
              : "YOUR CHALLENGE RESULT"}
          </div>
          <div className="result-score">{r.score.toLocaleString()}</div>
          <h1>
            Brain fried at <span>LEVEL {r.level}.</span>
          </h1>
          <div className="run-stats">
            <div>
              <strong>
                {r.correct}/{r.correct + r.incorrect}
              </strong>
              <span>CORRECT</span>
            </div>
            <div>
              <strong>{result?.accuracy ?? 0}%</strong>
              <span>ACCURACY</span>
            </div>
            <div>
              <strong>{r.bestCombo}</strong>
              <span>BEST COMBO</span>
            </div>
          </div>
          <p className="muted">
            Average answer: {result?.averageResponseMs ?? 0} ms
            {r.reason === "bank" ? " · Full sequence completed." : ""}
          </p>
          {!daily && set?.creatorResult && !set.isCreator && (
            <div className="comparison">
              <strong>
                {r.score > set.creatorResult.score
                  ? "YOU WIN"
                  : r.score < set.creatorResult.score
                    ? `${set.creatorResult.name} WINS`
                    : "IT’S A TIE"}
              </strong>
              <p>
                {r.score.toLocaleString()} :{" "}
                {set.creatorResult.score.toLocaleString()}
              </p>
              <p>
                {set.creatorResult.name}: {set.creatorResult.correct} correct ·{" "}
                {set.creatorResult.accuracy}% ·{" "}
                {set.creatorResult.averageResponseMs} ms average
              </p>
            </div>
          )}
          {set?.isCreator && !!set.opponents.length && (
            <div className="comparison">
              <strong>FRIENDS’ SCORES</strong>
              {set.opponents.map((p, i) => (
                <p key={i}>
                  {p.name} · {p.score.toLocaleString()} · {p.correct} correct /{" "}
                  {p.incorrect} wrong
                </p>
              ))}
            </div>
          )}
          <button className="primary start" onClick={() => void share()}>
            {daily ? "SHARE DAILY RESULT" : "SHARE CHALLENGE ↗"}
          </button>
          <p role="status" className="share-message">
            {message}
          </p>
          {shareFallback && (
            <textarea
              readOnly
              aria-label="Share result"
              value={shareFallback}
              onFocus={(e) => e.target.select()}
            />
          )}
          {daily ? (
            <p className="muted">
              Your official attempt is saved. A new Daily opens at 00:00 UTC.
            </p>
          ) : (
            <button
              className="outline-button"
              disabled={busy}
              onClick={() => void request("create", { parentId: set?.id })}
            >
              REMATCH · NEW QUESTIONS
            </button>
          )}
          <Link className="text-link" href="/">
            BACK TO RUN ↗
          </Link>
        </div>
      ) : (
        <div className="sequence-landing">
          <div className="eyebrow">
            {daily
              ? `DAILY MINDFKD ${set ? "#" + set.number : ""}`
              : "1V1 · PLAY WHEN YOU WANT"}
          </div>
          <h1>
            {daily ? (
              <>
                One day.
                <br />
                <em>One shot.</em>
              </>
            ) : set && !set.isCreator ? (
              <>
                {set.creatorName} has
                <br />
                <em>challenged you.</em>
              </>
            ) : (
              <>
                Think you’re
                <br />
                <em>smarter?</em>
              </>
            )}
          </h1>
          <p>
            {daily
              ? "Everyone gets the same questions. One official attempt per account. Fresh sequence at midnight UTC."
              : "30 seconds. Identical questions, answer order and scoring. Set your score, send the link, settle it."}
          </p>
          {set?.creatorResult && (
            <p className="opponent-target">
              SCORE TO BEAT{" "}
              <strong>{set.creatorResult.score.toLocaleString()}</strong>
            </p>
          )}
          {daily && !account.player ? (
            <button className="primary start" onClick={account.openAccount}>
              SIGN IN FOR DAILY ↗
            </button>
          ) : (
            <button
              className="primary start"
              disabled={
                busy ||
                (daily && !set) ||
                !!(set && !set.ready && !set.isCreator)
              }
              onClick={() =>
                void (set
                  ? request("start", { setId: set.id })
                  : request("create", {}))
              }
            >
              {busy
                ? "PREPARING…"
                : !set
                  ? daily
                    ? "LOADING DAILY…"
                    : "CREATE A CHALLENGE ↗"
                  : set.attempt
                    ? "RESUME YOUR ATTEMPT"
                    : set.isCreator
                      ? "SET YOUR SCORE ↗"
                      : daily
                        ? "START DAILY ↗"
                        : set.ready
                          ? "ACCEPT CHALLENGE ↗"
                          : "WAITING FOR YOUR FRIEND"}
            </button>
          )}
          {!daily && (
            <p className="muted">
              No login needed. Guest results stay with this browser.
            </p>
          )}
          <Link className="text-link" href="/">
            BACK TO RUN
          </Link>
        </div>
      )}
      {daily && set && (
        <details className="daily-board">
          <summary>TODAY’S LEADERBOARD · {set.day}</summary>
          {set.leaderboard.length ? (
            <ol>
              {set.leaderboard.map((p) => (
                <li key={p.rank}>
                  <span>
                    {p.username ? (
                      <Link href={`/profile?u=${p.username}`}>{p.name}</Link>
                    ) : (
                      p.name
                    )}
                  </span>
                  <strong>{p.score.toLocaleString()}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p>No finished attempts yet. Set the first score.</p>
          )}
        </details>
      )}
    </main>
  );
}

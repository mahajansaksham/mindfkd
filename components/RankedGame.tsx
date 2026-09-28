"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Run, multiplier } from "../lib/game";
import { api } from "../lib/api";
import { shareRun, shareText } from "../lib/share";
import { useAccount } from "./Account";
import Timer from "./Timer";
import Question from "./Question";
type Snapshot = {
  id: string;
  version: number;
  remainingMs: number;
  waitMs: number;
  run: Run;
};
export default function RankedGame({ onExit }: { onExit: () => void }) {
  const { player } = useAccount();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const latest = useRef<Snapshot | null>(null),
    locked = useRef(false),
    initial = useRef(false),
    pending = useRef<{ path: string; data: unknown } | null>(null);
  const request = useCallback(async (path: string, data: unknown) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    pending.current = { path, data };
    try {
      const s = await api<Snapshot>(path, data);
      s.run.deadline = performance.now() + s.remainingMs;
      latest.current = s;
      setSnapshot(s);
      pending.current = null;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!initial.current) {
      initial.current = true;
      void request("/api/runs/start", {});
    }
  }, [request]);
  const finish = useCallback(() => {
    const s = latest.current;
    if (s && s.run.phase !== "gameOver" && !locked.current)
      void request("/api/runs/finish", { id: s.id, version: s.version });
  }, [request]);
  useEffect(() => {
    if (!snapshot || snapshot.run.phase !== "feedback" || error) return;
    const id = setTimeout(
      () =>
        void request("/api/runs/next", {
          id: snapshot.id,
          version: snapshot.version,
        }),
      Math.max(50, snapshot.waitMs + 30),
    );
    return () => clearTimeout(id);
  }, [snapshot, error, request]);
  useEffect(() => {
    if (!snapshot || snapshot.run.phase === "gameOver" || error || busy) return;
    const id = setTimeout(
      finish,
      Math.max(10, snapshot.run.deadline - performance.now() + 40),
    );
    return () => clearTimeout(id);
  }, [snapshot, error, busy, finish]);
  function answer(answer: string | string[]) {
    const s = latest.current;
    if (!s || locked.current) return;
    void request("/api/runs/answer", { id: s.id, version: s.version, answer });
  }
  const r = snapshot?.run;
  return (
    <main>
      <header>
        <span className="brand">
          MIND<span>FKD</span>
          <i />
        </span>
        <div className="hud-score">
          <span className="eyebrow">RANKED</span>
          <strong>{r?.score.toLocaleString() ?? "0"}</strong>
        </div>
      </header>
      {error && (
        <div className="network-error" role="alert">
          {error}
          <button
            className="outline-button"
            onClick={() => {
              if (pending.current)
                void request(pending.current.path, pending.current.data);
            }}
          >
            RETRY
          </button>
          <p>The clock keeps running during a connection interruption.</p>
        </div>
      )}
      {!r ? (
        <div className="social-content">
          <p>
            {error
              ? "Could not start ranked play."
              : "Preparing your ranked run…"}
          </p>
          <button className="outline-button" disabled={busy} onClick={onExit}>
            BACK TO HOME
          </button>
        </div>
      ) : r.phase === "gameOver" ? (
        <div className="results">
          <div className="eyebrow">VERIFIED RUN · SAVED TO YOUR PROFILE</div>
          <div className="result-score">{r.score.toLocaleString()}</div>
          <h1>
            Your brain fried at
            <br />
            <span>LEVEL {r.level}.</span>
          </h1>
          <div className="run-stats">
            <div>
              <strong>
                {r.correct}/{r.correct + r.incorrect}
              </strong>
              <span>CORRECT</span>
            </div>
            <div>
              <strong>{r.bestCombo}</strong>
              <span>BEST COMBO</span>
            </div>
          </div>
          <button
            className="primary start"
            disabled={busy}
            onClick={() => void request("/api/runs/start", {})}
          >
            RUN AGAIN ↗
          </button>
          <button
            className="share"
            onClick={async () => {
              try {
                setMessage(
                  await shareRun(
                    r,
                    player?.username ?? undefined,
                    snapshot!.id,
                  ),
                );
              } catch {
                setMessage(
                  shareText(r, player?.username ?? undefined, snapshot!.id),
                );
              }
            }}
          >
            SHARE SCORE + PROFILE
          </button>
          <p className="share-message" role="status">
            {message}
          </p>
          <div className="profile-actions">
            <a href="/leaderboard" className="text-link">
              GLOBAL LEADERBOARD ↗
            </a>
            <button className="text-button" onClick={onExit}>
              HOME
            </button>
          </div>
        </div>
      ) : (
        <div className="play">
          <div className="level-row">
            <span className="eyebrow">
              LEVEL <strong>{String(r.level).padStart(2, "0")}</strong>
            </span>
            <span className="eyebrow">GLOBAL RANKED RUN</span>
          </div>
          <Timer
            deadline={r.deadline}
            onExpire={finish}
            delta={r.feedback ? (r.feedback.correct ? 4 : -6) : null}
          />
          <div className="combo lit">
            {r.combo} STREAK <strong>×{multiplier(r.combo).toFixed(1)}</strong>
          </div>
          {r.question && (
            <Question
              key={r.question.id}
              question={r.question}
              feedback={r.feedback}
              onAnswer={answer}
              disabled={busy || !!error}
            />
          )}
          <div className="play-bottom eyebrow">
            {busy
              ? "CHECKING ANSWER…"
              : "VERIFIED ON THE SERVER · +4 CORRECT / −6 WRONG"}
          </div>
        </div>
      )}
    </main>
  );
}

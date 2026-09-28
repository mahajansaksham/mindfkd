"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "./Account";
import { api } from "../lib/api";
import { GENRES, genreLabel, type Genre } from "../lib/genres";
import { MATCH_RULES, type MatchView } from "../lib/matches";
import Question from "./Question";

function Clock({ deadline, label }: { deadline: number; label: string }) {
  const [left, setLeft] = useState(() =>
    Math.max(0, deadline - performance.now()),
  );
  useEffect(() => {
    let frame: number;
    const tick = () => {
      setLeft(Math.max(0, deadline - performance.now()));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [deadline]);
  return (
    <div className="match-clock">
      <strong aria-hidden="true">{(left / 1000).toFixed(1)}</strong>
      <span>{label}</span>
      <span className="sr-only">
        {Math.ceil(left / 1000)} seconds remaining
      </span>
    </div>
  );
}
export default function Competition() {
  const account = useAccount();
  const [room, setRoom] = useState<MatchView | null>(null),
    [code, setCode] = useState(""),
    [genre, setGenre] = useState<Genre>("mixed"),
    [mode, setMode] = useState<"duel" | "teams">("duel");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [connection, setConnection] = useState("Connecting…"),
    [pending, setPending] = useState<string | string[] | null>(null),
    [deadline, setDeadline] = useState(0);
  const latest = useRef<MatchView | null>(null),
    lock = useRef(false),
    oneWay = useRef(0),
    pendingRequest = useRef<{
      action: string;
      data: Record<string, unknown>;
    } | null>(null);
  const accept = useCallback((value: MatchView) => {
    // A slow earlier response must not roll the room back after a newer live event.
    if (
      latest.current &&
      latest.current.code === value.code &&
      value.serverNow < latest.current.serverNow
    )
      return;
    if (
      latest.current?.clock.round !== value.clock.round ||
      value.answered ||
      value.clock.phase !== "question"
    )
      setPending(null);
    latest.current = value;
    setRoom(value);
    setCode(value.code);
    setDeadline(
      performance.now() +
        Math.max(0, value.clock.deadline - value.serverNow - oneWay.current),
    );
  }, []);
  useEffect(() => {
    const value = new URLSearchParams(location.search).get("room");
    const id = requestAnimationFrame(() => {
      if (value && /^[a-fA-F0-9]{12}$/.test(value))
        setCode(value.toUpperCase());
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const request = useCallback(
    async (action: string, data: Record<string, unknown> = {}) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      pendingRequest.current = { action, data };
      try {
        const sent = performance.now();
        const result = await api<MatchView | { left: true }>(
          `/api/matches/${action}`,
          data,
        );
        oneWay.current = Math.min(1000, (performance.now() - sent) / 2);
        if ("left" in result) {
          latest.current = null;
          setRoom(null);
          setCode("");
          history.replaceState(null, "", "/compete");
        } else {
          accept(result);
          history.replaceState(null, "", `/compete?room=${result.code}`);
        }
        pendingRequest.current = null;
      } catch (e) {
        setError((e as Error).message);
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [accept],
  );
  useEffect(() => {
    if (
      !room?.code ||
      !account.player ||
      ["finished", "cancelled"].includes(room.status)
    )
      return;
    const events = new EventSource(`/api/matches/stream?code=${room.code}`);
    let fallback: ReturnType<typeof setTimeout> | undefined,
      stopped = false,
      polling = false,
      recovering = false;
    // Recover if an intermediary buffers/drops SSE. Visible status avoids claiming
    // a live connection while we are using the slower recovery transport.
    const poll = async () => {
      if (stopped || polling || !recovering) return;
      polling = true;
      try {
        const sent = performance.now();
        const value = await api<MatchView>(
          `/api/matches/room?code=${room.code}`,
        );
        oneWay.current = Math.min(1000, (performance.now() - sent) / 2);
        if (!stopped) accept(value);
      } catch {
      } finally {
        polling = false;
        if (!stopped && recovering)
          fallback = setTimeout(() => void poll(), 1000);
      }
    };
    let watchdog: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (!stopped) {
          recovering = true;
          setConnection("Reconnecting · live refresh");
          void poll();
        }
      }, 6000);
    };
    events.addEventListener("state", (event) => {
      try {
        const v = JSON.parse((event as MessageEvent).data) as MatchView;
        accept(v);
        recovering = false;
        setConnection("Live");
        if (fallback) clearTimeout(fallback);
        arm();
      } catch {}
    });
    events.addEventListener("ping", () => {
      recovering = false;
      setConnection("Live");
      if (fallback) clearTimeout(fallback);
      arm();
    });
    events.onopen = () => {
      setConnection("Live");
      arm();
    };
    events.onerror = () => {
      if (!stopped) {
        setConnection("Reconnecting…");
        arm();
      }
    };
    arm();
    return () => {
      stopped = true;
      events.close();
      clearTimeout(watchdog);
      if (fallback) clearTimeout(fallback);
    };
  }, [room?.code, room?.status, account.player, accept]);
  useEffect(() => {
    if (!account.player?.username) return;
    const invite = new URLSearchParams(location.search).get("room");
    if (!invite || !/^[a-fA-F0-9]{12}$/.test(invite)) return;
    let cancelled = false;
    void api<MatchView>(`/api/matches/room?code=${invite}`)
      .then((v) => {
        if (!cancelled) accept(v);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [account.player?.username, accept]);
  const me = room?.members.find((m) => m.isMe);
  async function share() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(
        `https://mindfkd.com/compete?room=${room.code}`,
      );
      setMessage("Invite link copied");
    } catch {
      setMessage(`https://mindfkd.com/compete?room=${room.code}`);
    }
  }
  function answer(value: string | string[]) {
    if (!room || room.answered || pending !== null || lock.current) return;
    setPending(value);
    void request("answer", {
      code: room.code,
      round: room.clock.round,
      answer: value,
    });
  }
  const phase = room?.clock.phase;
  return (
    <main className="competition-page">
      <header>
        <Link className="brand" href="/">
          MIND<span>FKD</span>
          <i />
        </Link>
        <Link className="text-link" href="/leaderboard">
          LEADERBOARD ↗
        </Link>
      </header>
      <div className="social-content">
        <div className="eyebrow">SAME QUESTIONS. SAME CLOCK.</div>
        <h1>Brains collide.</h1>
        {!account.player?.username ? (
          <div className="empty-state">
            <p>Sign in and create your profile to host or join a live match.</p>
            <button className="primary submit" onClick={account.openAccount}>
              SIGN IN TO COMPETE ↗
            </button>
          </div>
        ) : !room ? (
          <>
            <p className="muted">
              10 shared questions. 10 seconds each. Your own answer locks in
              with one tap. A correct answer earns fixed points, so connection
              speed never changes the points awarded.
            </p>
            <div className="match-create">
              <label>
                Match type
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "duel" | "teams")}
                >
                  <option value="duel">1 vs 1</option>
                  <option value="teams">
                    Team vs team · Uneven teams allowed
                  </option>
                </select>
              </label>
              <label>
                Category
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value as Genre)}
                >
                  {GENRES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary submit"
                disabled={busy}
                onClick={() => void request("create", { mode, genre })}
              >
                {busy ? "CREATING…" : "CREATE ROOM ↗"}
              </button>
            </div>
            <div className="join-room">
              <h2>Got an invite?</h2>
              <label>
                Room code
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-F0-9]/g, "")
                        .slice(0, 12),
                    )
                  }
                  placeholder="12-character code"
                  autoComplete="off"
                />
              </label>
              <div className="profile-actions">
                <button
                  className="outline-button"
                  disabled={busy || code.length !== 12}
                  onClick={() => void request("join", { code, team: 1 })}
                >
                  JOIN TEAM 1
                </button>
                <button
                  className="outline-button"
                  disabled={busy || code.length !== 12}
                  onClick={() => void request("join", { code, team: 2 })}
                >
                  JOIN TEAM 2
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="match-meta">
              <span>
                {genreLabel(room.genre)} ·{" "}
                {room.mode === "duel" ? "1v1" : "Team vs team"}
              </span>
              <span className="eyebrow" role="status">
                {room.status === "finished" ? "FINAL" : connection}
              </span>
            </div>
            {room.status === "waiting" ? (
              <>
                <p>
                  Room <strong className="room-code">{room.code}</strong>
                </p>
                <button className="outline-button" onClick={() => void share()}>
                  COPY INVITE LINK
                </button>
                <p className="muted">
                  Join either side, then mark yourself ready.{" "}
                  {room.mode === "teams"
                    ? `Uneven teams are allowed. Team points are added together; larger teams have an advantage. Up to ${MATCH_RULES.maxTeamSize} players per side.`
                    : "One player per side."}
                </p>
                <div className="profile-actions">
                  <button
                    className="outline-button"
                    disabled={busy}
                    onClick={() => void request("join", { code, team: 1 })}
                  >
                    JOIN TEAM 1
                  </button>
                  <button
                    className="outline-button"
                    disabled={busy}
                    onClick={() => void request("join", { code, team: 2 })}
                  >
                    JOIN TEAM 2
                  </button>
                  {me && (
                    <button
                      className="primary submit"
                      disabled={busy}
                      onClick={() =>
                        void request("ready", { code, ready: !me.ready })
                      }
                    >
                      {me.ready ? "NOT READY" : "I’M READY"}
                    </button>
                  )}
                </div>
                {room.isHost && (
                  <button
                    className="primary submit"
                    disabled={
                      busy ||
                      room.members.some((m) => !m.ready) ||
                      room.teams.some((t) => !t.players)
                    }
                    onClick={() => void request("start", { code })}
                  >
                    START MATCH ↗
                  </button>
                )}
              </>
            ) : room.status === "cancelled" ? (
              <p className="network-error">
                This room was cancelled or expired.
              </p>
            ) : room.status === "finished" ? (
              <div className="match-result">
                <div className="eyebrow">MATCH COMPLETE</div>
                <h2>
                  {room.winnerTeam === 0
                    ? "A battle of equals."
                    : `TEAM ${room.winnerTeam} WINS`}
                </h2>
                <p>
                  {room.mode === "duel"
                    ? "Your 1v1 record is saved on your profile."
                    : "Your team result is saved on your profile."}
                </p>
                <Link
                  className="text-link"
                  href={`/profile?u=${encodeURIComponent(account.player.username)}`}
                >
                  YOUR PROFILE ↗
                </Link>
              </div>
            ) : (
              <>
                <div className="level-row">
                  <span>
                    QUESTION{" "}
                    {Math.min(room.clock.round + 1, MATCH_RULES.rounds)} /{" "}
                    {MATCH_RULES.rounds}
                  </span>
                  <span>
                    {phase === "countdown"
                      ? "GET READY"
                      : phase === "reveal"
                        ? "ANSWER REVEAL"
                        : "LOCK YOUR ANSWER"}
                  </span>
                </div>
                <Clock
                  deadline={deadline}
                  label={
                    phase === "countdown"
                      ? "STARTS IN"
                      : phase === "reveal"
                        ? "NEXT ROUND IN"
                        : "SECONDS LEFT"
                  }
                />
                {room.question && (
                  <Question
                    key={`${room.code}:${room.clock.round}`}
                    question={room.question}
                    feedback={
                      phase === "reveal" && room.correct !== null
                        ? {
                            correct: room.correct,
                            points: room.points,
                            selected: room.selected ?? "",
                          }
                        : null
                    }
                    disabled={
                      busy ||
                      room.answered ||
                      pending !== null ||
                      phase !== "question"
                    }
                    pendingLabel={
                      room.answered
                        ? "Answer locked. Waiting for reveal…"
                        : "Sending answer…"
                    }
                    pendingAnswer={
                      pending ?? (room.answered ? room.selected : null)
                    }
                    onAnswer={answer}
                  />
                )}
                {phase === "question" && room.answered && (
                  <p className="muted" role="status">
                    Answer locked. Everyone’s result is revealed together.
                  </p>
                )}
                {phase === "reveal" &&
                  room.correct === null &&
                  room.question && (
                    <p className="muted">
                      No answer submitted. Correct:{" "}
                      {Array.isArray(room.question.answer)
                        ? room.question.answer.join(" → ")
                        : room.question.answer}
                    </p>
                  )}
              </>
            )}
            <div className="team-boards">
              {room.teams.map((team) => (
                <section key={team.team} className="team-board">
                  <div className="team-heading">
                    <h2>TEAM {team.team}</h2>
                    <strong>
                      {team.total.toLocaleString()} <small>PTS</small>
                    </strong>
                  </div>
                  {room.members
                    .filter((m) => m.team === team.team)
                    .map((m) => (
                      <div key={m.username} className="team-player">
                        <Link
                          href={`/profile?u=${encodeURIComponent(m.username)}`}
                        >
                          {m.displayName}
                          {m.isMe ? " (you)" : ""}
                        </Link>
                        <strong>{m.score.toLocaleString()}</strong>
                        <small>
                          {room.status === "waiting"
                            ? m.ready
                              ? "READY"
                              : "NOT READY"
                            : `${m.correct} right · ${m.wrong} wrong · ${m.unanswered} unanswered`}
                        </small>
                        {room.status === "active" && phase === "question" && (
                          <small>
                            {m.answered ? "ANSWER LOCKED" : "THINKING…"}
                          </small>
                        )}
                      </div>
                    ))}
                  {!team.players && (
                    <p className="muted">Waiting for players…</p>
                  )}
                </section>
              ))}
            </div>
            {room.status === "waiting" ? (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void request("leave", { code })}
              >
                {room.isHost ? "CANCEL ROOM" : "LEAVE ROOM"}
              </button>
            ) : ["finished", "cancelled"].includes(room.status) ? (
              <button
                className="primary submit"
                onClick={() => {
                  latest.current = null;
                  setRoom(null);
                  setCode("");
                  setError("");
                  setMessage("");
                  history.replaceState(null, "", "/compete");
                }}
              >
                NEW MATCH ↗
              </button>
            ) : (
              <p className="muted">
                Teams are locked. Rejoin with this room code if disconnected;
                unanswered rounds score zero. Correct/wrong counts update after
                each reveal.
              </p>
            )}
          </>
        )}
        {error && (
          <div className="network-error" role="alert">
            {error}
            <button
              className="outline-button"
              disabled={busy}
              onClick={() => {
                const p = pendingRequest.current;
                if (p) void request(p.action, p.data);
              }}
            >
              RETRY
            </button>
          </div>
        )}
        {message && (
          <p className="share-message" role="status">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}

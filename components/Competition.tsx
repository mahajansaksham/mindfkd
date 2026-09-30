"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "./Account";
import { api } from "../lib/api";
import { GENRES, genreLabel, type Genre } from "../lib/genres";
import { MATCH_RULES, type MatchView } from "../lib/matches";
import { connectMatch } from "../lib/match-connection";
import Question from "./Question";

function Clock({
  deadline,
  label,
  onClose,
}: {
  deadline: number;
  label: string;
  onClose: () => void;
}) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    let frame: number,
      notified = false;
    const tick = () => {
      const value = Math.max(0, deadline - performance.now());
      setLeft(value);
      if (value === 0 && !notified) {
        notified = true;
        onClose();
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [deadline, onClose]);
  return (
    <div className={`match-clock ${left < 3000 ? "urgent" : ""}`}>
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
    [deadline, setDeadline] = useState(0),
    [windowClosed, setWindowClosed] = useState(false),
    [teamName, setTeamName] = useState("");
  const latest = useRef<MatchView | null>(null),
    lock = useRef(false),
    oneWay = useRef(0),
    pendingRequest = useRef<{
      action: string;
      data: Record<string, unknown>;
    } | null>(null),
    transport = useRef<ReturnType<typeof connectMatch> | null>(null);
  const accept = useCallback((value: MatchView) => {
    const previous = latest.current;
    if (
      previous?.code === value.code &&
      (value.revision < previous.revision ||
        (value.revision === previous.revision &&
          value.serverNow < previous.serverNow))
    )
      return;
    if (
      previous?.clock.round !== value.clock.round ||
      value.answered ||
      value.clock.phase !== "question"
    )
      setPending(null);
    latest.current = value;
    setRoom(value);
    setCode(value.code);
    const remaining = Math.max(
      0,
      value.clock.deadline - value.serverNow - oneWay.current,
    );
    setDeadline(performance.now() + remaining);
    setWindowClosed(remaining === 0);
  }, []);
  const latency = useCallback((ms: number) => {
    oneWay.current = Math.min(1000, ms);
  }, []);
  const closeWindow = useCallback(() => setWindowClosed(true), []);
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
  const request = useCallback(
    async (action: string, data: Record<string, unknown> = {}) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      pendingRequest.current = { action, data };
      try {
        const sent = performance.now();
        const result =
          action !== "create" && transport.current
            ? await transport.current.request(action, data)
            : await api<MatchView | { left: true }>(
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
  const roomCode = room?.code,
    finished = room?.status === "finished" || room?.status === "cancelled";
  useEffect(() => {
    if (!roomCode || !account.player || finished) return;
    const current = connectMatch(roomCode, accept, setConnection, latency);
    transport.current = current;
    return () => {
      transport.current = null;
      current.close();
    };
  }, [roomCode, finished, account.player, accept, latency]);
  const me = room?.members.find((m) => m.isMe),
    phase = room?.clock.phase,
    playing = room?.status === "active";
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
    if (
      !room ||
      room.answered ||
      pending !== null ||
      lock.current ||
      performance.now() >= deadline
    )
      return;
    setPending(value);
    void request("answer", {
      code: room.code,
      round: room.clock.round,
      answer: value,
    });
  }
  const reset = () => {
    latest.current = null;
    setRoom(null);
    setCode("");
    setError("");
    setMessage("");
    history.replaceState(null, "", "/compete");
  };
  return (
    <main className={`competition-page ${playing ? "match-playing" : ""}`}>
      <header>
        <Link className="brand" href="/">
          MIND<span>FKD</span>
          <i />
        </Link>
        <div className="match-header-right">
          <Link href="/leaderboard">Leaderboard</Link>
          <span className="connection" role="status">
            {room ? (finished ? "Final" : connection) : "Live matches"}
          </span>
        </div>
      </header>
      <div className="arena">
        {!account.player?.username ? (
          <div className="match-setup">
            <h1>Play together.</h1>
            <p>Sign in to host or join a match.</p>
            <button className="primary submit" onClick={account.openAccount}>
              SIGN IN TO COMPETE
            </button>
          </div>
        ) : !room ? (
          <div className="match-setup">
            <div>
              <div className="eyebrow">LIVE COMPETITIONS</div>
              <h1>Brains collide.</h1>
              <p className="muted">10 questions. Same clock. Best team wins.</p>
            </div>
            <div className="match-setup-grid">
              <section>
                <h2>Host a match</h2>
                <label>
                  Match type
                  <select
                    value={mode}
                    onChange={(e) =>
                      setMode(e.target.value as "duel" | "teams")
                    }
                  >
                    <option value="duel">1 vs 1</option>
                    <option value="teams">Team vs team</option>
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
                  {busy ? "CREATING…" : "CREATE ROOM"}
                </button>
              </section>
              <section>
                <h2>Join your friends</h2>
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
                <div className="join-actions">
                  <button
                    className="outline-button"
                    disabled={busy || code.length !== 12}
                    onClick={() => void request("join", { code, team: 1 })}
                  >
                    JOIN SIDE 1
                  </button>
                  <button
                    className="outline-button"
                    disabled={busy || code.length !== 12}
                    onClick={() => void request("join", { code, team: 2 })}
                  >
                    JOIN SIDE 2
                  </button>
                </div>
              </section>
            </div>
          </div>
        ) : (
          <>
            <div className="arena-meta">
              <span>
                {genreLabel(room.genre)} ·{" "}
                {room.mode === "duel" ? "1v1" : "Team match"}
              </span>
              {playing ? (
                <span>
                  QUESTION {Math.min(room.clock.round + 1, MATCH_RULES.rounds)}{" "}
                  / {MATCH_RULES.rounds}
                </span>
              ) : room.status === "waiting" ? (
                <button className="text-button" onClick={() => void share()}>
                  INVITE · {room.code}
                </button>
              ) : (
                <span>Match complete</span>
              )}
            </div>
            <div className="arena-scores">
              {room.teams.map((team) => (
                <div
                  key={team.team}
                  className={`arena-score ${me?.team === team.team ? "your-side" : ""}`}
                >
                  <span>
                    {room.mode === "duel"
                      ? (room.members.find((m) => m.team === team.team)
                          ?.displayName ?? "Waiting for opponent")
                      : team.name}
                  </span>
                  <strong>
                    {team.total.toLocaleString()}
                    <small>PTS</small>
                  </strong>
                  {room.mode === "teams" && (
                    <small>{team.players} players</small>
                  )}
                </div>
              ))}
            </div>
            {room.status === "waiting" ? (
              <div className="lobby-controls">
                <div className="lobby-actions">
                  {room.teams.map((t) => (
                    <button
                      key={t.team}
                      className="outline-button"
                      disabled={
                        busy ||
                        me?.team === t.team ||
                        (room.mode === "duel" && t.players > 0)
                      }
                      onClick={() =>
                        void request("join", { code, team: t.team })
                      }
                    >
                      {me?.team === t.team ? "JOINED" : "JOIN"}{" "}
                      {room.mode === "teams" ? t.name : `SIDE ${t.team}`}
                    </button>
                  ))}
                  {me && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void request("ready", { code, ready: !me.ready })
                      }
                    >
                      {me.ready ? "READY ✓" : "I’M READY"}
                    </button>
                  )}
                  {room.isHost && (
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        room.members.some((m) => !m.ready) ||
                        room.teams.some((t) => !t.players)
                      }
                      onClick={() => void request("start", { code })}
                    >
                      START MATCH
                    </button>
                  )}
                </div>
                {me && room.mode === "teams" && (
                  <form
                    className="team-name-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void request("name", { code, name: teamName });
                    }}
                  >
                    <label htmlFor="team-name">Your team name</label>
                    <input
                      id="team-name"
                      key={me.team}
                      placeholder={
                        room.teams.find((t) => t.team === me.team)?.name
                      }
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      maxLength={24}
                    />
                    <button
                      className="outline-button"
                      disabled={busy || !teamName.trim()}
                    >
                      SAVE NAME
                    </button>
                  </form>
                )}
                <p className="muted lobby-note">
                  Everyone must be ready.{" "}
                  {room.mode === "teams"
                    ? "Uneven teams allowed; points are added together. Larger teams have an advantage."
                    : "One player per side."}
                </p>
              </div>
            ) : room.status === "cancelled" ? (
              <p className="network-error">
                This room was cancelled or expired.
              </p>
            ) : room.status === "finished" ? (
              <div className="match-result">
                <h1>
                  {room.winnerTeam === 0
                    ? "IT’S A DRAW"
                    : `${room.mode === "duel" ? (room.members.find((m) => m.team === room.winnerTeam)?.displayName ?? "Winner") : room.teams.find((t) => t.team === room.winnerTeam)?.name} WINS`}
                </h1>
                <Link
                  href={`/profile?u=${encodeURIComponent(account.player.username)}`}
                >
                  View your updated record
                </Link>
              </div>
            ) : (
              <div className="match-question-area">
                <div className="match-round-bar">
                  <span>
                    {phase === "countdown"
                      ? "GET READY"
                      : phase === "reveal"
                        ? "ANSWER REVEAL"
                        : room.answered
                          ? "ANSWER LOCKED"
                          : "CHOOSE YOUR ANSWER"}
                  </span>
                  <Clock
                    deadline={deadline}
                    onClose={closeWindow}
                    label={
                      phase === "countdown"
                        ? "STARTS IN"
                        : phase === "reveal"
                          ? "NEXT IN"
                          : "SECONDS"
                    }
                  />
                </div>
                {room.question ? (
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
                      windowClosed ||
                      busy ||
                      room.answered ||
                      pending !== null ||
                      phase !== "question"
                    }
                    pendingLabel={
                      room.answered
                        ? "Locked. Results at the reveal."
                        : "Sending…"
                    }
                    pendingAnswer={
                      pending ?? (room.answered ? room.selected : null)
                    }
                    onAnswer={answer}
                  />
                ) : (
                  <div className="match-countdown">
                    <h1>Ready?</h1>
                    <p>The same question arrives for everyone.</p>
                  </div>
                )}
                {phase === "reveal" &&
                  room.correct === null &&
                  room.question && (
                    <p className="unanswered-result">
                      No answer · Correct:{" "}
                      {Array.isArray(room.question.answer)
                        ? room.question.answer.join(" → ")
                        : room.question.answer}
                    </p>
                  )}
              </div>
            )}
            <div
              className={`match-rosters ${playing && room.mode === "duel" ? "duel-rosters" : ""}`}
            >
              {room.teams.map((team) => (
                <details
                  key={team.team}
                  open={room.mode === "duel" || !playing}
                >
                  <summary>
                    {team.name} · {team.players} players
                  </summary>
                  <div className="roster-list">
                    {room.members
                      .filter((m) => m.team === team.team)
                      .map((m) => (
                        <div key={m.username} className="roster-player">
                          <Link
                            href={`/profile?u=${encodeURIComponent(m.username)}`}
                          >
                            {m.displayName}
                            {m.isMe ? " (you)" : ""}
                          </Link>
                          <span>
                            {room.status === "waiting"
                              ? m.ready
                                ? "Ready"
                                : "Not ready"
                              : `${m.correct} right · ${m.wrong} wrong · ${m.unanswered} missed`}
                          </span>
                          {playing && phase === "question" && (
                            <small>{m.answered ? "Locked" : "Thinking…"}</small>
                          )}
                        </div>
                      ))}
                  </div>
                </details>
              ))}
            </div>
            {!playing && (
              <div className="arena-bottom">
                {room.status === "waiting" ? (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void request("leave", { code })}
                  >
                    {room.isHost ? "CANCEL ROOM" : "LEAVE ROOM"}
                  </button>
                ) : (
                  <button className="primary" onClick={reset}>
                    NEW MATCH
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {error && (
          <div className="network-error" role="alert">
            {error}
            {error && (
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
            )}
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

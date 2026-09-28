"use client";
import { trackChallengeOpened } from "../lib/analytics";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CURRENT_SEASON, SEASONS } from "../lib/catalog";
import { api, Player, profileUrl } from "../lib/api";
import { useAccount } from "./Account";
type Row = {
  username: string;
  display_name: string;
  score: number;
  level: number;
  run_id: string;
  rank: number;
};
type Result = {
  id: string;
  score: number;
  level: number;
  correct: number;
  incorrect: number;
  bestCombo: number;
  finishedAt: number;
};
type Profile = {
  player: Player;
  stats: {
    games: number;
    bestScore: number;
    bestLevel: number;
    bestCombo: number;
    correct: number;
    incorrect: number;
  };
  recent: Result[];
  following: { username: string; display_name: string }[];
  counts: { followers: number; following: number };
  isFollowing: boolean;
  isMe: boolean;
  sharedRun: Result | null;
};
function Shell({ children }: { children: React.ReactNode }) {
  const account = useAccount();
  return (
    <main>
      <header>
        <Link className="brand" href="/">
          MIND<span>FKD</span>
          <i />
        </Link>
        <div className="social-nav">
          <Link href="/leaderboard">LEADERBOARD</Link>
          <button className="text-button" onClick={account.openAccount}>
            {account.player?.username
              ? "@" + account.player.username
              : "SIGN IN"}
          </button>
        </div>
      </header>
      <div className="social-content">{children}</div>
    </main>
  );
}
export function Leaderboard() {
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [data, setData] = useState<{ players: Row[]; me: Row | null } | null>(
      null,
    ),
    [error, setError] = useState("");
  const { player } = useAccount();
  useEffect(() => {
    let active = true;
    api<{ players: Row[]; me: Row | null }>(
      `/api/leaderboard?season=${encodeURIComponent(season)}`,
    )
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [player, season]);
  return (
    <Shell>
      <div className="eyebrow">THE GLOBAL LEADERBOARD</div>
      <h1>Brains to beat.</h1>
      <p className="muted">Each player’s best verified run in this season.</p>
      <label className="season-picker">
        Leaderboard
        <select
          value={season}
          onChange={(e) => {
            setData(null);
            setError("");
            setSeason(e.target.value);
          }}
        >
          {SEASONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button className="text-button" onClick={() => location.reload()}>
            RETRY
          </button>
        </p>
      ) : !data ? (
        <p>Loading scores…</p>
      ) : (
        <>
          {data.me && (
            <div className="your-rank">
              YOUR POSITION <strong>#{data.me.rank}</strong>
              <span>{data.me.score.toLocaleString()} PTS</span>
            </div>
          )}
          {data.players.length ? (
            <div className="leaderboard">
              {data.players.map((row) => (
                <Link
                  className="leaderboard-row"
                  href={profileUrl(row.username)}
                  key={row.username}
                >
                  <span className="rank">
                    {String(row.rank).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{row.display_name}</strong>
                    <small>@{row.username}</small>
                  </span>
                  <span className="board-score">
                    <strong>{row.score.toLocaleString()}</strong>
                    <small>LEVEL {row.level}</small>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No ranked runs yet. Set the first score.
            </div>
          )}
        </>
      )}
      <Link href="/" className="primary submit">
        START A RUN ↗
      </Link>
    </Shell>
  );
}
export function PublicProfile() {
  const [data, setData] = useState<Profile | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [shareMessage, setShareMessage] = useState("");
  const account = useAccount();
  const load = useCallback(async () => {
    const params = new URLSearchParams(location.search);
    const name = params.get("u") ?? account.player?.username;
    if (!name) {
      setError("Choose a player from the leaderboard to view their profile.");
      return;
    }
    try {
      const profile = await api<Profile>(
        `/api/player?u=${encodeURIComponent(name)}&run=${encodeURIComponent(params.get("run") ?? "")}`,
      );
      setData(profile);
      if (profile.sharedRun)
        trackChallengeOpened({
          challenge_id: profile.sharedRun.id,
          page: "/profile",
        });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [account.player?.username]);
  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);
  async function follow() {
    if (!account.player?.username) {
      account.openAccount();
      return;
    }
    if (!data) return;
    setBusy(true);
    try {
      await api("/api/follow", {
        username: data.player.username,
        follow: !data.isFollowing,
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!data?.player.username) return;
    const url = profileUrl(data.player.username);
    try {
      if (navigator.share)
        await navigator.share({
          title: `${data.player.displayName} on MINDFKD`,
          text: "Can you beat my best? Play MINDFKD.",
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        setShareMessage("Profile link copied");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setShareMessage(url);
    }
  }
  return (
    <Shell>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        !error && <p>Loading player…</p>
      ) : (
        <>
          <div className="eyebrow">PLAYER PROFILE</div>
          <h1>{data.player.displayName}</h1>
          <p className="handle">@{data.player.username}</p>
          {data.player.bio && <p className="bio">{data.player.bio}</p>}
          <div className="profile-actions">
            {data.isMe ? (
              <button className="outline-button" onClick={account.openAccount}>
                EDIT PROFILE
              </button>
            ) : (
              <button
                className="outline-button"
                disabled={busy}
                onClick={follow}
              >
                {data.isFollowing ? "FOLLOWING · UNFOLLOW" : "FOLLOW PLAYER"}
              </button>
            )}
            <button className="outline-button" onClick={share}>
              SHARE PROFILE ↗
            </button>
          </div>
          <p role="status" className="muted">
            {shareMessage}
          </p>
          <p className="muted">
            {data.counts.followers} followers · {data.counts.following}{" "}
            following
          </p>
          {data.sharedRun && (
            <div className="shared-run">
              <div className="eyebrow">SHARED VERIFIED RUN</div>
              <strong>{data.sharedRun.score.toLocaleString()}</strong>
              <p>
                Level {data.sharedRun.level} · {data.sharedRun.correct}/
                {data.sharedRun.correct + data.sharedRun.incorrect} correct ·{" "}
                {data.sharedRun.bestCombo} best combo
              </p>
              <Link href="/" className="text-link">
                Think you can beat it? Play now ↗
              </Link>
            </div>
          )}
          <div className="profile-stats">
            {[
              ["BEST SCORE", data.stats.bestScore.toLocaleString()],
              ["BEST LEVEL", data.stats.bestLevel],
              ["RANKED RUNS", data.stats.games],
              ["BEST COMBO", data.stats.bestCombo],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <h2 className="section-title">Recent runs</h2>
          {data.recent.length ? (
            <div className="leaderboard">
              {data.recent.map((r) => (
                <Link
                  key={r.id}
                  className="leaderboard-row"
                  href={profileUrl(data.player.username!, r.id)}
                >
                  <span>
                    <strong>{r.score.toLocaleString()} pts</strong>
                    <small>{new Date(r.finishedAt).toLocaleDateString()}</small>
                  </span>
                  <span className="board-score">LEVEL {r.level}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">No ranked runs yet.</p>
          )}
          <h2 className="section-title">Following</h2>
          {data.following.length ? (
            <div className="following-list">
              {data.following.map((p) => (
                <Link key={p.username} href={profileUrl(p.username)}>
                  {p.display_name} <small>@{p.username}</small>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">No players followed yet.</p>
          )}
        </>
      )}
    </Shell>
  );
}

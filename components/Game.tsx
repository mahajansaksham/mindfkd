"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  HelpCircle,
  Zap,
  Flame,
  ArrowRight,
  Share2,
} from "lucide-react";
import { questions } from "../data/questions";
import {
  Run,
  QuestionHistory,
  emptyRun,
  startRun,
  answerRun,
  nextQuestion,
  multiplier,
  config,
  seededRandom,
} from "../lib/game";
import {
  Stats,
  blankStats,
  readStats,
  saveStats,
  accumulate,
  readQuestionHistory,
  rememberQuestion,
} from "../lib/storage";
import { shareRun, shareText } from "../lib/share";
import Question from "./Question";
import Timer from "./Timer";
import Modal from "./Modal";
import { useAccount } from "./Account";
import { createRunTracker } from "../lib/analytics/run";
import { trackEvent } from "../lib/analytics";
import RankedGame from "./RankedGame";
const labels = [
  "",
  "WARM UP",
  "FIND YOUR FLOW",
  "GETTING WARM",
  "BRAIN HEATING UP",
  "DANGER ZONE",
  "NO EASY ANSWERS",
  "MINDFKD",
];
export default function Game() {
  const account = useAccount();
  const [ranked, setRanked] = useState(false);
  const [run, setRun] = useState<Run>(emptyRun),
    [stats, setStats] = useState<Stats>(blankStats),
    [modal, setModal] = useState<"help" | "stats" | null>(null),
    [message, setMessage] = useState(""),
    [fallback, setFallback] = useState(false),
    [previousBest, setPreviousBest] = useState(0);
  const telemetry = useRef<ReturnType<typeof createRunTracker> | null>(null);
  const history = useRef<QuestionHistory>({});
  const current = useRef(run),
    rng = useRef<() => number>(Math.random),
    saved = useRef(false);
  const update = useCallback((next: Run) => {
    if (next.question && next.question.id !== current.current.question?.id)
      history.current = rememberQuestion(next.question, history.current);
    current.current = next;
    setRun(next);
    telemetry.current?.observe(next);
  }, []);
  useEffect(() => {
    const id = requestAnimationFrame(() => setStats(readStats()));
    return () => cancelAnimationFrame(id);
  }, []);
  const finish = useCallback(() => {
    const r = current.current;
    if (r.phase === "playing" || r.phase === "feedback")
      update({ ...r, phase: "gameOver", reason: "time" });
  }, [update]);
  const answer = useCallback(
    (a: string | string[]) =>
      update(answerRun(current.current, a, performance.now())),
    [update],
  );
  useEffect(() => {
    if (run.phase !== "feedback") return;
    const id = setTimeout(
      () =>
        update(
          nextQuestion(
            current.current,
            questions,
            rng.current,
            performance.now(),
            history.current,
          ),
        ),
      run.feedback?.correct ? config.correctFeedbackMs : config.wrongFeedbackMs,
    );
    return () => clearTimeout(id);
  }, [run.phase, run.feedback, update]);
  useEffect(() => {
    function visible() {
      if (
        document.visibilityState === "visible" &&
        ["playing", "feedback"].includes(current.current.phase) &&
        performance.now() >= current.current.deadline
      )
        finish();
    }
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [finish]);
  useEffect(() => {
    if (run.phase !== "gameOver" || saved.current) return;
    saved.current = true;
    const next = accumulate(readStats(), run);
    const ok = saveStats(next);
    const id = requestAnimationFrame(() => {
      setStats(next);
      if (!ok)
        setMessage("Browser storage unavailable. This run is not saved.");
    });
    return () => cancelAnimationFrame(id);
  }, [run]);
  function start() {
    if (account.player?.username) {
      setRanked(true);
      return;
    }
    saved.current = false;
    setPreviousBest(stats.bestScore);
    setMessage("");
    setFallback(false);
    rng.current = seededRandom(crypto.getRandomValues(new Uint32Array(1))[0]);
    let level = 1;
    if (process.env.NODE_ENV === "development") {
      const n = Number(new URLSearchParams(location.search).get("level"));
      if (n >= 1 && n <= 50) level = n;
    }
    telemetry.current = createRunTracker(
      crypto.randomUUID(),
      "guest",
      readStats(),
    );
    history.current = { ...readQuestionHistory(), ...history.current };
    update(
      startRun(
        questions,
        rng.current,
        performance.now(),
        level,
        history.current,
      ),
    );
  }
  async function share() {
    try {
      setMessage(
        await shareRun(
          run,
          account.player?.username ?? undefined,
          undefined,
          telemetry.current?.id,
        ),
      );
    } catch {
      setFallback(true);
      setMessage("Select and copy your result below.");
    }
  }
  const active = run.phase === "playing" || run.phase === "feedback";
  const tier = run.question?.difficulty ?? 1;
  if (ranked) return <RankedGame onExit={() => setRanked(false)} />;
  return (
    <main className={active ? "is-playing" : ""}>
      <header>
        <button
          className="brand"
          aria-label="MINDFKD home"
          disabled={active}
          onClick={() => update(emptyRun)}
        >
          MIND<span>FKD</span>
          <i />
        </button>
        {active ? (
          <div className="hud-score">
            <span className="eyebrow">SCORE</span>
            <strong key={run.score}>{run.score.toLocaleString()}</strong>
          </div>
        ) : (
          <div className="header-tools">
            <Link
              className="icon"
              aria-label="Global leaderboard"
              href="/leaderboard"
            >
              ↗
            </Link>
            <button
              className="text-button account-button"
              onClick={account.openAccount}
            >
              {account.player?.username
                ? "@" + account.player.username
                : "SIGN IN"}
            </button>
            <button
              className="icon"
              aria-label="How to play"
              onClick={() => {
                setModal("help");
                trackEvent("how_to_play_opened", {});
              }}
            >
              <HelpCircle size={20} />
            </button>
            <button
              className="icon"
              aria-label="Your stats"
              onClick={() => {
                setModal("stats");
                trackEvent("stats_opened", {
                  games_played: stats.gamesPlayed,
                  best_score: stats.bestScore,
                  best_level: stats.bestLevel,
                });
              }}
            >
              <BarChart3 size={20} />
            </button>
          </div>
        )}
      </header>
      {run.phase === "idle" ? (
        <div className="landing">
          <div className="edition eyebrow">
            <span /> THE TRIVIA SURVIVAL GAME
          </div>
          <h1>
            How far can
            <br />
            your brain <em>go?</em>
          </h1>
          <p className="intro">
            {config.startMs / 1000} seconds. Questions get harder.
            <br />
            Don’t run out of time.
          </p>
          <div className="start-clock">
            {config.startMs / 1000}
            <span>.00</span>
            <span className="clock-label eyebrow">
              SECONDS. MAKE THEM COUNT.
            </span>
          </div>
          <button className="primary start" onClick={start}>
            START RUN <ArrowUpRight size={23} />
          </button>
          <Link className="guest-leaderboard" href="/leaderboard">
            <BarChart3 size={18} /> GLOBAL LEADERBOARD{" "}
            <ArrowUpRight size={18} />
          </Link>
          <div className="difficulty-ruler">
            <span>EASY</span>
            <div>
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span>IMPOSSIBLE</span>
          </div>
          <p className="ranked-invite">
            {account.player?.username ? (
              "RANKED RUN · YOUR SCORE GOES GLOBAL"
            ) : (
              <button className="text-button" onClick={account.openAccount}>
                {account.player
                  ? "CREATE YOUR PROFILE TO PLAY RANKED"
                  : "PLAY AS A GUEST · SIGN IN TO RANK"}
              </button>
            )}
          </p>
          <div className="landing-meta">
            <span>
              PERSONAL BEST{" "}
              <strong>
                {stats.bestScore ? stats.bestScore.toLocaleString() : "—"}
              </strong>
            </span>
            <span>
              <Zap size={13} /> ENDLESS V0
            </span>
          </div>
        </div>
      ) : active ? (
        <div className="play">
          <div className="level-row">
            <span className="eyebrow">
              LEVEL <strong>{String(run.level).padStart(2, "0")}</strong>
            </span>
            <span className="eyebrow milestone" key={Math.floor(run.level / 5)}>
              {labels[tier]}
            </span>
          </div>
          <Timer
            deadline={run.deadline}
            onExpire={finish}
            delta={run.feedback ? (run.feedback.correct ? 4 : -6) : null}
          />
          <div className={`combo ${run.combo >= 3 ? "lit" : ""}`}>
            <Flame size={16} />
            <span>{run.combo} STREAK</span>
            <strong key={multiplier(run.combo)}>
              ×{multiplier(run.combo).toFixed(1)}
            </strong>
          </div>
          <Question
            key={run.question!.id}
            question={run.question!}
            feedback={run.feedback}
            onAnswer={answer}
          />
          <div className="play-bottom eyebrow">
            <span>+4 SEC CORRECT</span>
            <span>−6 SEC WRONG</span>
            <span className="desktop-hint">1–4 TO ANSWER</span>
          </div>
        </div>
      ) : (
        <div className="results">
          <div className="eyebrow result-kicker">
            {run.reason === "bank"
              ? "DIFFICULTY TIER CLEARED"
              : "TIME’S UP. TAKE A BREATH."}
          </div>
          <div className="result-score">{run.score.toLocaleString()}</div>
          <div className="eyebrow">POINTS</div>
          {run.score > previousBest && (
            <div className="new-best">
              <Zap size={15} /> NEW BEST{" "}
              <span>+{(run.score - previousBest).toLocaleString()}</span>
            </div>
          )}
          <h1>
            Your brain fried at
            <br />
            <span>LEVEL {run.level}.</span>
          </h1>
          <div className="run-stats">
            <div>
              <strong>
                {run.correct}
                <small> / {run.correct + run.incorrect}</small>
              </strong>
              <span>CORRECT</span>
            </div>
            <div>
              <strong>
                {Math.round(
                  (100 * run.correct) /
                    Math.max(1, run.correct + run.incorrect),
                )}
                %
              </strong>
              <span>ACCURACY</span>
            </div>
            <div>
              <strong>
                <Flame size={20} />
                {run.bestCombo}
              </strong>
              <span>BEST COMBO</span>
            </div>
          </div>
          <button className="primary start" onClick={start}>
            RUN AGAIN <ArrowRight size={22} />
          </button>
          <button className="share" onClick={share}>
            <Share2 size={16} /> SHARE SCORE
          </button>
          <p className="share-message" role="status">
            {message}
          </p>
          {fallback && (
            <textarea
              readOnly
              value={shareText(run, account.player?.username ?? undefined)}
              aria-label="Share result"
              onFocus={(e) => e.target.select()}
            />
          )}
          <div className="personal-stats">
            <span>
              BEST SCORE <b>{stats.bestScore.toLocaleString()}</b>
            </span>
            <span>
              BEST LEVEL <b>{stats.bestLevel}</b>
            </span>
            <span>
              RUNS <b>{stats.gamesPlayed}</b>
            </span>
          </div>
        </div>
      )}
      {!active && (
        <footer>
          <span>A LITTLE KNOWLEDGE. A LOT OF PRESSURE.</span>
          <span>
            PLAY. PANIC. REPEAT. <ArrowUpRight size={12} />
          </span>
        </footer>
      )}
      {modal && (
        <Modal
          title={
            modal === "help"
              ? "A race against your brain."
              : "Your track record."
          }
          onClose={() => setModal(null)}
        >
          {modal === "help" ? (
            <>
              <p>
                Start with {config.startMs / 1000} seconds. Every answer takes
                you up a level. Keep going until the clock hits zero.
              </p>
              <div className="rules">
                <p>
                  <b>+4 seconds</b> for a correct answer
                </p>
                <p>
                  <b>−6 seconds</b> for a wrong answer
                </p>
                <p>
                  <b>Build a streak</b> to multiply your score
                </p>
              </div>
              <p>
                Tap choices or use 1–4. Reorder with drag or arrow buttons.
                Number choices submit with one tap. The clock keeps running
                during feedback and while you’re away.
              </p>
              <p className="muted">
                Score = (150 × difficulty + speed bonus up to 300) × combo.
                Multipliers: 3 correct ×1.2 · 5 ×1.5 · 10 ×2 · 15 ×3.
              </p>
            </>
          ) : (
            <>
              <div className="stats-list">
                {[
                  ["Games", stats.gamesPlayed],
                  ["Best score", stats.bestScore.toLocaleString()],
                  ["Best level", stats.bestLevel],
                  ["Accuracy", `${Math.round(stats.averageAccuracy)}%`],
                  ["Best combo", stats.bestCombo],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <h3 className="eyebrow">RECENT RUNS</h3>
              <p>
                {stats.recentScores.length
                  ? stats.recentScores
                      .map((n) => n.toLocaleString())
                      .join(" · ")
                  : "Your first run is waiting."}
              </p>
              <p className="muted">
                Saved on this browser. No account, no global rankings.
              </p>
            </>
          )}
        </Modal>
      )}
    </main>
  );
}

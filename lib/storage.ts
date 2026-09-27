import { Run } from "./game";
export type Stats = {
  gamesPlayed: number;
  bestScore: number;
  bestLevel: number;
  totalCorrect: number;
  totalWrong: number;
  bestCombo: number;
  averageAccuracy: number;
  recentScores: number[];
};
export const blankStats: Stats = {
  gamesPlayed: 0,
  bestScore: 0,
  bestLevel: 0,
  totalCorrect: 0,
  totalWrong: 0,
  bestCombo: 0,
  averageAccuracy: 0,
  recentScores: [],
};
const key = "mindfkd:stats:v1";
export function readStats(): Stats {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    if (!v) return { ...blankStats };
    if (
      Object.keys(blankStats).some(
        (k) => k !== "recentScores" && (!Number.isFinite(v[k]) || v[k] < 0),
      ) ||
      !Array.isArray(v.recentScores)
    )
      return { ...blankStats };
    return {
      ...v,
      recentScores: v.recentScores
        .filter((n: unknown) => typeof n === "number" && Number.isFinite(n))
        .slice(0, 8),
    };
  } catch {
    return { ...blankStats };
  }
}
export function accumulate(s: Stats, r: Run): Stats {
  const totalCorrect = s.totalCorrect + r.correct,
    totalWrong = s.totalWrong + r.incorrect;
  return {
    gamesPlayed: s.gamesPlayed + 1,
    bestScore: Math.max(s.bestScore, r.score),
    bestLevel: Math.max(s.bestLevel, r.level),
    bestCombo: Math.max(s.bestCombo, r.bestCombo),
    totalCorrect,
    totalWrong,
    averageAccuracy:
      totalCorrect + totalWrong
        ? (100 * totalCorrect) / (totalCorrect + totalWrong)
        : 0,
    recentScores: [r.score, ...s.recentScores].slice(0, 8),
  };
}
export function saveStats(stats: Stats) {
  try {
    localStorage.setItem(key, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}

/** Versioned survival rules shared by RUN, DAILY and asynchronous challenges. */
export const RULES = {
  version: 1,
  startMs: 30_000,
  bonusMs: 4_000,
  penaltyMs: 6_000,
  correctFeedbackMs: 520,
  wrongFeedbackMs: 850,
  pointsPerTier: 150,
  speedBonus: 300,
  speedStepMs: 10,
  sequenceLength: 50,
  difficultyCeilings: [5, 10, 15, 20, 30, 40, Infinity],
  multipliers: [
    [15, 3],
    [10, 2],
    [5, 1.5],
    [3, 1.2],
  ] as const,
  heat: [
    [8, "BRAIN MELT"],
    [5, "ON FIRE"],
    [3, "HEATING UP"],
  ] as const,
};
export const comboHeat = (combo: number) =>
  RULES.heat.find(([n]) => combo >= n)?.[1] ?? `${combo} STREAK`;
export const RELEASE = "1.1.0";

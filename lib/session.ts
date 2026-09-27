/** A session descriptor can later be issued and validated by a ranked server. */
export type Session = {
  game: "mindfkd";
  version: 1;
  mode: "practice" | "daily";
  seed: number;
  date?: string;
};
export function dailySession(date: string): Session {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Expected a UTC YYYY-MM-DD date");
  let seed = 2166136261;
  for (const character of `mindfkd:v1:${date}`)
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return { game: "mindfkd", version: 1, mode: "daily", seed: seed >>> 0, date };
}
export type GameSound = "correct" | "wrong" | "combo" | "lowTime" | "gameOver";
/** Future audio adapters subscribe to domain events; V0 intentionally has no audio. */
export type SoundAdapter = {
  play: (event: GameSound) => void;
  mute: (muted: boolean) => void;
};

import { Run } from "./game";
export const shareText = (r: Run) =>
  `MINDFKD ⚡\n\n🧠 ${r.score.toLocaleString("en-US")}\n⚡ Level ${r.level}\n🎯 ${r.correct}/${r.correct + r.incorrect}\n🔥 ${r.bestCombo} combo\n\nHow far can your brain go?`;
export async function shareRun(r: Run) {
  const text = shareText(r);
  if (navigator.share) {
    try {
      await navigator.share({ title: "MINDFKD", text });
      return "Shared";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "";
    }
  }
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return "Copied to clipboard";
  }
  throw new Error("Copy unavailable");
}

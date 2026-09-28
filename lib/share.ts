import { trackShare } from "./analytics";
import { profileUrl } from "./api";
import { Run } from "./game";
export const shareText = (r: Run, username?: string, runId?: string) =>
  `MINDFKD ⚡\n\n🧠 ${r.score.toLocaleString("en-US")}\n⚡ Level ${r.level}\n🎯 ${r.correct}/${r.correct + r.incorrect}\n🔥 ${r.bestCombo} combo\n\nHow far can your brain go?\nhttps://mindfkd.com${username ? `\nMy profile: ${profileUrl(username, runId)}` : ""}`;
export async function shareRun(
  r: Run,
  username?: string,
  runId?: string,
  analyticsRunId = runId,
) {
  const text = shareText(r, username, runId);
  if (navigator.share) {
    try {
      await navigator.share({ title: "MINDFKD", text });
      if (analyticsRunId)
        trackShare({
          run_id: analyticsRunId,
          score: r.score,
          level: r.level,
          share_method: "native_share",
        });
      return "Shared";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "";
    }
  }
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    if (analyticsRunId)
      trackShare({
        run_id: analyticsRunId,
        score: r.score,
        level: r.level,
        share_method: "clipboard",
      });
    return "Copied to clipboard";
  }
  throw new Error("Copy unavailable");
}

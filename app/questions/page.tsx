import Link from "next/link";
import { questions } from "../../data/questions";
export const metadata = { title: "Questions & fairness – MINDFKD" };
export default function Page() {
  return (
    <main>
      <header>
        <Link className="brand" href="/">
          MINDFKD
        </Link>
      </header>
      <article className="social-content">
        <h1>Fresh questions. Fair runs.</h1>
        <p>
          Our current pool contains {questions.length.toLocaleString("en-US")}{" "}
          questions. Each level draws from its own difficulty tier, with a mix
          of topics.
        </p>
        <p>
          Signed-in players have private question history across devices. Guest
          history stays in this browser. Questions and linked duplicate facts do
          not repeat while that history is retained. Live matches use questions
          that are new to every participant. When no unseen questions remain at
          the required difficulty, we stop instead of recycling them. Try
          another category while we add more.
        </p>
        <p>
          Difficulty starts with editorial ratings, not measured player success
          rates. We record ranked answer accuracy and response times to inform
          future reviews. Leaderboards show all-time best scores by category.
          Past scores and result links remain available when the bank changes.
        </p>
        <h2>Sources and corrections</h2>
        <p>
          Community questions are adapted from{" "}
          <a href="https://opentdb.com/">
            Open Trivia Database, by PIXELTAIL GAMES LLC and its contributors
          </a>
          , under{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">
            CC BY-SA 4.0
          </a>
          . We reviewed wording and difficulty, excluded unsuitable entries, and
          corrected selected wording and spelling. This is not an independent
          factual audit of every community contribution.
        </p>
        <p>
          <a href="/community-questions.json" download>
            Download the adapted community question data
          </a>{" "}
          under the same license. Original MINDFKD questions are separate from
          this community dataset.
        </p>
        <p>
          New imports wait for review before joining the game. Questions with
          uncertain, stale or ambiguous answers are excluded from play rather
          than erasing historical results. Spot an issue?{" "}
          <a href="mailto:ceo@mindfkd.com?subject=MINDFKD%20question%20correction">
            Send a correction
          </a>
          .
        </p>
      </article>
    </main>
  );
}

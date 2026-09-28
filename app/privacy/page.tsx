import Link from "next/link";
export const metadata = { title: "Privacy – MINDFKD" };
export default function Page() {
  return (
    <main>
      <header>
        <Link href="/" className="brand">
          MINDFKD
        </Link>
      </header>
      <article className="social-content">
        <h1>Your privacy.</h1>
        <p>
          Guest runs, personal statistics and question history are stored in
          your browser.
        </p>
        <p>
          If you sign in with Google, MINDFKD verifies your Google identity and
          stores a Google account identifier, your chosen public username,
          display name, optional bio, verified runs and follow relationships. We
          also store which questions you see and your answer accuracy and
          response times to reduce repeats and improve difficulty. This question
          history is private. We do not store your Google password or display
          your email address.
        </p>
        <p>
          Live rooms store team membership and submitted answers to verify
          results. Room members can see each player’s scores and correct, wrong
          and unanswered counts; answers are revealed after the shared timer
          closes. Your 1v1 wins, losses and draws and team wins and losses
          appear on your public profile. Your profile, scores and the players
          you follow are public and may be shared. Only create a profile with
          information you want others to see.
        </p>
        <p>
          A secure session cookie keeps you signed in for up to 30 days. Sign
          out to end the current session. Google processes sign-in under its own
          privacy policy; hosting and database services process the information
          needed to operate the game.
        </p>
        <p>
          For account deletion or privacy questions, email{" "}
          <a href="mailto:ceo@mindfkd.com">ceo@mindfkd.com</a>. Requests should
          come from the Google account used to sign in so ownership can be
          verified.
        </p>
        <p>
          Optional usage analytics are off until you allow them through
          Analytics preferences, which appears when a provider is configured.
          Google Analytics may receive anonymous browser, session and run
          identifiers, campaign labels, page visits and game outcomes. Vercel
          Analytics and Speed Insights may measure usage and performance on
          supported hosting. We do not send names, emails, profile text or
          answer text to analytics.
        </p>
        <p>
          Analytics preferences can be changed at any time. Declining stops
          future analytics and removes local analytics identifiers and
          first-party Google analytics cookies; it does not erase data already
          received by a provider. Browser Do Not Track and Global Privacy
          Control disable optional analytics. Essential sign-in, local game
          statistics and ranked question history work independently.
        </p>
        <p>Last updated: 28 September 2026.</p>
      </article>
    </main>
  );
}

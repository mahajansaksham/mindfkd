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
        <p>Guest runs and personal statistics are stored in your browser.</p>
        <p>
          If you sign in with Google, MINDFKD verifies your Google identity and
          stores a Google account identifier, your chosen public username,
          display name, optional bio, verified runs and follow relationships. We
          do not store your Google password or display your email address.
        </p>
        <p>
          Your profile, scores and the players you follow are public and may be
          shared. Only create a profile with information you want others to see.
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
        <p>Last updated: 27 September 2026.</p>
      </article>
    </main>
  );
}

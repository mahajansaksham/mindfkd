import AnalyticsRoot from "../components/Analytics";
import type { Metadata } from "next";
import "./globals.css";
import { AccountProvider } from "../components/Account";
export const metadata: Metadata = {
  title: "MINDFKD – How Far Can Your Brain Go?",
  description:
    "30 seconds. Increasingly difficult questions. How far can your brain go?",
  openGraph: {
    title: "MINDFKD – How Far Can Your Brain Go?",
    description:
      "30 seconds. Increasingly difficult questions. How far can your brain go?",
    type: "website",
  },
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AccountProvider>{children}</AccountProvider>
        <footer className="site-contact">
          <a href="mailto:ceo@mindfkd.com">
            Contact us <span>↗</span>
          </a>
          <a href="/questions">Question sources &amp; fairness</a>
        </footer>
        <AnalyticsRoot vercelHosted={process.env.VERCEL === "1"} />
      </body>
    </html>
  );
}

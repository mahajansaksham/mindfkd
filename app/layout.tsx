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
      </body>
    </html>
  );
}

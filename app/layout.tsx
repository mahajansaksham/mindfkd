import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MINDFKD – How Far Can Your Brain Go?",
  description:
    "60 seconds. Increasingly difficult questions. How far can your brain go?",
  openGraph: {
    title: "MINDFKD – How Far Can Your Brain Go?",
    description:
      "60 seconds. Increasingly difficult questions. How far can your brain go?",
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
      <body>{children}</body>
    </html>
  );
}

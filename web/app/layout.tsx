import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Party Card Games — solo or drop-in multiplayer",
  description:
    "Play absurd party card games like Fill In The Blank, Horrible Therapist and Red Flags. Great solo — and friends can drop in live.",
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

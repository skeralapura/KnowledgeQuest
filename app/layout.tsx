import type { Metadata } from "next";
import { Sora, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SkipToContent } from "./components/SkipToContent";

// Section 4 — Typography
// Sora: headings only, weights 600 and 700
const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-sora",
  display: "swap",
});

// DM Sans: body copy, weights 400 and 500
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-sans",
  display: "swap",
});

// JetBrains Mono: hashes and debug info only — use sparingly
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KnowledgeQuest",
  description: "Adaptive K–8 learning — personalized questions powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <SkipToContent />
        {children}
      </body>
    </html>
  );
}

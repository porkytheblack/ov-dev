import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const title = "Overwatch — Meet your new security guard";
const description =
  "Always watching, always ready to keep you safe. Overwatch turns the cameras you already have into an AI security guard that spots trouble and messages you on WhatsApp or Telegram the moment it matters.";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL("https://overwatch.example.com"),
  keywords: [
    "AI surveillance",
    "security camera AI",
    "self-hosted CCTV",
    "WhatsApp security alerts",
    "Telegram security alerts",
    "incident detection",
    "Overwatch",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Overwatch",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

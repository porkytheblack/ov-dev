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

const title = "Overwatch — AI Surveillance That Messages You";
const description =
  "Multi-camera AI surveillance. Connects to your cameras, watches the zones that matter, and messages you on WhatsApp or Telegram when it counts.";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL("https://overwatch.app"),
  applicationName: "Overwatch",
  keywords: [
    "AI surveillance",
    "multi-camera security",
    "real-time object detection",
    "security camera alerts",
    "WhatsApp security alerts",
    "Telegram camera notifications",
    "conversational security agent",
    "intrusion detection",
  ],
  authors: [{ name: "Cradle Labs Limited" }],
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
  themeColor: "#ffffff",
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

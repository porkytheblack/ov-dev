# Overwatch — Marketing Site

Standalone marketing / landing site for **Overwatch**, the multi-camera AI
surveillance system.

> Meet your new security guard — always watching, always ready to keep you safe.

This is **not** part of the Docker stack or the pnpm monorepo. It is a
self-contained Next.js app deployed independently on **Vercel**.

## Stack

- Next.js 14 (App Router) + React 18
- Tailwind CSS, tuned to the Overwatch brand palette
- Inter + JetBrains Mono via `next/font` (self-hosted at build time)
- Zero external image dependencies — every camera feed, phone mock and
  chat UI is hand-built SVG/CSS, so it deploys with no asset pipeline and
  renders instantly

## Local development

```bash
cd landing-site
npm install
npm run dev          # http://localhost:4000
```

Other scripts:

```bash
npm run build        # production build
npm run start        # serve the production build on :4000
npm run typecheck    # tsc --noEmit
```

## Deploying to Vercel

1. Create a new Vercel project from this repository.
2. Set **Root Directory** to `landing-site`.
3. Framework preset: **Next.js** (auto-detected). Build command
   `next build`, install command `npm install` — both pinned in
   `vercel.json`.
4. No environment variables required.

The site is fully static/SSG — no backend, no API routes, no secrets.

## What it shows

- The tagline and positioning ("your new security guard")
- The problem: cameras record but don't watch
- How it works in four steps
- An interactive showcase of real scenarios on phone mocks:
  - Intrusion alert on WhatsApp
  - Fire & smoke alert on Telegram with inline actions
  - Asking the agent "what happened in the last hour?"
  - A scheduled overnight briefing
- Capability grid, a dashboard live-view mock, channel breakdown,
  the self-hosted/privacy story, and a get-started CTA

## Structure

```
landing-site/
├── app/
│   ├── layout.tsx        # fonts, metadata, viewport
│   ├── globals.css       # brand tokens + component classes
│   ├── icon.svg          # favicon
│   └── page.tsx          # composes the sections
└── components/
    ├── Nav, Hero, TrustStrip, Problem, HowItWorks,
    │   Showcase, Features, LiveView, Channels, Privacy, CTA, Footer
    ├── Reveal.tsx         # scroll-reveal wrapper
    ├── Wordmark.tsx       # logo + pulsing mark
    └── mocks/
        ├── PhoneFrame.tsx     # device bezel + status bar
        ├── CameraFeed.tsx     # SVG CCTV scenes + detection overlays
        ├── WhatsAppChat.tsx   # WhatsApp UI + incident card
        ├── TelegramChat.tsx   # Telegram UI + inline keyboard
        └── Typing.tsx         # agent typing indicator
```

# Overwatch — Marketing & Waitlist Site

Standalone pre-launch **waitlist** site for **Overwatch**, multi-camera AI
surveillance that messages you on WhatsApp or Telegram when it counts.

> Meet your new security guard — always watching, always ready.

Operated by **Cradle Labs Limited**. This is a self-contained Next.js app
deployed independently on **Vercel** (it is not wired into the product
stack or the pnpm monorepo).

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS — clean, light-by-default brand theme
- Inter + JetBrains Mono via `next/font` (fetched at build time)
- Zero external image dependencies — every camera feed, phone mock and
  chat UI is hand-built SVG/CSS, so it deploys with no asset pipeline

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
3. Framework preset: **Next.js** (auto-detected). Build/install commands
   are pinned in `vercel.json`.
4. Optional: set `NEXT_PUBLIC_WAITLIST_ENDPOINT` to a URL that accepts
   `POST { email }` (e.g. a form/CRM provider). If unset, the form
   validates and shows the success state without sending anywhere — wire
   this up before launch so signups are captured.

The site is fully static/SSG. No backend, no secrets.

## Pages

- `/` — the landing page (hero, problem, how it works, interactive
  showcase, features, dashboard view, channels, trust, waitlist)
- `/terms` — Terms of Service (Cradle Labs Limited)
- `/privacy-policy` — Privacy Policy (Cradle Labs Limited)

> The legal pages are templates with clearly bracketed placeholders
> (`[DATE]`, `[Contact email: hello@ — confirm]`,
> `[Registered address — confirm]`, `[Governing law … — confirm]`).
> Fill these in and have them reviewed by a qualified lawyer before
> launch.

## The interactive showcase

A tabbed demo of what actually arrives on a phone:

- **Intrusion** — person at the gate at night → WhatsApp
- **Fire & smoke** — urgent alert with one-tap actions → Telegram
- **Ask it** — "what happened last hour?" → conversational reply on
  WhatsApp
- **Briefing** — scheduled overnight rollup → Telegram

## Structure

```
landing-site/
├── app/
│   ├── layout.tsx            # fonts, SEO metadata, viewport
│   ├── globals.css           # light brand tokens + component/legal styles
│   ├── icon.svg              # favicon
│   ├── page.tsx              # composes the landing sections
│   ├── terms/page.tsx
│   └── privacy-policy/page.tsx
└── components/
    ├── Nav, Hero, Problem, HowItWorks, Showcase, Features,
    │   LiveView, Channels, Trust, Waitlist, Footer
    ├── LegalPage.tsx         # shared chrome for legal pages
    ├── Reveal.tsx            # scroll-reveal wrapper
    ├── Wordmark.tsx          # logo + pulsing mark
    └── mocks/
        ├── PhoneFrame.tsx     # device bezel + status bar
        ├── CameraFeed.tsx     # SVG CCTV scenes + detection overlays
        ├── WhatsAppChat.tsx   # WhatsApp UI (light) + incident card
        ├── TelegramChat.tsx   # Telegram UI (light) + inline keyboard
        └── Typing.tsx         # agent typing indicator
```

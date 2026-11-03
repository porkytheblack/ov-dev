# Overwatch — Marketing Site

Premium sales site for **Overwatch** installations: we survey, install and
provision AI security (on-site control software, WhatsApp integration,
Telegram integration and smart monitoring) and hand over a tuned system.

Operated by **Cradle Labs Limited**. This is a self-contained Next.js app
deployed independently on **Vercel** (it is not wired into the product
stack or the pnpm monorepo).

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS — dark brand theme following `build-spec.md` §0 (single
  amber accent, sharp geometry, mono for data)
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
4. Optional: set `NEXT_PUBLIC_CONTACT_ENDPOINT` to a URL that accepts a
   JSON `POST` of the site-survey form
   (`{ name, phone, email, property, cameras, location, message, services[] }`),
   e.g. a form/CRM provider. If unset, submitting opens the visitor's mail
   client with the enquiry prefilled to `hello@dterminal.net`.

The site is fully static/SSG. No backend, no secrets.

## Pages

- `/` — the landing page (hero console, services, interactive scenarios,
  capabilities, process, security architecture, engagements, FAQ,
  site-survey form)
- `/terms` — Terms of Service (Cradle Labs Limited)
- `/privacy-policy` — Privacy Policy (Cradle Labs Limited)

> The legal pages are templates with clearly bracketed placeholders
> (`[DATE]`, `[Contact email: hello@ — confirm]`,
> `[Registered address — confirm]`, `[Governing law … — confirm]`).
> Fill these in and have them reviewed by a qualified lawyer before
> launch.

## The scenarios section

A tabbed demo of what's possible. Each tab shows the camera view, the
pipeline steps "under the hood", and what arrives on the phone:

- **Perimeter breach** — instant trigger after dark → WhatsApp
- **Loitering** — linger threshold at the gate → WhatsApp
- **Fire & smoke** — critical class, group alert with acknowledge → Telegram
- **After-hours vehicle** — scheduled zone at the loading bay → Telegram
- **Ask it anything** — the agent answers from footage → WhatsApp
- **Morning briefing** — scheduled overnight summary → Telegram

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
    ├── Nav, Hero, Services, Scenarios, Capabilities, Process,
    │   Security, Engagements, Faq, Contact, Footer
    ├── LegalPage.tsx         # shared chrome for legal pages
    ├── Reveal.tsx            # scroll-reveal wrapper
    ├── Wordmark.tsx          # logo + pulsing mark
    └── mocks/
        ├── Console.tsx        # control-console mock with live event log
        ├── PhoneFrame.tsx     # device bezel + status bar
        ├── CameraFeed.tsx     # SVG CCTV scenes + detection overlays
        ├── WhatsAppChat.tsx   # WhatsApp UI + incident card
        ├── TelegramChat.tsx   # Telegram UI + inline keyboard
        └── Typing.tsx         # agent typing indicator
```

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
- Camera feeds are real photographs graded to read as CCTV footage
  (`public/feeds/`), with detection boxes and zones drawn as SVG on top;
  phone and chat UIs are hand-built CSS

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
- `/terms` — Terms of Service: site use, enquiries, surveys, quotes and the services framework
- `/privacy-policy` — Privacy Policy, including how installed systems handle footage
- `/dpa` — standard-form Data Processing Agreement for customers

> The legal pages describe the standard architecture (on-site recording;
> incident clips and assistant messages sent to third-party AI providers
> unless the local AI configuration is used; alerts via Meta/Telegram). If
> the default providers or architecture change, update `/privacy-policy`
> §6, `/terms` §6 and `/dpa` §16 and Annex 3. Have them reviewed by a
> qualified lawyer before relying on them.

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

## Photography

All photographs are from [Pexels](https://www.pexels.com) and used under the
[Pexels License](https://www.pexels.com/license/) (free for commercial use,
no attribution required). They were cropped to 16:9, desaturated, contrast-
graded and given sensor grain to read as security footage; licence plates
and a third-party trailer logo were blurred or cropped out.

| File | Pexels photo |
|---|---|
| `public/feeds/gate.jpg` | https://www.pexels.com/photo/10135152/ |
| `public/feeds/perimeter.jpg` | https://www.pexels.com/photo/17955862/ |
| `public/feeds/driveway.jpg` | https://www.pexels.com/photo/18280830/ |
| `public/feeds/bay.jpg` | https://www.pexels.com/photo/12689710/ |
| `public/feeds/fire.jpg` | https://www.pexels.com/photo/35510319/ |
| `public/feeds/house.jpg` | https://www.pexels.com/photo/186077/ |
| `public/images/hardware.jpg` | https://www.pexels.com/photo/7463021/ |

Detection-box coordinates for each feed live in
`components/mocks/CameraFeed.tsx` (a 400×225 overlay space); update them if
you swap a photo.


import { Reveal } from "./Reveal";

const sectors = [
  ["Private residences", "Gates, perimeters, driveways and staff entrances"],
  ["Gated estates & compounds", "Multi-gate access, guard posts, shared areas"],
  ["Warehouses & yards", "Bay doors, stock rooms, after-hours vehicles"],
  ["Retail & hospitality", "Back-of-house, cash rooms, closing routines"],
  ["Construction sites", "Plant, materials and perimeter overnight"],
  ["Farms & remote sites", "Livestock, stores, fuel and fence lines"],
];

const tiers = [
  {
    name: "Residence",
    fit: "Homes and small properties",
    scope: "Up to 8 cameras",
    items: [
      "Site survey & design",
      "Camera install or re-use",
      "On-site Overwatch server",
      "WhatsApp alerts & agent",
      "14-day tuning period",
    ],
  },
  {
    name: "Business",
    fit: "Offices, retail, warehouses",
    scope: "8 – 32 cameras",
    featured: true,
    items: [
      "Everything in Residence",
      "WhatsApp + Telegram team alerting",
      "Per-zone routing & schedules",
      "Operator accounts & training",
      "Scheduled briefings & reports",
      "Managed care option",
    ],
  },
  {
    name: "Estate & Enterprise",
    fit: "Compounds, multi-site, critical sites",
    scope: "32+ cameras · multi-site",
    items: [
      "Everything in Business",
      "Multi-site architecture",
      "Guard-post escalation design",
      "On-prem AI incident summaries",
      "Priority support with response targets",
      "Custom integrations",
    ],
  },
];

export function Engagements() {
  return (
    <section id="engagements" className="relative border-t border-border bg-surface">
      <div className="container-ov py-24 lg:py-32">
        <Reveal>
          <span className="eyebrow">Who we protect</span>
        </Reveal>
        <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map(([t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 50} className="flex items-start gap-4 bg-bg px-6 py-5">
              <span className="mono pt-[3px] text-[11px] text-text-dim">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-[15px] font-medium text-text">{t}</p>
                <p className="mt-0.5 text-[13.5px] text-text-muted">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-28 grid gap-8 lg:grid-cols-2 lg:items-end">
          <Reveal>
            <span className="eyebrow">Engagements</span>
            <h2 className="section-title mt-4 max-w-[16ch]">
              Scoped to your site. Quoted once.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="lead max-w-[34rem] lg:justify-self-end">
              Every property is different, so every engagement starts with a
              survey. You get a fixed quote covering hardware, installation,
              provisioning and tuning. Your recordings live on your own
              hardware, so there are no cloud storage fees.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-px border border-border bg-border lg:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal
              key={t.name}
              delay={i * 70}
              className={`relative flex flex-col p-8 ${t.featured ? "bg-surface-elev" : "bg-bg"}`}
            >
              {t.featured && <span className="absolute inset-x-0 top-0 h-[2px] bg-accent" />}
              <div className="flex items-center justify-between">
                <span className="index">{t.fit}</span>
                {t.featured && (
                  <span className="pill border-accent/50 text-accent">Recommended</span>
                )}
              </div>
              <h3 className="mt-5 text-[26px] font-medium tracking-[-0.02em] text-text">{t.name}</h3>
              <p className="mono mt-1 text-[13px] text-accent">{t.scope}</p>
              <ul className="mt-7 flex-1 space-y-3 border-t border-border pt-6">
                {t.items.map((it) => (
                  <li key={it} className="flex gap-3 text-[14px] text-text-muted">
                    <span className="mt-[9px] h-px w-3 shrink-0 bg-accent" />
                    {it}
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`${t.featured ? "btn-primary" : "btn"} mt-9 w-full`}
              >
                Request a quote
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

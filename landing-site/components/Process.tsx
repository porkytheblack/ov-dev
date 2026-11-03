import { Reveal } from "./Reveal";

const steps = [
  {
    n: "01",
    title: "Site survey",
    dur: "Day 1",
    body: "An engineer walks the property with you and maps entry points, blind spots, lighting, power and network. We audit the cameras you already have.",
    out: "Threat map · camera audit",
  },
  {
    n: "02",
    title: "System design",
    dur: "Days 2–4",
    body: "You get a written plan covering camera placements and fields of view, the zone and rule plan, server sizing, network segmentation and who gets alerted for what.",
    out: "Design pack · fixed quote",
  },
  {
    n: "03",
    title: "Installation",
    dur: "Days 5–10",
    body: "We mount and cable the cameras, install the on-site server, put cameras on an isolated network and deploy the Overwatch console.",
    out: "Hardware live · console online",
  },
  {
    n: "04",
    title: "Provisioning",
    dur: "Days 10–12",
    body: "We set up your WhatsApp Business number and Telegram bot, create operator accounts, draw every zone and configure the alert routing.",
    out: "Channels verified · rules armed",
  },
  {
    n: "05",
    title: "Tuning & handover",
    dur: "14 days",
    body: "For two weeks we watch the alerts with you and adjust thresholds, schedules and suppressions until false alarms stop. Then we train your team.",
    out: "Signed commissioning report",
  },
  {
    n: "06",
    title: "Managed care",
    dur: "Ongoing",
    body: "Optional: we monitor system health, apply updates, re-tune when your site changes, and respond when a camera or disk needs attention.",
    out: "Health checks · updates · support",
  },
];

export function Process() {
  return (
    <section id="process" className="relative border-t border-border bg-surface">
      <div className="container-ov py-24 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <Reveal>
            <span className="eyebrow">How an engagement runs</span>
            <h2 className="section-title mt-4 max-w-[18ch]">
              From walkthrough to a working system, in weeks.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="lead max-w-[34rem] lg:justify-self-end">
              One team handles the whole project, from the first site walk to
              the day your guards stop getting false alarms. Typical
              residential and commercial sites go live within two weeks of
              sign-off.
            </p>
          </Reveal>
        </div>

        <Reveal delay={60}>
          <figure className="relative mt-16 overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hardware.jpg"
              alt="A security camera mounted on a brick wall"
              loading="lazy"
              className="block aspect-[16/9] w-full object-cover sm:aspect-[21/9]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <figcaption className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
              <p className="max-w-md text-[15px] leading-snug text-text sm:text-[17px]">
                Professional-grade cameras, mounted, cabled and labelled by
                our own engineers.
              </p>
              <p className="mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                PoE · weather-rated · tamper-checked
              </p>
            </figcaption>
          </figure>
        </Reveal>

        <ol className="mt-px grid gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} as="li" delay={(i % 3) * 60} className="relative flex flex-col bg-bg p-7">
              <div className="flex items-baseline justify-between">
                <span className="mono text-[28px] font-medium leading-none tracking-[-0.02em] text-accent">
                  {s.n}
                </span>
                <span className="mono text-[11px] uppercase tracking-[0.12em] text-text-dim">
                  {s.dur}
                </span>
              </div>
              <h3 className="mt-6 text-[18px] font-medium text-text">{s.title}</h3>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-text-muted">{s.body}</p>
              <p className="mono mt-6 border-t border-border pt-4 text-[11.5px] uppercase tracking-[0.08em] text-text">
                <span className="text-accent">→</span> {s.out}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

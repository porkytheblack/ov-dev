import { Reveal } from "./Reveal";

const facts = [
  { k: "Footage sold or mined", v: "Never" },
  { k: "Answers from real data", v: "100%" },
  { k: "Invented events", v: "Zero" },
  { k: "Zones you control", v: "Always" },
];

const chips = [
  "Private by default",
  "Factual answers only",
  "Fewer false alarms",
  "You stay in control",
];

export function Trust() {
  return (
    <section id="trust" className="border-y border-border bg-surface-elev/60">
      <div className="container-ov py-24 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <Reveal>
            <div>
              <span className="eyebrow">Why you can trust it</span>
              <h2 className="section-title mt-4">Private by default.</h2>
              <p className="lead mt-5 max-w-[34rem]">
                Overwatch is built to earn trust: your footage stays private,
                answers come only from real data, and you stay in control of
                what&apos;s watched and when.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {chips.map((t) => (
                  <span
                    key={t}
                    className="mono inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3.5 py-2 text-[12px] text-text-muted"
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
              {facts.map((f) => (
                <div key={f.k} className="bg-bg p-7">
                  <p className="mono text-[11px] uppercase tracking-[0.1em] text-text-dim">
                    {f.k}
                  </p>
                  <p className="mono mt-2 text-[1.5rem] font-medium text-accent">
                    {f.v}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

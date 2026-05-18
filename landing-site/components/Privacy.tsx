import { Reveal } from "./Reveal";

const facts = [
  { k: "Runs on", v: "Your hardware" },
  { k: "Footage leaves network", v: "Never" },
  { k: "Vendor cloud", v: "None" },
  { k: "Monthly fee", v: "$0" },
];

export function Privacy() {
  return (
    <section id="privacy" className="border-y border-border bg-surface/30">
      <div className="container-ov py-24 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <Reveal>
            <div>
              <span className="eyebrow">Self-hosted by design</span>
              <h2 className="section-title mt-4">
                Your footage stays yours
              </h2>
              <p className="lead mt-5 max-w-[34rem]">
                A security guard you don&apos;t have to trust a third party
                with. Overwatch is a single Docker stack you run on your own
                box. Cameras, detections, clips, the AI agent — all of it stays
                inside your network. No vendor account, no upload, no lock-in.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {[
                  "Docker compose up",
                  "Postgres · Redis · object storage",
                  "Bring your own LLM key",
                  "Open architecture",
                ].map((t) => (
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

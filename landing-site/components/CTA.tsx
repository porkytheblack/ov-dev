import { Reveal } from "./Reveal";

export function CTA() {
  return (
    <section id="get-started" className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(245,173,74,0.16), transparent 60%)",
        }}
      />
      <div className="container-ov relative py-28 text-center">
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-[clamp(2.1rem,5vw,3.6rem)] font-medium leading-[1.06] tracking-[-0.025em]">
            Put a guard on duty tonight.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="lead mx-auto mt-6 max-w-xl">
            Clone it, point it at your cameras, and let it watch. Up and running
            in minutes — on your own hardware.
          </p>
        </Reveal>

        <Reveal delay={140}>
          <div className="mx-auto mt-10 max-w-xl overflow-hidden rounded-xl border border-border bg-surface text-left shadow-elev">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
              <span className="mono ml-2 text-[11px] text-text-dim">
                bash
              </span>
            </div>
            <pre className="mono overflow-x-auto px-5 py-4 text-[13px] leading-relaxed text-text">
              <span className="text-text-dim">$ </span>git clone overwatch &amp;&amp; cd overwatch
              {"\n"}
              <span className="text-text-dim">$ </span>cp .env.example .env
              <span className="text-text-dim">  # add your tokens</span>
              {"\n"}
              <span className="text-text-dim">$ </span>
              <span className="text-accent">make up</span>
              {"\n"}
              <span className="text-success">→ </span>open http://localhost:9090
            </pre>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="#get-started" className="btn-primary">
              Get started
            </a>
            <a href="#showcase" className="btn">
              Watch it work
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

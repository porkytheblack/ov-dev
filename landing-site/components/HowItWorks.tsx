import { Reveal } from "./Reveal";
import { CameraFeed } from "./mocks/CameraFeed";

const steps = [
  {
    n: "01",
    t: "Watch",
    d: "Overwatch reads your camera feeds live and tracks objects across frames in real time.",
  },
  {
    n: "02",
    t: "Detect",
    d: "AI vision identifies 80+ object classes inside the zones and time windows you care about.",
  },
  {
    n: "03",
    t: "Decide",
    d: "Smart logic separates a real event from a passing shadow before anything fires.",
  },
  {
    n: "04",
    t: "Notify",
    d: "A confirmed incident becomes a clip, a poster and a plain-language message on your phone.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-surface-elev/60">
      <div className="container-ov py-24 lg:py-28">
        <Reveal>
          <div className="max-w-2xl">
            <span className="eyebrow">The model</span>
            <h2 className="section-title mt-4">Watch. Detect. Decide. Notify.</h2>
            <p className="lead mt-5">
              Four stages, running continuously across every camera.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <ol className="relative">
            <span className="absolute bottom-3 left-[15px] top-3 w-px bg-border" />
            {steps.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 70}>
                <div className="relative flex gap-5 pb-9 last:pb-0">
                  <span className="mono relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-bg text-[12px] font-medium text-accent">
                    {s.n}
                  </span>
                  <div className="pt-0.5">
                    <h3 className="text-[1.2rem] font-medium">{s.t}</h3>
                    <p className="mt-1.5 max-w-[32rem] text-[14.5px] text-text-muted">
                      {s.d}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={120}>
            <div className="card overflow-hidden p-3">
              <CameraFeed
                scene="driveway"
                camera="CAM-02 · DRIVEWAY"
                time="19:42:08"
                tag="LIVE"
              />
              <div className="flex items-center justify-between px-1 pt-3">
                <span className="mono text-[11px] uppercase tracking-[0.1em] text-text-dim">
                  Zone matched · tracking 2 objects
                </span>
                <span className="pill border-accent text-accent">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-blink" />
                  Watching
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

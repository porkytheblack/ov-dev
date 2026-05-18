import { Reveal } from "./Reveal";

export function Problem() {
  return (
    <section className="container-ov py-24 lg:py-28">
      <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <Reveal>
          <div className="lg:sticky lg:top-24">
            <span className="eyebrow">The problem</span>
            <h2 className="section-title mt-4">
              Cameras record.
              <br />
              They don&apos;t watch.
            </h2>
            <p className="lead mt-5 max-w-[30rem]">
              Footage is only useful after something has already happened — once
              you know to go looking for it. Nobody can stare at a wall of feeds
              all night. The moment that mattered is buried in hours of nothing.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              k: "Before",
              t: "Passive recording",
              items: [
                "You find out hours later, by scrubbing tape",
                "Motion alerts cry wolf on every shadow and cat",
                "No idea what actually happened without watching",
                "Footage locked to one vendor's cloud and app",
              ],
              tone: "danger",
            },
            {
              k: "With Overwatch",
              t: "An AI guard on duty",
              items: [
                "Messaged the instant a real incident starts",
                "Only the zones and objects you care about",
                "A clip with boxes drawn — and a plain-language summary",
                "Self-hosted: your footage stays on your network",
              ],
              tone: "accent",
            },
          ].map((col, i) => (
            <Reveal key={col.k} delay={i * 80}>
              <div
                className={`card h-full p-6 ${
                  col.tone === "accent"
                    ? "border-accent/40 bg-accent-soft/20"
                    : ""
                }`}
              >
                <span
                  className={`pill ${
                    col.tone === "accent"
                      ? "border-accent text-accent"
                      : "border-border-strong text-text-dim"
                  }`}
                >
                  {col.k}
                </span>
                <h3 className="mt-4 text-[1.25rem] font-medium">{col.t}</h3>
                <ul className="mt-4 space-y-3">
                  {col.items.map((it) => (
                    <li
                      key={it}
                      className="flex gap-3 text-[14.5px] text-text-muted"
                    >
                      <span
                        className={`mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                          col.tone === "accent" ? "bg-accent" : "bg-text-dim"
                        }`}
                      />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

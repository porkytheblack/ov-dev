import { Reveal } from "./Reveal";

export function Problem() {
  return (
    <section className="container-ov py-24 lg:py-28">
      <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <Reveal>
          <div className="lg:sticky lg:top-24">
            <span className="eyebrow">The status quo</span>
            <h2 className="section-title mt-4">
              Cameras record.
              <br />
              They don&apos;t watch.
            </h2>
            <p className="lead mt-5 max-w-[30rem]">
              Most systems capture everything and understand nothing. The
              footage only matters after something has already happened — and
              you&apos;re the one scrubbing through hours of it.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              k: "The old way",
              t: "Passive recording",
              items: [
                "Endless motion pings from wind, rain and headlights",
                "You review footage after the fact, never before",
                "Hours of recording, no idea what's in it",
                "A wall of feeds no one is actually watching",
              ],
              tone: "muted",
            },
            {
              k: "With Overwatch",
              t: "An AI guard on duty",
              items: [
                "Alerts only when something genuinely lingers",
                "You're told what happened, in plain language",
                "Incidents kept long, routine footage pruned",
                "Ask it anything and get answers from real data",
              ],
              tone: "accent",
            },
          ].map((col, i) => (
            <Reveal key={col.k} delay={i * 80}>
              <div
                className={`card h-full p-6 ${
                  col.tone === "accent"
                    ? "border-[color:var(--accent-line)] bg-[color:var(--accent-soft)]"
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

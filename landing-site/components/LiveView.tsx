import { Reveal } from "./Reveal";
import { Mark } from "./Wordmark";
import { CameraFeed } from "./mocks/CameraFeed";

function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-24px_rgba(20,20,20,0.22)]">
      <div className="flex items-center gap-2 border-b border-border bg-surface-elev px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="mx-auto flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-text-dim">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="mono text-[11px] text-text-dim">
            overwatch.app/cameras
          </span>
        </div>
        <span className="w-12" />
      </div>
      {children}
    </div>
  );
}

const incidents = [
  { t: "02:14:07", cam: "FRONT GATE", cls: "person", st: "OPEN" },
  { t: "01:50:22", cam: "WEST FENCE", cls: "person", st: "SUPPRESSED" },
  { t: "23:48:31", cam: "REAR YARD", cls: "fire, smoke", st: "ACK'D" },
  { t: "19:42:08", cam: "DRIVEWAY", cls: "car, person", st: "CLOSED" },
];

export function LiveView() {
  return (
    <section className="container-ov py-24 lg:py-28">
      <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <Reveal>
          <div>
            <span className="eyebrow">Command view</span>
            <h2 className="section-title mt-4">Every camera, one screen.</h2>
            <p className="lead mt-5 max-w-[30rem]">
              When you want the full picture, the web dashboard puts every feed
              and every incident in one place — but you&apos;ll rarely need to
              open it.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "Live multi-camera grid, all feeds at a glance",
                "Incident history and calendar, fully searchable",
                "Acknowledge and close incidents in one click",
              ].map((p) => (
                <li
                  key={p}
                  className="flex gap-3 text-[14.5px] text-text-muted"
                >
                  <span className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <BrowserChrome>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="inline-flex items-center gap-2.5">
                <Mark size={18} />
                <span
                  className="mono text-[13px] font-medium uppercase text-text"
                  style={{ letterSpacing: "0.14em" }}
                >
                  Overwatch
                </span>
                <span className="inline-block h-1.5 w-1.5 bg-accent animate-pulse-mark" />
              </span>
              <span className="mono text-[11px] text-text-dim">
                4 cameras · 1 incident open · 02:15
              </span>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <CameraFeed scene="gate" camera="CAM-01 · FRONT GATE" time="02:14:07" tag="INCIDENT" />
              <CameraFeed scene="driveway" camera="CAM-02 · DRIVEWAY" time="02:15:01" tag="LIVE" />
              <CameraFeed scene="perimeter" camera="CAM-03 · WEST FENCE" time="02:15:01" tag="LIVE" />
              <CameraFeed scene="fire" camera="CAM-04 · REAR YARD" time="02:15:01" tag="LIVE" />
            </div>

            <div className="border-t border-border">
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="mono text-[11px] uppercase tracking-[0.1em] text-text-dim">
                  Recent incidents
                </span>
                <span className="mono text-[11px] text-text-dim">last 24h</span>
              </div>
              <div className="px-2 pb-3">
                {incidents.map((r) => (
                  <div
                    key={r.t}
                    className="flex items-center gap-4 rounded-lg px-3 py-2 text-[13px] hover:bg-surface-elev"
                  >
                    <span className="mono text-text-muted">{r.t}</span>
                    <span className="mono text-text">{r.cam}</span>
                    <span className="flex-1 text-text-muted">{r.cls}</span>
                    <span
                      className={`pill ${
                        r.st === "OPEN"
                          ? "border-transparent text-[color:var(--on-accent)] font-semibold"
                          : r.st === "ACK'D"
                            ? "border-success text-success"
                            : "border-border-strong text-text-dim"
                      }`}
                      style={
                        r.st === "OPEN"
                          ? { background: "var(--accent-fill)" }
                          : undefined
                      }
                    >
                      {r.st}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </BrowserChrome>
        </Reveal>
      </div>
    </section>
  );
}

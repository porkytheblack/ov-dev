import { Reveal } from "./Reveal";

const guarantees = [
  {
    title: "Your footage stays on your hardware",
    body: "Recordings, clips and frames are stored on the server we install on your premises. Nothing is uploaded to a video cloud.",
  },
  {
    title: "Cameras on an isolated network",
    body: "Cameras sit on their own VLAN with no internet access. Only the Overwatch server can reach them.",
  },
  {
    title: "Signed, expiring links",
    body: "Every playback link in an alert is signed and time-limited. Forwarded or stale links stop working.",
  },
  {
    title: "Retention you control",
    body: "You decide how long raw footage and clips are kept. Footage linked to an incident is preserved, and everything else is pruned on your schedule.",
  },
  {
    title: "Named operators, not shared logins",
    body: "Each person has their own account. Alert recipients are named per channel and per zone.",
  },
  {
    title: "Keeps watching when the internet drops",
    body: "Detection, recording and the console all run on-site. An internet outage pauses messenger alerts, not monitoring.",
  },
];

function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={accent ? "rgba(245,158,11,0.06)" : "var(--bg)"}
        stroke={accent ? "var(--accent)" : "var(--border-strong)"}
        strokeWidth="1"
      />
      <text x={x + 14} y={y + 24} fontSize="14" fill="var(--text)" fontFamily="var(--font-sans), Inter, sans-serif" fontWeight="500">
        {title}
      </text>
      <text x={x + 14} y={y + 42} fontSize="11" fill="var(--text-dim)" fontFamily="var(--font-mono), monospace" letterSpacing="0.04em">
        {sub}
      </text>
    </g>
  );
}

function Diagram() {
  const wire = { stroke: "var(--border-strong)", strokeWidth: 1, fill: "none" } as const;
  const hot = { stroke: "var(--accent)", strokeWidth: 1, fill: "none", strokeDasharray: "4 4" } as const;
  return (
    <svg viewBox="0 0 680 380" className="block w-full" role="img" aria-label="Deployment topology: cameras on an isolated network feed an on-site Overwatch server, which serves the local console and sends alerts to WhatsApp and Telegram.">
      {/* premises boundary */}
      <rect x="10" y="20" width="420" height="340" fill="none" stroke="var(--border-strong)" strokeDasharray="2 4" />
      <text x="24" y="40" fontSize="10" fill="var(--text-dim)" fontFamily="var(--font-mono), monospace" letterSpacing="0.12em">
        YOUR PREMISES
      </text>

      {/* camera vlan */}
      <rect x="30" y="58" width="130" height="282" fill="none" stroke="var(--border)" />
      <text x="42" y="76" fontSize="9.5" fill="var(--text-dim)" fontFamily="var(--font-mono), monospace" letterSpacing="0.12em">
        CAMERA VLAN
      </text>
      {["CAM-01", "CAM-02", "CAM-03", "CAM-04", "CAM-05"].map((c, i) => (
        <g key={c}>
          <rect x="44" y={90 + i * 48} width="102" height="34" fill="var(--bg)" stroke="var(--border-strong)" />
          <circle cx="60" cy={107 + i * 48} r="4" fill="none" stroke="var(--accent)" />
          <text x="72" y={111 + i * 48} fontSize="12" fill="var(--text-muted)" fontFamily="var(--font-mono), monospace">
            {c}
          </text>
          <path d={`M146 ${107 + i * 48} H186 V200 H210`} {...wire} />
        </g>
      ))}

      {/* server */}
      <Node x={210} y={150} w={200} h={100} title="Overwatch server" sub="DETECT · RECORD · REASON" accent />
      <text x="224" y="220" fontSize="11" fill="var(--text-muted)" fontFamily="var(--font-mono), monospace">
        storage · rules · agent
      </text>
      <text x="224" y="236" fontSize="11" fill="var(--text-muted)" fontFamily="var(--font-mono), monospace">
        clips · watchdog
      </text>

      {/* console */}
      <Node x={210} y={290} w={200} h={52} title="Control console" sub="LAN · BROWSER" />
      <path d="M310 250 V290" {...wire} />

      {/* outbound */}
      <path d="M410 180 H470 V92 H500" {...hot} />
      <path d="M410 200 H500" {...hot} />
      <path d="M410 220 H470 V308 H500" {...hot} />

      <text x="434" y="168" fontSize="9" fill="var(--accent)" fontFamily="var(--font-mono), monospace" letterSpacing="0.1em">
        TLS
      </text>

      <Node x={500} y={66} w={170} h={52} title="WhatsApp" sub="BUSINESS NUMBER" />
      <Node x={500} y={174} w={170} h={52} title="Telegram" sub="PRIVATE BOT · GROUP" />
      <Node x={500} y={282} w={170} h={52} title="Your phone" sub="SIGNED PLAYBACK" />

      <rect x="500" y="66" width="3" height="52" fill="#25D366" />
      <rect x="500" y="174" width="3" height="52" fill="#2AABEE" />
    </svg>
  );
}

export function Security() {
  return (
    <section id="security" className="relative border-t border-border">
      <div className="container-ov py-24 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <Reveal>
              <span className="eyebrow">Built like a security system</span>
              <h2 className="section-title mt-4 max-w-[16ch]">
                Private by architecture, not by promise.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="lead mt-5 max-w-[34rem]">
                A security system you can&apos;t trust is a liability. Overwatch
                runs on your premises, on hardware you own, behind a network
                we design. Only the alert leaves the building, and only to the
                people you name.
              </p>
            </Reveal>
          </div>
          <Reveal delay={120} className="min-w-0">
            <div className="ticks border border-border bg-surface">
              <div className="overflow-x-auto p-4 sm:p-6">
                <div className="min-w-[560px]">
                  <Diagram />
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {guarantees.map((g, i) => (
            <Reveal key={g.title} delay={(i % 3) * 60} className="bg-bg p-7">
              <span className="mono text-[11px] text-accent">
                [{String(i + 1).padStart(2, "0")}]
              </span>
              <h3 className="mt-4 text-[16px] font-medium text-text">{g.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-text-muted">{g.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export type Scene = "gate" | "perimeter" | "driveway" | "bay" | "fire" | "house";

type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  danger?: boolean;
};

// Overlay coordinates live in a 400×225 space that matches every 16:9 feed.
const W = 400;
const H = 225;

// Graded stills in /public/feeds (see landing-site/README.md for sources).
const scenes: Record<Scene, { src: string; boxes: Box[]; roi: string; zone: string }> = {
  gate: {
    src: "/feeds/gate.jpg",
    boxes: [{ x: 262, y: 54, w: 60, h: 152, label: "person 0.94" }],
    roi: "150,150 400,140 400,225 90,225",
    zone: "ROI · GATE APPROACH",
  },
  perimeter: {
    src: "/feeds/perimeter.jpg",
    boxes: [
      { x: 186, y: 116, w: 40, h: 92, label: "person 0.92" },
      { x: 117, y: 122, w: 22, h: 56, label: "person 0.71" },
    ],
    roi: "112,135 160,128 232,225 70,225",
    zone: "ROI · PERIMETER",
  },
  driveway: {
    src: "/feeds/driveway.jpg",
    boxes: [{ x: 54, y: 110, w: 162, h: 54, label: "car 0.95" }],
    roi: "40,118 230,118 240,172 30,172",
    zone: "ROI · DRIVEWAY",
  },
  bay: {
    src: "/feeds/bay.jpg",
    boxes: [{ x: 140, y: 44, w: 258, h: 162, label: "truck 0.91" }],
    roi: "110,60 400,50 400,215 90,215",
    zone: "ROI · BAY DOORS",
  },
  fire: {
    src: "/feeds/fire.jpg",
    boxes: [
      { x: 120, y: 76, w: 124, h: 128, label: "fire 0.93", danger: true },
      { x: 238, y: 58, w: 72, h: 62, label: "smoke 0.84", danger: true },
    ],
    roi: "60,60 360,60 380,215 40,215",
    zone: "ROI · YARD",
  },
  house: {
    src: "/feeds/house.jpg",
    boxes: [],
    roi: "60,158 210,158 250,215 10,215",
    zone: "ROI · DRIVEWAY",
  },
};

const ACCENT = "#f59e0b";
const DANGER = "#ef4444";

export function CameraFeed({
  scene = "gate",
  camera = "CAM-01 · FRONT GATE",
  time = "02:14:07",
  tag = "INCIDENT",
  boxes,
  roi,
  zone,
  className = "",
}: {
  scene?: Scene;
  camera?: string;
  time?: string;
  tag?: "LIVE" | "INCIDENT" | "REC";
  boxes?: Box[];
  roi?: string;
  zone?: string;
  className?: string;
}) {
  const s = scenes[scene];
  const b = boxes ?? s.boxes;
  const roiPoly = roi ?? s.roi;
  const tagColor = tag === "INCIDENT" ? DANGER : tag === "LIVE" ? ACCENT : "rgba(255,255,255,0.8)";

  return (
    <div className={`relative overflow-hidden border border-border bg-black ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" preserveAspectRatio="xMidYMid slice">
        <image href={s.src} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid slice" />

        {/* top / bottom fades keep the HUD legible on any frame */}
        <defs>
          <linearGradient id="hud-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.55" />
            <stop offset="0.22" stopColor="#000" stopOpacity="0" />
            <stop offset="0.78" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#hud-fade)" />

        {/* monitored zone */}
        <polygon
          points={roiPoly}
          fill="rgba(245,158,11,0.06)"
          stroke={ACCENT}
          strokeWidth="0.9"
          strokeDasharray="4 3"
          strokeOpacity="0.75"
        />

        {/* detections */}
        {b.map((box, i) => {
          const c = box.danger ? DANGER : ACCENT;
          const labelW = box.label.length * 4.6 + 8;
          const ly = box.y - 11 < 2 ? box.y + 1 : box.y - 11;
          const t = Math.min(8, box.w / 3, box.h / 3);
          return (
            <g key={i}>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke={c} strokeWidth="0.8" strokeOpacity="0.55" />
              {/* corner emphasis */}
              <path
                d={`M${box.x} ${box.y + t}V${box.y}H${box.x + t} M${box.x + box.w - t} ${box.y}H${box.x + box.w}V${box.y + t} M${box.x + box.w} ${box.y + box.h - t}V${box.y + box.h}H${box.x + box.w - t} M${box.x + t} ${box.y + box.h}H${box.x}V${box.y + box.h - t}`}
                fill="none"
                stroke={c}
                strokeWidth="1.6"
              />
              <rect x={box.x} y={ly} width={labelW} height="10" fill={c} />
              <text
                x={box.x + 4}
                y={ly + 7.2}
                fontSize="7"
                fontFamily="var(--font-mono), ui-monospace, monospace"
                fontWeight="600"
                letterSpacing="0.02em"
                fill="#0a0703"
              >
                {box.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* HUD */}
      <div className="mono pointer-events-none absolute inset-0 flex flex-col justify-between p-2.5 text-[9.5px] uppercase leading-none tracking-[0.1em] text-white/85">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate">{camera}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-medium" style={{ color: tagColor }}>
            <span className="inline-block h-1.5 w-1.5 animate-blink" style={{ background: tagColor }} />
            {tag}
          </span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <span className="truncate text-white/70">{zone ?? s.zone}</span>
          <span className="shrink-0 tabular-nums">{time}</span>
        </div>
      </div>
    </div>
  );
}

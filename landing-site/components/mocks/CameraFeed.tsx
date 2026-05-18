type Scene = "gate" | "fire" | "driveway" | "perimeter";

type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  danger?: boolean;
};

const W = 400;
const H = 225;

function Person({
  x,
  y,
  s = 1,
  fill = "#05070a",
}: {
  x: number;
  y: number;
  s?: number;
  fill?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <circle cx="0" cy="0" r="6" />
      <path d="M-6 9c0-3 3-5 6-5s6 2 6 5l-1 22h-3l-2-15-2 15h-3L-6 9Z" />
      <path d="M-5 11l-5 13 2 1 5-12Z" />
      <path d="M5 11l5 13-2 1-5-12Z" />
    </g>
  );
}

function Car({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M2 22c-2 0-4-1-4-4v-7c0-2 2-4 5-6l9-6c3-2 6-3 10-3h14c5 0 9 2 13 5l8 6c4 1 7 2 9 4 2 1 3 4 3 7v3c0 2-1 4-4 4H2Z"
        fill="#0c0f15"
      />
      <path
        d="M18-3h13c4 0 7 1 10 4l6 5H14l4-9Z"
        fill="#161b22"
      />
      <circle cx="14" cy="22" r="6" fill="#05070a" />
      <circle cx="14" cy="22" r="2.4" fill="#1c2027" />
      <circle cx="56" cy="22" r="6" fill="#05070a" />
      <circle cx="56" cy="22" r="2.4" fill="#1c2027" />
      <rect x="62" y="9" width="6" height="5" rx="1.5" fill="#f5ad4a" opacity="0.85" />
    </g>
  );
}

function Fire({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="6" rx="46" ry="14" fill="#f5ad4a" opacity="0.16" />
      <ellipse cx="0" cy="6" rx="28" ry="9" fill="#ff8a3d" opacity="0.22" />
      <path
        d="M0 8c-12 0-19-9-15-21 1 5 4 8 7 9-3-9 1-19 6-24-1 8 4 11 7 17 2-4 2-8 1-12 8 6 12 16 9 24 3-2 5-5 5-9 5 12-3 27-15 27Z"
        fill="#ef4444"
      />
      <path
        d="M0 7c-7 0-12-6-9-14 1 3 3 5 5 6-2-6 1-12 5-15-1 5 2 8 4 12 1-3 1-5 1-8 5 4 7 11 5 16 1-2 3-3 3-6 3 8-3 17-9 17Z"
        fill="#f5ad4a"
      />
      <path
        d="M0 6c-3 0-6-3-4-8 1 3 3 4 4 4-1-4 1-7 3-9 0 4 2 6 2 9 0 3-2 4-5 4Z"
        fill="#ffe39a"
      />
    </g>
  );
}

function Smoke({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="#9aa1ad" opacity="0.16">
      <ellipse cx="0" cy="0" rx="20" ry="13" />
      <ellipse cx="-12" cy="-14" rx="15" ry="11" />
      <ellipse cx="10" cy="-20" rx="17" ry="13" />
      <ellipse cx="-4" cy="-34" rx="20" ry="15" />
      <ellipse cx="14" cy="-48" rx="17" ry="13" />
    </g>
  );
}

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-2" y="-2" width="4" height="22" fill="#10141a" />
      <circle cx="0" cy="-14" r="14" fill="#0d1117" />
      <circle cx="-9" cy="-6" r="10" fill="#0d1117" />
      <circle cx="9" cy="-6" r="10" fill="#0d1117" />
    </g>
  );
}

function SceneArt({ scene }: { scene: Scene }) {
  const night = scene !== "driveway";
  return (
    <>
      <defs>
        <linearGradient id={`sky-${scene}`} x1="0" y1="0" x2="0" y2="1">
          {scene === "fire" ? (
            <>
              <stop offset="0%" stopColor="#1a1208" />
              <stop offset="55%" stopColor="#2a1707" />
              <stop offset="100%" stopColor="#3a1c08" />
            </>
          ) : night ? (
            <>
              <stop offset="0%" stopColor="#0a0f17" />
              <stop offset="60%" stopColor="#0d141f" />
              <stop offset="100%" stopColor="#121a26" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#1a2230" />
              <stop offset="100%" stopColor="#27313f" />
            </>
          )}
        </linearGradient>
        <radialGradient id={`vig-${scene}`} cx="50%" cy="46%" r="72%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.62" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill={`url(#sky-${scene})`} />

      {/* ground */}
      <rect y="150" width={W} height="75" fill="#0a0e14" />
      <rect y="150" width={W} height="2" fill="#161b22" />

      {scene === "gate" && (
        <>
          <Tree x={48} y={150} s={1.5} />
          <rect x="120" y="70" width="160" height="80" fill="#10151c" />
          <polygon points="120,70 200,38 280,70" fill="#161c25" />
          <rect x="150" y="96" width="20" height="22" fill="#f5ad4a" opacity="0.5" />
          <rect x="230" y="96" width="20" height="22" fill="#1c2027" />
          <rect x="190" y="112" width="22" height="38" fill="#05070a" />
          {/* gate bars */}
          {[290, 305, 320, 335, 350, 365].map((gx) => (
            <rect key={gx} x={gx} y="104" width="4" height="46" fill="#1c2330" />
          ))}
          <rect x="288" y="100" width="84" height="5" fill="#1c2330" />
          <Person x={318} y={118} s={1.1} />
        </>
      )}

      {scene === "fire" && (
        <>
          <rect x="60" y="74" width="180" height="76" fill="#150d06" />
          <polygon points="60,74 150,42 240,74" fill="#1f1206" />
          <rect x="90" y="100" width="22" height="24" fill="#3a1c08" />
          <rect x="170" y="100" width="22" height="24" fill="#5a2a0a" />
          <Smoke x={150} y={70} />
          <Smoke x={250} y={86} />
          <Fire x={150} y={120} s={1.5} />
          <Fire x={246} y={132} s={1} />
          <Tree x={330} y={150} s={1.4} />
        </>
      )}

      {scene === "driveway" && (
        <>
          <Tree x={40} y={150} s={1.6} />
          <rect x="150" y="60" width="170" height="90" fill="#1d2531" />
          <polygon points="150,60 235,32 320,60" fill="#28323f" />
          <rect x="180" y="86" width="24" height="26" fill="#0e141c" />
          <rect x="262" y="86" width="24" height="26" fill="#0e141c" />
          <polygon points="120,225 180,150 320,150 380,225" fill="#11161e" />
          <Car x={196} y={150} s={1.25} />
          <Person x={150} y={158} s={1} />
        </>
      )}

      {scene === "perimeter" && (
        <>
          <Tree x={350} y={150} s={1.5} />
          {/* chain-link wall */}
          <rect x="0" y="58" width={W} height="92" fill="#0c1118" opacity="0.6" />
          {Array.from({ length: 21 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={i * 20}
              y1="58"
              x2={i * 20}
              y2="150"
              stroke="#222a35"
              strokeWidth="1.5"
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={62 + i * 16}
              x2={W}
              y2={62 + i * 16}
              stroke="#222a35"
              strokeWidth="1.5"
            />
          ))}
          <rect x="0" y="54" width={W} height="5" fill="#1c2330" />
          <Person x={208} y={112} s={1.15} />
        </>
      )}

      <rect width={W} height={H} fill={`url(#vig-${scene})`} />
      {/* IR-ish scanlines */}
      <rect
        width={W}
        height={H}
        fill="url(#scan)"
        opacity="0.5"
        style={{ mixBlendMode: "overlay" }}
      />
      <defs>
        <pattern
          id="scan"
          width="3"
          height="3"
          patternUnits="userSpaceOnUse"
        >
          <rect width="3" height="1.5" fill="#ffffff" opacity="0.03" />
        </pattern>
      </defs>
    </>
  );
}

export function CameraFeed({
  scene = "gate",
  camera = "CAM-01 · FRONT GATE",
  time = "02:14:07",
  tag = "INCIDENT",
  boxes,
  roi,
  className = "",
}: {
  scene?: Scene;
  camera?: string;
  time?: string;
  tag?: "LIVE" | "INCIDENT" | "REC";
  boxes?: Box[];
  roi?: string;
  className?: string;
}) {
  const defaultBoxes: Record<Scene, Box[]> = {
    gate: [{ x: 296, y: 96, w: 46, h: 78, label: "person 0.94" }],
    fire: [
      { x: 120, y: 96, w: 70, h: 64, label: "fire 0.91", danger: true },
      { x: 214, y: 70, w: 70, h: 56, label: "smoke 0.86", danger: true },
    ],
    driveway: [
      { x: 196, y: 132, w: 92, h: 56, label: "car 0.96" },
      { x: 138, y: 146, w: 30, h: 50, label: "person 0.88" },
    ],
    perimeter: [{ x: 186, y: 90, w: 46, h: 76, label: "person 0.90" }],
  };
  const b = boxes ?? defaultBoxes[scene];
  const roiPoly =
    roi ??
    (scene === "gate"
      ? "276,86 392,86 392,178 276,178"
      : scene === "perimeter"
        ? "150,70 270,70 270,176 150,176"
        : scene === "driveway"
          ? "110,140 360,140 392,210 96,210"
          : "96,80 308,80 308,176 96,176");

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-black ${className}`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <SceneArt scene={scene} />

        {/* ROI zone */}
        <polygon
          points={roiPoly}
          fill="rgba(245,173,74,0.07)"
          stroke="#f5ad4a"
          strokeWidth="1.4"
          strokeDasharray="6 4"
          opacity="0.7"
        />

        {/* detection boxes */}
        {b.map((box, i) => {
          const c = box.danger ? "#f87171" : "#f5ad4a";
          const labelW = box.label.length * 6.4 + 12;
          return (
            <g key={i}>
              <rect
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                fill="none"
                stroke={c}
                strokeWidth="2"
              />
              <rect
                x={box.x}
                y={box.y - 16}
                width={labelW}
                height="16"
                fill={c}
              />
              <text
                x={box.x + 6}
                y={box.y - 4.5}
                fontSize="10"
                fontFamily="ui-monospace, monospace"
                fontWeight="600"
                fill="#0a0c10"
              >
                {box.label}
              </text>
            </g>
          );
        })}

        {/* corner brackets */}
        {[
          [10, 10, 1, 1],
          [W - 10, 10, -1, 1],
          [10, H - 10, 1, -1],
          [W - 10, H - 10, -1, -1],
        ].map(([cx, cy, sx, sy], i) => (
          <path
            key={i}
            d={`M${cx} ${cy + sy * 16} L${cx} ${cy} L${cx + sx * 16} ${cy}`}
            stroke="#ffffff"
            strokeOpacity="0.4"
            strokeWidth="1.5"
            fill="none"
          />
        ))}
      </svg>

      {/* HUD overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2.5">
        <div className="flex items-start justify-between">
          <span className="mono rounded bg-black/55 px-1.5 py-0.5 text-[10px] tracking-[0.08em] text-white/85">
            {camera}
          </span>
          <span
            className="mono inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em]"
            style={{
              color:
                tag === "INCIDENT"
                  ? "#ff6b6b"
                  : tag === "LIVE"
                    ? "#f5ad4a"
                    : "rgba(255,255,255,0.85)",
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full animate-blink"
              style={{
                background:
                  tag === "INCIDENT"
                    ? "#ff6b6b"
                    : tag === "LIVE"
                      ? "#f5ad4a"
                      : "rgba(255,255,255,0.7)",
              }}
            />
            {tag}
          </span>
        </div>
        <div className="flex items-end justify-between">
          <span className="mono rounded bg-black/55 px-1.5 py-0.5 text-[10px] tracking-[0.08em] text-white/85">
            ROI · ZONE-A
          </span>
          <span className="mono rounded bg-black/55 px-1.5 py-0.5 text-[10px] tracking-[0.08em] text-white/85">
            {time}
          </span>
        </div>
      </div>
    </div>
  );
}

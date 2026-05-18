const items = [
  "YOLO11 real-time detection",
  "80+ object classes",
  "RTSP · ONVIF cameras",
  "WhatsApp Cloud API",
  "Telegram Bot API",
  "Bounding-box overlay clips",
  "Conversational AI agent",
  "Zone & schedule rules",
  "Runs on your hardware",
  "Docker compose up",
];

export function TrustStrip() {
  return (
    <section className="overflow-hidden border-b border-border bg-surface/40 py-5">
      <div
        className="flex w-max gap-10 animate-marquee"
        style={{ willChange: "transform" }}
      >
        {[0, 1].map((dup) => (
          <div
            key={dup}
            className="flex shrink-0 items-center gap-10"
            aria-hidden={dup === 1}
          >
            {items.map((t) => (
              <span
                key={t}
                className="mono inline-flex items-center gap-3 whitespace-nowrap text-[12px] uppercase tracking-[0.12em] text-text-dim"
              >
                <span className="inline-block h-1 w-1 rounded-full bg-accent" />
                {t}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

import { Reveal } from "./Reveal";

function WaIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" className="fill-[#25D366]">
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.5 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-1-.3-1.6-.6a9 9 0 0 1-3.7-3.3c-.3-.4-.8-1.2-.8-2.3 0-1.1.6-1.6.8-1.9.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .5.4l.7 1.7c.1.1.1.3 0 .5l-.3.4-.3.3c-.1.1-.3.3-.1.5.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4 0 .5-.1l.7-.9c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.2.5.3.1.2.1.6-.1 1.1Z" />
    </svg>
  );
}
function TgIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" className="fill-[#2AABEE]">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 6.9-1.6 7.6c-.1.5-.4.7-.9.4l-2.5-1.8-1.2 1.2c-.1.1-.3.2-.5.2l.2-2.6 4.7-4.3c.2-.2-.1-.3-.3-.1L8.9 13l-2.5-.8c-.5-.2-.5-.5.1-.8l9.4-3.6c.4-.2.8.1.7.1Z" />
    </svg>
  );
}

export function Channels() {
  return (
    <section className="container-ov py-24 lg:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow justify-center">Delivery</span>
          <h2 className="section-title mt-4">
            It reaches you where you already are.
          </h2>
          <p className="lead mx-auto mt-5 max-w-xl">
            No new app, no new inbox. Incidents arrive on the messenger you
            check anyway.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-4 md:grid-cols-2">
        {[
          {
            icon: <WaIcon />,
            name: "WhatsApp",
            ring: "border-[#25D366]/30",
            body: "Incidents land as a clip, poster and summary you can act on instantly, then ask follow-ups in the same thread.",
            chips: ["Clip + poster", "Inline acknowledge", "Ask anything"],
          },
          {
            icon: <TgIcon />,
            name: "Telegram",
            ring: "border-[#2AABEE]/30",
            body: "Fast, reliable delivery with one-tap actions and deep links straight to the moment that mattered.",
            chips: ["One-tap actions", "Deep links", "Scheduled rollups"],
          },
        ].map((c, i) => (
          <Reveal key={c.name} delay={i * 80}>
            <div className={`card h-full p-7 ${c.ring}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-elev">
                  {c.icon}
                </div>
                <h3 className="text-[1.3rem] font-medium">{c.name}</h3>
              </div>
              <p className="mt-4 text-[14.5px] leading-relaxed text-text-muted">
                {c.body}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {c.chips.map((ch) => (
                  <span
                    key={ch}
                    className="pill border-border-strong text-text-dim"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

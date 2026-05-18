import { PhoneFrame } from "./mocks/PhoneFrame";
import { WhatsAppChat, WaBubble, WaIncidentCard } from "./mocks/WhatsAppChat";
import { CameraFeed } from "./mocks/CameraFeed";
import { Reveal } from "./Reveal";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-16">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-[0.55]" />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[920px] -translate-x-1/2 rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(245,173,74,0.16), transparent 62%)",
        }}
      />

      <div className="container-ov relative grid items-center gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div>
          <Reveal>
            <span className="eyebrow">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse-mark" />
              Multi-camera AI surveillance
            </span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mt-5 text-[clamp(2.6rem,6.4vw,4.6rem)] font-medium leading-[1.02] tracking-[-0.03em]">
              Meet your new
              <br />
              <span className="text-accent">security guard.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="lead mt-6 max-w-[34rem]">
              Always watching, always ready to keep you safe. Overwatch turns
              the cameras you already have into an AI guard that spots trouble
              and messages you on WhatsApp or Telegram the moment it matters.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#get-started" className="btn-primary">
                Get started
              </a>
              <a href="#showcase" className="btn">
                See it in action
              </a>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
              {[
                "Self-hosted",
                "Footage never leaves your network",
                "No subscriptions",
              ].map((t) => (
                <span
                  key={t}
                  className="mono inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.08em] text-text-dim"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-success"
                  >
                    <path
                      d="M5 13l4 4 10-12"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={140} className="relative">
          <div className="relative mx-auto w-fit">
            <PhoneFrame>
              <WhatsAppChat subtitle="online · security bot">
                <WaBubble side="in" time="02:15" noPad>
                  <WaIncidentCard />
                </WaBubble>
                <WaBubble side="out" time="02:15" ticks>
                  On it. Sending someone to check now.
                </WaBubble>
                <WaBubble side="in" time="02:15">
                  Acknowledged. I&apos;ll keep watching and update you if it
                  escalates.
                </WaBubble>
              </WhatsAppChat>
            </PhoneFrame>

            <div className="absolute -left-24 top-24 hidden w-[230px] rotate-[-5deg] xl:block">
              <div className="rounded-xl border border-border bg-surface p-2 shadow-elev">
                <CameraFeed
                  scene="perimeter"
                  camera="CAM-03 · WEST FENCE"
                  time="02:11:55"
                  tag="LIVE"
                />
                <p className="mono mt-2 px-1 pb-1 text-[10px] uppercase tracking-[0.1em] text-text-dim">
                  4 cameras · 1 incident open
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="hairline" />
    </section>
  );
}

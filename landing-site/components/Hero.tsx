import { PhoneFrame } from "./mocks/PhoneFrame";
import { WhatsAppChat, WaBubble, WaIncidentCard } from "./mocks/WhatsAppChat";
import { Reveal } from "./Reveal";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% -8%, var(--accent-soft), transparent 70%)",
        }}
      />

      <div className="container-ov relative grid items-center gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <Reveal>
            <span className="eyebrow">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse-mark" />
              Now boarding
            </span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mt-5 text-[clamp(2.5rem,6vw,4.3rem)] font-medium leading-[1.04] tracking-[-0.03em]">
              Meet your new
              <br />
              <span className="text-accent">security guard.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="lead mt-6 max-w-[34rem]">
              Always watching, always ready. Overwatch connects to the cameras
              you already own, runs real-time AI vision on the zones that
              matter, and messages you the moment something&apos;s actually
              wrong.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#waitlist" className="btn-primary">
                Join the waitlist
              </a>
              <a href="#showcase" className="btn">
                See it in action
              </a>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
              {[
                "Real-time AI vision",
                "80+ object classes",
                "Alerts in seconds",
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
          <div
            className="pointer-events-none absolute inset-0 -z-10 mx-auto my-auto h-[440px] w-[440px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, var(--accent-soft), transparent 65%)",
            }}
          />
          <PhoneFrame>
            <WhatsAppChat subtitle="online · security bot">
              <WaBubble side="in" time="02:15" noPad>
                <WaIncidentCard />
              </WaBubble>
              <WaBubble side="out" time="02:15" ticks>
                On it — sending someone to check now.
              </WaBubble>
              <WaBubble side="in" time="02:16">
                Acknowledged. Still in frame. I&apos;ll message you if it
                escalates.
              </WaBubble>
            </WhatsAppChat>
          </PhoneFrame>
        </Reveal>
      </div>

      <div className="hairline" />
    </section>
  );
}

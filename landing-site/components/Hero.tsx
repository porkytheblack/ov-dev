import { Console } from "./mocks/Console";
import { PhoneFrame } from "./mocks/PhoneFrame";
import { WhatsAppChat, WaBubble, WaIncidentCard } from "./mocks/WhatsAppChat";
import { Reveal } from "./Reveal";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-16">
      <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_40%,transparent_100%)]" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px]"
        style={{
          background:
            "radial-gradient(ellipse 50% 45% at 50% 0%, rgba(245,158,11,0.10), transparent 70%)",
        }}
      />

      <div className="container-ov relative pb-14 pt-20 text-center lg:pt-28">
        <Reveal>
          <span className="eyebrow flex-wrap justify-center text-center !tracking-[0.12em] sm:!tracking-[0.18em]">
            <span className="hidden h-1.5 w-1.5 bg-accent animate-pulse-mark sm:inline-block" />
            Installation · Provisioning · Smart monitoring
          </span>
        </Reveal>

        <Reveal delay={60}>
          <h1 className="mx-auto mt-6 max-w-[15ch] text-[clamp(2.6rem,7vw,5.4rem)] font-medium leading-[0.98] tracking-[-0.04em]">
            Security that <span className="text-accent">thinks</span>, installed
            end to end.
          </h1>
        </Reveal>

        <Reveal delay={120}>
          <p className="lead mx-auto mt-7 max-w-[40rem]">
            We survey your site, install the cameras and our control software
            on hardware you own, and wire every alert into WhatsApp and
            Telegram. You get a system that watches every zone, reasons about
            what it sees, and reports only when it matters.
          </p>
        </Reveal>

        <Reveal delay={180}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a href="#contact" className="btn-primary">
              Book a site survey
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" />
              </svg>
            </a>
            <a href="#scenarios" className="btn">
              See what&apos;s possible
            </a>
          </div>
        </Reveal>

        <Reveal delay={240}>
          <ul className="mono mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[12px] uppercase tracking-[0.1em] text-text-dim">
            {[
              "Recordings stay on-site",
              "Works with existing cameras",
              "Commissioned & tuned for you",
            ].map((t) => (
              <li key={t} className="inline-flex items-center gap-2">
                <span className="inline-block h-px w-3 bg-accent" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <div className="container-ov relative pb-24 lg:pb-36">
        <Reveal delay={300}>
          <div className="relative mx-auto max-w-[1080px] lg:pr-[120px]">
            <Console />
            <div className="pointer-events-none absolute -bottom-24 -right-2 hidden origin-bottom-right scale-[0.74] lg:block">
              <PhoneFrame>
                <WhatsAppChat subtitle="online · security">
                  <WaBubble side="in" time="02:14" noPad>
                    <WaIncidentCard />
                  </WaBubble>
                  <WaBubble side="out" time="02:14" ticks>
                    Who is that?
                  </WaBubble>
                  <WaBubble side="in" time="02:14">
                    One adult, no vehicle. Arrived on foot from the road at
                    02:13 and has stayed at the gate for 64s.
                  </WaBubble>
                </WhatsAppChat>
              </PhoneFrame>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

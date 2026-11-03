import { Reveal } from "./Reveal";

const faqs = [
  {
    q: "Do I need to replace my existing cameras?",
    a: "Usually not. Overwatch works with any IP camera or NVR that can output an RTSP stream, which covers most systems installed in the last decade. During the survey we test every camera you have. We reuse what works and only recommend replacements where coverage, resolution or night performance falls short.",
  },
  {
    q: "Does my footage leave the property?",
    a: "No. Recording, detection and storage all happen on the server we install on-site. When an incident fires, only the alert leaves the building: a short clip, a poster frame and a signed, expiring playback link, sent to the people you name.",
  },
  {
    q: "What happens if the internet or power goes down?",
    a: "Without internet, detection, recording and the local console keep running; only messenger alerts pause. For power, we specify a UPS sized for your server and network gear, and can add backup power for cameras when the site needs it.",
  },
  {
    q: "WhatsApp or Telegram — which should I choose?",
    a: "Many clients use both. WhatsApp suits owners and managers who want alerts where they already chat. Telegram suits guard teams, with group alerting, one-tap acknowledgement and briefings. We can route different zones and severities to different people on each.",
  },
  {
    q: "How do you stop false alarms?",
    a: "Three things: object detection instead of motion detection, so trees and shadows are ignored; zone rules with linger thresholds and schedules; and a 14-day tuning period where we review every alert with you and adjust until the noise is gone.",
  },
  {
    q: "Who owns the system once it's installed?",
    a: "You do. The hardware is yours, the footage is yours, and the system keeps running whether or not you take managed care. Managed care is optional and covers health monitoring, updates, re-tuning and support.",
  },
  {
    q: "How long does an installation take?",
    a: "Most residential and commercial sites are live within two weeks of sign-off, followed by the 14-day tuning period. Multi-site and estate projects are scheduled in phases. Your design pack includes a timeline.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="relative border-t border-border">
      <div className="container-ov grid gap-12 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:py-32">
        <Reveal>
          <span className="eyebrow">Questions</span>
          <h2 className="section-title mt-4 max-w-[12ch]">Before you book.</h2>
          <p className="lead mt-5 max-w-sm">
            Anything not covered here, we&apos;ll answer on the survey call.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <div className="border-t border-border">
            {faqs.map((f) => (
              <details key={f.q} className="group border-b border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] text-text [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="relative h-3 w-3 shrink-0 text-accent">
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
                    <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform duration-200 group-open:scale-y-0" />
                  </span>
                </summary>
                <p className="max-w-[44rem] pb-6 text-[14.5px] leading-relaxed text-text-muted">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

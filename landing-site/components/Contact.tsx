"use client";

import { useState } from "react";
import { Reveal } from "./Reveal";

const CONTACT_EMAIL = "hello@dterminal.net";

type State = "idle" | "invalid" | "loading" | "done" | "error";

const services = [
  "Control software",
  "WhatsApp integration",
  "Telegram integration",
  "Camera installation",
  "Managed care",
];

const field =
  "h-12 w-full border border-border-strong bg-bg px-4 text-[14.5px] text-text placeholder:text-text-dim transition-colors duration-150 focus:border-accent focus:outline-none";
const label = "index mb-2 block";

export function Contact() {
  const [state, setState] = useState<State>("idle");
  const [picked, setPicked] = useState<string[]>(["Control software", "WhatsApp integration"]);

  function toggle(s: string) {
    setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: String(fd.get("name") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      property: String(fd.get("property") ?? ""),
      cameras: String(fd.get("cameras") ?? ""),
      location: String(fd.get("location") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
      services: picked,
    };
    if (!data.name || (!data.phone && !data.email)) {
      setState("invalid");
      return;
    }

    const endpoint = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
    if (!endpoint) {
      // No backend configured: hand the enquiry to the visitor's mail client.
      const body = [
        `Name: ${data.name}`,
        `Phone / WhatsApp: ${data.phone || "—"}`,
        `Email: ${data.email || "—"}`,
        `Property: ${data.property}`,
        `Cameras: ${data.cameras}`,
        `Location: ${data.location || "—"}`,
        `Interested in: ${data.services.join(", ") || "—"}`,
        "",
        data.message,
      ].join("\n");
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
        `Site survey request — ${data.name}`,
      )}&body=${encodeURIComponent(body)}`;
      setState("done");
      return;
    }

    setState("loading");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("request failed");
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <section id="contact" className="relative overflow-hidden border-t border-border">
      <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_70%_at_20%_40%,#000_30%,transparent_100%)]" />
      <div className="container-ov relative grid gap-14 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:py-32">
        <div>
          <Reveal>
            <span className="eyebrow">
              <span className="inline-block h-1.5 w-1.5 bg-accent animate-pulse-mark" />
              Book a site survey
            </span>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="mt-5 text-[clamp(2.2rem,5vw,3.6rem)] font-medium leading-[1.02] tracking-[-0.03em]">
              Let&apos;s walk your site.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="lead mt-6 max-w-md">
              Tell us about your property. An engineer will call you within
              one business day to schedule a survey and send a written design
              and fixed quote afterwards.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <dl className="mt-12 grid max-w-md grid-cols-2 gap-px border border-border bg-border">
              {[
                ["Survey", "On-site walkthrough"],
                ["Design pack", "Written, fixed quote"],
                ["Go-live", "~2 weeks from sign-off"],
                ["Tuning", "14 days, included"],
              ].map(([k, v]) => (
                <div key={k} className="bg-bg px-5 py-4">
                  <dt className="index">{k}</dt>
                  <dd className="mt-1 text-[14px] text-text">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={220}>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mono mt-8 inline-flex items-center gap-2 text-[13px] text-text-muted transition-colors hover:text-accent"
            >
              <span className="text-accent">→</span> {CONTACT_EMAIL}
            </a>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <div className="ticks border border-border-strong bg-surface p-6 sm:p-8">
            {state === "done" ? (
              <div className="flex min-h-[440px] flex-col items-start justify-center">
                <span className="mono text-[12px] uppercase tracking-[0.14em] text-success">
                  ● Request received
                </span>
                <h3 className="mt-4 text-[26px] font-medium tracking-[-0.02em]">
                  We&apos;ll be in touch within one business day.
                </h3>
                <p className="mt-3 max-w-md text-[15px] text-text-muted">
                  If your mail app opened, send the prefilled message to
                  complete the request. You can also reach us directly at{" "}
                  <a className="text-accent" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </a>
                  .
                </p>
                <button type="button" onClick={() => setState("idle")} className="btn mt-8">
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="name" className={label}>Full name</label>
                  <input id="name" name="name" autoComplete="name" required className={field} placeholder="Your name" />
                </div>
                <div>
                  <label htmlFor="phone" className={label}>Phone / WhatsApp</label>
                  <input id="phone" name="phone" type="tel" autoComplete="tel" className={field} placeholder="With country code" />
                </div>
                <div>
                  <label htmlFor="email" className={label}>Email</label>
                  <input id="email" name="email" type="email" autoComplete="email" className={field} placeholder="you@company.com" />
                </div>
                <div>
                  <label htmlFor="property" className={label}>Property type</label>
                  <select id="property" name="property" className={`${field} select-chev appearance-none pr-10`} defaultValue="Private residence">
                    <option>Private residence</option>
                    <option>Gated estate / compound</option>
                    <option>Office</option>
                    <option>Warehouse / yard</option>
                    <option>Retail / hospitality</option>
                    <option>Construction site</option>
                    <option>Farm / remote site</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cameras" className={label}>Cameras (approx.)</label>
                  <select id="cameras" name="cameras" className={`${field} select-chev appearance-none pr-10`} defaultValue="None yet">
                    <option>None yet</option>
                    <option>1 – 8</option>
                    <option>8 – 16</option>
                    <option>16 – 32</option>
                    <option>32+</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="location" className={label}>Site location</label>
                  <input id="location" name="location" className={field} placeholder="Area, city" />
                </div>
                <fieldset className="sm:col-span-2">
                  <legend className={label}>Interested in</legend>
                  <div className="flex flex-wrap gap-2">
                    {services.map((s) => {
                      const on = picked.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(s)}
                          className={`mono h-9 border px-3 text-[12px] uppercase tracking-[0.06em] transition-colors duration-150 ${
                            on
                              ? "border-accent bg-[color:var(--accent-soft)] text-accent"
                              : "border-border-strong text-text-muted hover:text-text"
                          }`}
                        >
                          {on ? "✓ " : "+ "}
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="sm:col-span-2">
                  <label htmlFor="message" className={label}>Anything we should know?</label>
                  <textarea
                    id="message"
                    name="message"
                    rows={3}
                    className={`${field} h-auto resize-none py-3`}
                    placeholder="Entry points, past incidents, existing system…"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    role="status"
                    className={`text-[13px] ${state === "invalid" || state === "error" ? "text-danger" : "text-text-dim"}`}
                  >
                    {state === "invalid"
                      ? "Add your name and a phone number or email."
                      : state === "error"
                        ? `Couldn't send. Email us at ${CONTACT_EMAIL}.`
                        : "We never share your details."}
                  </p>
                  <button type="submit" disabled={state === "loading"} className="btn-primary">
                    {state === "loading" ? "Sending…" : "Request survey"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

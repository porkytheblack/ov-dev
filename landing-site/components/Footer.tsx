import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-ov flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <Wordmark size={22} />
          <p className="mt-4 text-[14px] leading-relaxed text-text-muted">
            Installed, provisioned and tuned AI security: on-site control
            software, WhatsApp and Telegram alerting, and smart monitoring
            that reports only when it matters.
          </p>
          <p className="mono mt-4 text-[12px] uppercase tracking-[0.12em] text-text-dim">
            Always watching, always ready.
          </p>
          <a
            href="mailto:hello@dterminal.net"
            className="mono mt-3 inline-block text-[13px] text-text-muted transition-colors duration-150 hover:text-text"
          >
            hello@dterminal.net
          </a>
        </div>

        <div className="grid grid-cols-2 gap-x-14 gap-y-2 sm:grid-cols-3">
          {[
            {
              h: "Services",
              links: [
                ["Control software", "/#services"],
                ["WhatsApp & Telegram", "/#services"],
                ["Scenarios", "/#scenarios"],
                ["Capabilities", "/#capabilities"],
              ],
            },
            {
              h: "Company",
              links: [
                ["Process", "/#process"],
                ["Security", "/#security"],
                ["Engagements", "/#engagements"],
                ["Book a site survey", "/#contact"],
              ],
            },
            {
              h: "Legal",
              links: [
                ["Terms of Service", "/terms"],
                ["Privacy Policy", "/privacy-policy"],
                ["Data Processing Agreement", "/dpa"],
              ],
            },
          ].map((col) => (
            <div key={col.h}>
              <p className="mono text-[11px] uppercase tracking-[0.12em] text-text-dim">
                {col.h}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-[14px] text-text-muted transition-colors duration-150 hover:text-text"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-ov flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="mono text-[12px] text-text-dim">
            © {new Date().getFullYear()} Cradle Labs Limited
          </p>
          <p className="mono text-[12px] text-text-dim">
            Overwatch is a product of Cradle Labs Limited
          </p>
        </div>
      </div>
    </footer>
  );
}

import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-elev/50">
      <div className="container-ov flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <Wordmark size={22} />
          <p className="mt-4 text-[14px] leading-relaxed text-text-muted">
            Overwatch is multi-camera AI surveillance that watches the zones
            that matter and messages you the moment something&apos;s wrong.
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
              h: "Product",
              links: [
                ["How it works", "/#how"],
                ["Showcase", "/#showcase"],
                ["Features", "/#features"],
              ],
            },
            {
              h: "Company",
              links: [
                ["Trust", "/#trust"],
                ["Join the waitlist", "/#waitlist"],
              ],
            },
            {
              h: "Legal",
              links: [
                ["Terms of Service", "/terms"],
                ["Privacy Policy", "/privacy-policy"],
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

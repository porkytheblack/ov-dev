import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container-ov flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <Wordmark size={22} />
          <p className="mt-4 text-[14px] leading-relaxed text-text-muted">
            Multi-camera AI surveillance for self-hosted compounds. Your new
            security guard — always watching, always ready to keep you safe.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-14 gap-y-2 sm:grid-cols-3">
          {[
            {
              h: "Product",
              links: [
                ["How it works", "#how"],
                ["In action", "#showcase"],
                ["Features", "#features"],
              ],
            },
            {
              h: "Deploy",
              links: [
                ["Self-hosted", "#privacy"],
                ["Get started", "#get-started"],
                ["Docs", "#get-started"],
              ],
            },
            {
              h: "Channels",
              links: [
                ["WhatsApp", "#showcase"],
                ["Telegram", "#showcase"],
                ["AI agent", "#showcase"],
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
            © {new Date().getFullYear()} Overwatch · Self-hosted security
          </p>
          <p className="mono text-[12px] text-text-dim">
            Status before sentiment.
          </p>
        </div>
      </div>
    </footer>
  );
}

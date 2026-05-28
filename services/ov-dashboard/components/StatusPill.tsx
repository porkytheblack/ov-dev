// Accepts `undefined`/`null` so a partially-loaded camera or incident
// row doesn't crash the page with `t.toUpperCase()` — which is what hit
// the operator's Telegram in-app browser when the API returned a non-
// session response and `camera.status` came back undefined.
export function StatusPill({
  status,
}: {
  status?: string | null | undefined;
}) {
  const normalized = typeof status === "string" && status.length > 0 ? status : "unknown";
  const { cls, dot } = (() => {
    switch (normalized) {
      case "open":
        return { cls: "pill pill-open", dot: false };
      case "closed":
        return { cls: "pill pill-closed", dot: false };
      case "acknowledged":
        return { cls: "pill pill-ack", dot: false };
      case "suppressed":
        return { cls: "pill pill-suppressed", dot: false };
      case "online":
      case "live":
        return { cls: "pill pill-live", dot: true };
      case "offline":
        return { cls: "pill pill-offline", dot: true };
      case "connecting":
        return { cls: "pill pill-connecting", dot: true };
      default:
        return { cls: "pill pill-closed", dot: false };
    }
  })();
  return (
    <span className={cls}>
      {dot && (
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
        />
      )}
      {normalized.toUpperCase()}
    </span>
  );
}

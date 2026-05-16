export function StatusPill({ status }: { status: string }) {
  const { cls, dot } = (() => {
    switch (status) {
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
      {status.toUpperCase()}
    </span>
  );
}

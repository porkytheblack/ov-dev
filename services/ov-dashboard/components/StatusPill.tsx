export function StatusPill({ status }: { status: string }) {
  const cls = (() => {
    switch (status) {
      case "open":
        return "pill pill-open";
      case "closed":
        return "pill pill-closed";
      case "acknowledged":
        return "pill pill-ack";
      case "suppressed":
        return "pill pill-suppressed";
      case "online":
      case "live":
        return "pill pill-live";
      case "offline":
        return "pill pill-offline";
      case "connecting":
        return "pill pill-connecting";
      default:
        return "pill pill-closed";
    }
  })();
  return <span className={cls}>{status.toUpperCase()}</span>;
}

export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4.5c4.3 0 8 2.7 9.6 7.5C20 16.8 16.3 19.5 12 19.5S4 16.8 2.4 12C4 7.2 7.7 4.5 12 4.5Z"
        stroke="var(--accent)"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3.4" fill="var(--accent)" />
      <circle cx="12" cy="12" r="1.2" fill="var(--bg)" />
    </svg>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} />
      <span
        className="mono font-medium uppercase text-text"
        style={{ letterSpacing: "0.14em", fontSize: size * 0.62 }}
      >
        Overwatch
      </span>
      <span
        className="inline-block bg-accent animate-pulse-mark"
        style={{ width: 6, height: 6 }}
        aria-hidden="true"
      />
    </span>
  );
}

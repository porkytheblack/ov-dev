"use client";

/**
 * App-wide error boundary. Catches anything unhandled in any route that
 * doesn't have its own error.tsx, so the user never sees the framework's
 * generic "Application error: a client-side exception has occurred"
 * page (which is what Telegram's in-app webview lands on when the
 * dashboard hits an unhandled error during hydration / client rendering).
 */
import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("[root error]", error);
    }
  }, [error]);
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-center">
      <h1 className="text-[18px] font-semibold mb-2">
        Something went wrong
      </h1>
      <p className="text-text-muted text-[13px] mb-6">
        The page hit an unexpected error while loading. If you opened this
        from a Telegram or WhatsApp link, in-app browsers often restrict
        features the dashboard needs — try opening it in your main browser.
      </p>
      <div className="flex justify-center gap-2">
        <button onClick={reset} className="btn">
          Retry
        </button>
        <Link href="/" className="btn-primary">
          Back to dashboard
        </Link>
      </div>
      {error?.message && (
        <pre className="mono text-[11px] text-text-dim mt-6 whitespace-pre-wrap break-words text-left max-h-32 overflow-auto opacity-70">
          {error.message}
        </pre>
      )}
    </main>
  );
}

"use client";

/**
 * Next.js route-level error boundary for /cameras/[id]. Without this,
 * any uncaught throw during render or async work in this route produces
 * the generic Next.js production "Application error: a client-side
 * exception has occurred" page — which is what Telegram's in-app
 * webview shows when it can't satisfy WebRTC / MSE / canvas APIs the
 * `<LiveViewer />` reaches for.
 *
 * This file is paired with the per-subtree <ErrorBoundary> inside the
 * page; that one catches sync render throws in LiveViewer specifically,
 * while THIS file is the route-wide net that catches absolutely
 * everything else (incident-feed throws, async errors React surfaces
 * via componentDidCatch, etc.). The end result is the operator always
 * gets a usable page, never the framework's white-on-black crash card.
 */
import Link from "next/link";
import { useEffect } from "react";

export default function CameraRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("[cameras/[id] route error]", error);
    }
  }, [error]);
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-center">
      <h1 className="text-[18px] font-semibold mb-2">
        Live view unavailable
      </h1>
      <p className="text-text-muted text-[13px] mb-6">
        Something went wrong rendering this camera. The live stream often
        won&apos;t start inside in-app browsers (Telegram, WhatsApp) because
        they restrict WebRTC and Media Source. Try opening the dashboard in
        your main browser.
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

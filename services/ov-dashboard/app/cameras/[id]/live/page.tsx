"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LiveViewer } from "@/components/LiveViewer";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/**
 * Token-gated, no-nav live-view target for messenger deep links.
 *
 * The signed HMAC token is the credential — there's no dashboard session
 * cookie in Telegram/WhatsApp's in-app webview. ov-api's
 * /api/cameras/:id/live?token=… validates the token and returns the
 * camera's display info; the WHEP/HLS stream and the snapshot endpoint
 * are already public, so the LiveViewer works without further auth.
 *
 * Mirrors /incidents/[id]/playback — same template, same trust model.
 */
export default function LiveWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LivePage />
    </Suspense>
  );
}

function LivePage() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const [camera, setCamera] = useState<{ id: string; name: string; status: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErr("No access token provided.");
      return;
    }
    fetch(`/api/cameras/${params.id}/live?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: r.statusText }));
          throw new Error(body.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((j) => setCamera(j.camera ?? null))
      .catch((e) => setErr((e as Error).message));
  }, [params.id, token]);

  if (err) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div
          className="card max-w-sm w-full text-center"
          style={{ borderColor: "var(--danger)" }}
        >
          <p className="text-danger font-medium mb-1">Access denied</p>
          <p className="text-text-muted text-[13px]">{err}</p>
          <p className="text-text-dim text-[12px] mt-3">
            This link may have expired or is invalid. Ask the operator to send a fresh one.
          </p>
        </div>
      </main>
    );
  }

  if (!camera) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-3xl space-y-3">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton aspect-video w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="max-w-3xl mx-auto p-4 pt-8">
        <div className="mb-5 flex items-center gap-2">
          <span className="mono uppercase tracking-[0.12em] text-accent font-semibold text-[13px]">
            Overwatch
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "var(--accent)",
            }}
          />
        </div>

        <h1 className="text-[18px] font-semibold mb-4">{camera.name}</h1>

        <div className="card p-0 overflow-hidden">
          <ErrorBoundary
            fallback={(error, reset) => (
              <div className="aspect-video bg-black grid place-items-center text-center px-4">
                <div>
                  <div className="mono text-[11px] uppercase tracking-wider text-text-dim mb-2">
                    Live view unavailable
                  </div>
                  <div className="text-text-muted text-[13px] mb-3 max-w-sm">
                    {error.message ||
                      "Couldn't start the live stream in this browser. Try opening this link in your main browser."}
                  </div>
                  <button onClick={reset} className="btn">
                    Retry
                  </button>
                </div>
              </div>
            )}
          >
            <LiveViewer cameraId={camera.id} />
          </ErrorBoundary>
        </div>

        <p className="text-text-dim text-[11px] mt-3">
          In-app browsers (Telegram, WhatsApp) often restrict WebRTC and
          Media Source — if the live stream doesn&apos;t play, you&apos;ll
          see a periodic snapshot instead. For the full live view, open
          this link in your main browser.
        </p>
      </div>
    </main>
  );
}

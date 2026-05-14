"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

/**
 * Token-gated, no-nav playback target for messenger deep links.
 * No authentication required — the signed token is the credential.
 */
export default function PlaybackWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PlaybackPage />
    </Suspense>
  );
}

function PlaybackPage() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErr("token missing");
      return;
    }
    fetch(`/api/incidents/${params.id}/playback?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr((e as Error).message));
  }, [params.id, token]);

  if (err) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card mono text-[12px] text-danger">Access denied: {err}</div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="skeleton w-96 h-48" />
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="max-w-3xl mx-auto p-4">
        <div className="mb-2 mono uppercase tracking-[0.08em] flex items-center gap-2">
          <span>OVERWATCH</span>
          <span style={{ width: 6, height: 6, backgroundColor: "var(--accent)" }} />
        </div>
        <h1 className="text-[16px] mb-3">{data.incident?.camera_name}</h1>
        {data.stream_url ? (
          <video controls poster={data.poster_url ?? undefined} src={data.stream_url} className="w-full bg-black" />
        ) : (
          <div className="card text-text-muted">Clip not ready yet.</div>
        )}
        <div className="mt-3 mono text-[12px] text-text-dim">
          {data.incident?.classes?.join(", ")} · {data.incident?.opened_at}
        </div>
        <div className="mt-3 text-text-muted leading-relaxed">{data.incident?.summary ?? ""}</div>
      </div>
    </main>
  );
}

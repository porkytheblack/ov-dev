"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { IncidentActions } from "@/components/IncidentActions";
import { footageSrc, FOOTAGE_SEEK } from "@/components/ClipModal";
import { formatTimeWithZone } from "@/lib/format";

type Analysis = {
  summary_status: string;
  summary: string | null;
  run: { id: string; status: string } | null;
  triggered_at: string | null;
};

export default function IncidentDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [incident, setIncident] = useState<any>(null);
  const [vidFailed, setVidFailed] = useState(false);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/incidents/${id}`).then((r) => r.json()).then(setIncident);
  }, [id]);

  const loadAnalysis = useCallback(async () => {
    const r = await fetch(`/api/incidents/${id}/analysis`);
    if (!r.ok) return;
    const a: Analysis = await r.json();
    setAnalysis(a);
    const done =
      a.summary_status === "ready" ||
      a.summary_status === "failed" ||
      a.run?.status === "completed" ||
      a.run?.status === "failed";
    if (done && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return a;
  }, [id]);

  // Initial analysis state once the incident is loaded.
  useEffect(() => {
    if (incident) void loadAnalysis();
  }, [incident, loadAnalysis]);

  // Lazy polling while a Station job is in flight.
  useEffect(() => {
    const pending =
      analysis?.summary_status === "pending" ||
      analysis?.run?.status === "pending" ||
      analysis?.run?.status === "running";
    if (pending && !pollRef.current) {
      pollRef.current = setInterval(() => void loadAnalysis(), 4000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [analysis, loadAnalysis]);

  async function analyze() {
    setAnalyzeBusy(true);
    setAnalyzeError(null);
    try {
      const r = await fetch(`/api/incidents/${id}/analyze`, { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAnalyzeError(body.message ?? body.error ?? `Failed (${r.status})`);
        return;
      }
      // Optimistic: mark pending, then let polling take over.
      setAnalysis({
        summary_status: "pending",
        summary: analysis?.summary ?? null,
        run: { id: body.broadcast_run_id, status: body.status ?? "pending" },
        triggered_at: new Date().toISOString(),
      });
    } catch (e) {
      setAnalyzeError((e as Error).message);
    } finally {
      setAnalyzeBusy(false);
    }
  }


  if (!incident) {
    return (
      <>
        <Nav />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="skeleton h-5 w-32 mb-6" />
          <div className="skeleton h-8 w-64 mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 skeleton aspect-video" />
            <div className="skeleton h-64" />
          </div>
        </main>
      </>
    );
  }

  const clip = (incident.clips ?? [])[0];
  const posterKey: string | null =
    incident.clip_poster_key ?? clip?.poster_key ?? null;

  const effectiveSummary = analysis?.summary ?? incident.summary ?? null;
  const status = analysis?.summary_status ?? incident.summary_status ?? "none";
  const inFlight =
    status === "pending" ||
    analysis?.run?.status === "pending" ||
    analysis?.run?.status === "running";

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="mb-4">
          <Link href="/incidents" className="text-text-dim text-[13px] hover:text-text transition-colors">
            ← All incidents
          </Link>
        </div>

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[22px] font-semibold">{incident.camera_name}</h1>
            <StatusPill status={incident.status} />
          </div>
          <IncidentActions
            incidentId={id}
            status={incident.status}
            onChanged={(s) => setIncident((p: any) => ({ ...p, status: s }))}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Video clip */}
          <div className="lg:col-span-2 card p-0 overflow-hidden">
            {!vidFailed ? (
              <video
                controls
                autoPlay
                muted
                playsInline
                src={footageSrc(incident.id)}
                poster={
                  posterKey
                    ? `/api/clips/by-key/${encodeURIComponent(posterKey)}`
                    : undefined
                }
                onError={() => setVidFailed(true)}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (
                    Number.isFinite(v.duration) &&
                    FOOTAGE_SEEK < v.duration - 0.5 &&
                    Math.abs(v.currentTime - FOOTAGE_SEEK) > 1
                  ) {
                    try {
                      v.currentTime = FOOTAGE_SEEK;
                    } catch {
                      /* ignore */
                    }
                  }
                }}
                className="w-full block bg-black"
              />
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center gap-2 text-text-muted">
                <p>No footage for this moment.</p>
                <p className="text-[13px] text-text-dim">
                  The recording that covers this incident isn’t available.
                </p>
              </div>
            )}
          </div>

          {/* Incident details */}
          <aside className="card space-y-4">
            <h2 className="label">Incident details</h2>

            <div className="field">
              <dt className="label">Opened</dt>
              <dd className="mono text-[12px]">{formatTimeWithZone(incident.opened_at)}</dd>
            </div>

            {incident.closed_at && (
              <div className="field">
                <dt className="label">Closed</dt>
                <dd className="mono text-[12px]">{formatTimeWithZone(incident.closed_at)}</dd>
              </div>
            )}

            {incident.roi_name && (
              <div className="field">
                <dt className="label">Detection zone</dt>
                <dd className="text-[13px]">{incident.roi_name}</dd>
              </div>
            )}

            <div className="field">
              <dt className="label">Detected objects</dt>
              <dd className="mono text-[12px]">
                {(incident.classes ?? []).length > 0
                  ? (incident.classes ?? []).join(", ")
                  : <span className="text-text-dim">None recorded</span>}
              </dd>
            </div>

            {incident.track_id && (
              <div className="field">
                <dt className="label">Track ID</dt>
                <dd className="mono text-[12px] text-text-muted">{incident.track_id}</dd>
              </div>
            )}

            {/* AI video analysis (Station job) */}
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <dt className="label mb-0">AI video analysis</dt>
                <button
                  onClick={analyze}
                  disabled={analyzeBusy || inFlight}
                  className="btn-primary text-[12px] px-2.5 py-1 shrink-0 disabled:opacity-50"
                >
                  {analyzeBusy
                    ? "Starting…"
                    : inFlight
                      ? "Analyzing…"
                      : effectiveSummary
                        ? "Re-analyze video"
                        : "Analyze video"}
                </button>
              </div>

              {inFlight && (
                <p className="text-[12px] text-text-dim">
                  Station job running{analysis?.run?.status ? ` · ${analysis.run.status}` : ""} —
                  this updates automatically.
                </p>
              )}

              {status === "failed" && !inFlight && (
                <p className="text-[12px] text-danger">
                  Analysis failed. Try again or check ov-station logs.
                </p>
              )}

              {analyzeError && (
                <p className="text-[12px] text-danger">{analyzeError}</p>
              )}

              {effectiveSummary ? (
                <dd className="text-[13px] text-text-muted leading-relaxed">
                  {effectiveSummary}
                </dd>
              ) : (
                !inFlight &&
                status !== "failed" && (
                  <p className="text-[12px] text-text-dim">
                    No summary yet. Run analysis to have the MiMo vision model
                    describe this incident clip.
                  </p>
                )
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

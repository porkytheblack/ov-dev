"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Stepper } from "@/components/setup/Stepper";
import {
  StepConnection,
  type ConnectionForm,
} from "@/components/setup/StepConnection";
import { StepRegions } from "@/components/setup/StepRegions";
import { StepReview } from "@/components/setup/StepReview";
import {
  DEFAULT_CLASSES,
  STEPS,
  type Camera,
  type Roi,
  type Step,
} from "@/components/setup/shared";

type TestResult =
  | {
      ok: true;
      info?: {
        codec?: string;
        width?: number;
        height?: number;
        fps?: number;
        format?: string;
      };
    }
  | { ok: false; error: string }
  | null;

const DISCARD_MSG = "Discard unsaved changes?";

function parseStep(v: string | null): Step | null {
  return v && (STEPS as string[]).includes(v) ? (v as Step) : null;
}

export default function SetupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;

  // ── Core shell state ───────────────────────────────────────────────────
  const [camera, setCamera] = useState<Camera | null>(null);
  const [rois, setRois] = useState<Roi[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Mode is locked at first load from the ROI count so the flow doesn't flip
  // strict/free under the user after they save their first zone.
  const [mode, setMode] = useState<"setup" | "edit" | null>(null);

  const [step, setStep] = useState<Step>("connection");
  const [selectedRoiId, setSelectedRoiId] = useState<string | null>(null);
  const [roiFormDirty, setRoiFormDirty] = useState(false);

  // Camera form.
  const [form, setFormState] = useState<ConnectionForm>({
    name: "",
    rtsp: "",
    description: "",
    fps: 25,
    vlm: false,
  });
  const [camSaving, setCamSaving] = useState(false);
  const [camSavedAt, setCamSavedAt] = useState<number | null>(null);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [deleting, setDeleting] = useState(false);

  const hydrateCamera = useCallback((c: Camera) => {
    setCamera(c);
    setFormState({
      name: c?.name ?? "",
      rtsp: c?.rtsp_url ?? "",
      description: (c?.description as string) ?? "",
      fps: Number(c?.sample_fps ?? 25),
      vlm: Boolean(c?.vlm_enabled),
    });
  }, []);

  const setForm = useCallback((patch: Partial<ConnectionForm>) => {
    setFormState((cur) => ({ ...cur, ...patch }));
  }, []);

  const camDirty =
    camera !== null &&
    ((camera.name ?? "") !== form.name ||
      (camera.rtsp_url ?? "") !== form.rtsp ||
      ((camera.description as string) ?? "") !== form.description ||
      Number(camera.sample_fps) !== form.fps ||
      Boolean(camera.vlm_enabled) !== form.vlm);

  const anyDirty = camDirty || roiFormDirty;

  // ── Initial load: camera + ROIs, then lock mode + default step ────────
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/cameras/${id}`).then((r) => r.json()),
      fetch(`/api/cameras/${id}/rois`).then((r) => r.json()),
    ])
      .then(([cam, roiJson]) => {
        if (!alive) return;
        if (cam && !cam.error) hydrateCamera(cam as Camera);
        const list: Roi[] = roiJson?.rois ?? [];
        setRois(list);
        const m: "setup" | "edit" = list.length === 0 ? "setup" : "edit";
        setMode(m);
        // Resolve the initial step: explicit ?step wins (clamped per mode),
        // else setup→connection, edit→regions.
        const urlStep = parseStep(searchParams.get("step"));
        let initial: Step =
          urlStep ?? (m === "setup" ? "connection" : "regions");
        if (m === "setup" && initial !== "connection") {
          // Strict mode can't deep-link past step 1 with 0 ROIs.
          initial = "connection";
        }
        setStep(initial);
        const urlRoi = searchParams.get("roi");
        if (urlRoi && list.some((r) => r.id === urlRoi)) {
          setSelectedRoiId(urlRoi);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    // Detector class list with a COCO fallback so a misconfigured detector
    // doesn't block setup.
    fetch("/api/system/status")
      .then(() => null)
      .catch(() => null)
      .finally(() => {
        if (alive) setClasses(DEFAULT_CLASSES);
      });
    return () => {
      alive = false;
    };
    // Intentionally run once for this camera id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── URL sync (replace, no history spam) ────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const sp = new URLSearchParams();
    sp.set("step", step);
    if (step === "regions" && selectedRoiId) sp.set("roi", selectedRoiId);
    const next = `?${sp.toString()}`;
    if (
      typeof window !== "undefined" &&
      window.location.search !== next
    ) {
      router.replace(`/cameras/${id}/setup${next}`, { scroll: false });
    }
  }, [step, selectedRoiId, loaded, id, router]);

  // ── Poll the camera doc every 5s for a fresh status pill. Paused while
  //    the camera form is dirty so a poll can't stomp in-progress edits. ──
  useEffect(() => {
    if (camDirty) return;
    const i = setInterval(() => {
      fetch(`/api/cameras/${id}`)
        .then((r) => r.json())
        .then((c) => {
          if (!c || c.error) return;
          setCamera((prev) => (prev ? { ...prev, ...c } : (c as Camera)));
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(i);
  }, [id, camDirty]);

  // ── Unsaved-changes protection ─────────────────────────────────────────
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);

  const confirmDiscard = useCallback(
    () => window.confirm(DISCARD_MSG),
    [],
  );

  // ── Camera actions ─────────────────────────────────────────────────────
  const saveCamera = useCallback(
    async (advanceOnSuccess: boolean) => {
      setCamSaving(true);
      setCamErr(null);
      try {
        const r = await fetch(`/api/cameras/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            rtsp_url: form.rtsp.trim(),
            description: form.description,
            sample_fps: form.fps,
            vlm_enabled: form.vlm,
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        const data = (await r.json()) as { ok: boolean; camera?: Camera };
        if (data.camera) {
          hydrateCamera(data.camera);
        } else {
          const fresh = (await fetch(`/api/cameras/${id}`).then((x) =>
            x.json(),
          )) as Camera;
          hydrateCamera(fresh);
        }
        setCamSavedAt(Date.now());
        if (advanceOnSuccess) setStep("regions");
      } catch (e) {
        setCamErr((e as Error).message);
      } finally {
        setCamSaving(false);
      }
    },
    [id, form, hydrateCamera],
  );

  const testConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`/api/cameras/${id}/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rtsp_url: form.rtsp.trim() }),
      });
      const text = await r.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          /* not JSON */
        }
      }
      if (data && typeof data === "object" && "ok" in data) {
        setTestResult(data as TestResult);
      } else if (
        data &&
        typeof data === "object" &&
        "error" in (data as Record<string, unknown>)
      ) {
        setTestResult({
          ok: false,
          error: String((data as Record<string, unknown>).error),
        });
      } else {
        setTestResult({
          ok: false,
          error: `HTTP ${r.status}${
            text
              ? `: ${text.slice(0, 240)}`
              : " (empty response — is ov-api rebuilt?)"
          }`,
        });
      }
    } catch (e) {
      setTestResult({ ok: false, error: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }, [id, form.rtsp]);

  const deleteCamera = useCallback(async () => {
    if (
      !window.confirm(
        "Delete this camera?\n\n" +
          "This also removes all of its ROIs, incidents, segments, and clips. " +
          "This cannot be undone.",
      )
    )
      return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/cameras/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      router.replace("/");
    } catch (e) {
      setCamErr((e as Error).message);
      setDeleting(false);
    }
  }, [id, router]);

  // ── Navigation (dirty-guarded) ─────────────────────────────────────────
  const canLeaveConnection =
    camera !== null &&
    !camDirty &&
    !!form.name.trim() &&
    !!form.rtsp.trim();

  const goStep = useCallback(
    (target: Step) => {
      if (target === step) return;
      // Leaving Connection in setup-mode requires a saved, non-dirty camera.
      if (
        mode === "setup" &&
        step === "connection" &&
        target !== "connection" &&
        !canLeaveConnection
      ) {
        return;
      }
      if (anyDirty && !confirmDiscard()) return;
      // Discarding here clears the ROI-form dirty flag conceptually; the
      // StepRegions instance re-mounts its draft from selection on return.
      setStep(target);
    },
    [step, mode, canLeaveConnection, anyDirty, confirmDiscard],
  );

  const stepIdx = STEPS.indexOf(step);
  const goNext = useCallback(() => {
    const n = STEPS[stepIdx + 1];
    if (n) goStep(n);
  }, [stepIdx, goStep]);
  const goBack = useCallback(() => {
    const p = STEPS[stepIdx - 1];
    if (p) goStep(p);
  }, [stepIdx, goStep]);

  const selectRoiFromUrl = useCallback((rid: string | null) => {
    setSelectedRoiId(rid);
  }, []);

  const onRoisChange = useCallback((next: Roi[]) => {
    setRois(next);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  const headerTitle = useMemo(() => {
    if (!loaded) return null;
    return form.name || camera?.name || "Camera setup";
  }, [loaded, form.name, camera?.name]);

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header + stepper */}
        <div className="mb-6">
          {headerTitle === null ? (
            <div className="skeleton h-7 w-56 mb-4" />
          ) : (
            <h1 className="text-[22px] font-semibold mb-1">{headerTitle}</h1>
          )}
          {!loaded || mode === null ? (
            <div className="flex gap-2 mt-3">
              <div className="skeleton h-[58px] flex-1" />
              <div className="skeleton h-[58px] flex-1" />
              <div className="skeleton h-[58px] flex-1" />
            </div>
          ) : (
            <Stepper
              current={step}
              mode={mode}
              canLeaveConnection={canLeaveConnection}
              onGo={goStep}
            />
          )}
        </div>

        {/* Step body */}
        {!loaded || mode === null ? (
          <div className="space-y-4">
            <div className="skeleton h-64 w-full" />
            <div className="skeleton h-40 w-full" />
          </div>
        ) : (
          <>
            {step === "connection" && (
              <StepConnection
                camera={camera}
                form={form}
                setForm={setForm}
                dirty={camDirty}
                saving={camSaving}
                savedAt={camSavedAt}
                camErr={camErr}
                testing={testing}
                testResult={testResult}
                deleting={deleting}
                mode={mode}
                onSave={() => saveCamera(mode === "setup")}
                onRevert={() => camera && hydrateCamera(camera)}
                onProbe={testConnection}
                onDelete={deleteCamera}
              />
            )}

            {step === "regions" && (
              <StepRegions
                cameraId={id}
                rois={rois}
                classes={classes}
                selectedId={selectedRoiId}
                onSelectedIdChange={selectRoiFromUrl}
                onRoisChange={onRoisChange}
                registerDirty={setRoiFormDirty}
                confirmDiscard={confirmDiscard}
              />
            )}

            {step === "review" && (
              <StepReview
                cameraId={id}
                camera={camera}
                rois={rois}
                camDirty={camDirty}
                goStep={goStep}
              />
            )}

            {/* Setup-mode wizard nav (strict Back/Next). Edit-mode uses the
                clickable stepper tabs + per-step actions instead. */}
            {mode === "setup" && step !== "review" && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <button
                  type="button"
                  className="btn"
                  disabled={stepIdx === 0}
                  onClick={goBack}
                >
                  Back
                </button>
                <div className="flex items-center gap-3">
                  {step === "connection" && !canLeaveConnection && (
                    <span className="mono text-[11px] text-text-dim">
                      Save the camera to continue
                    </span>
                  )}
                  {step === "regions" && rois.length === 0 && (
                    <span className="mono text-[11px] text-text-dim">
                      Add at least one zone, or skip to review
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={
                      step === "connection" && !canLeaveConnection
                    }
                    onClick={goNext}
                  >
                    {step === "regions" && rois.length === 0
                      ? "Skip — review"
                      : "Next"}
                  </button>
                </div>
              </div>
            )}
            {mode === "setup" && step === "review" && (
              <div className="flex items-center mt-6 pt-4 border-t border-border">
                <button type="button" className="btn" onClick={goBack}>
                  Back
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

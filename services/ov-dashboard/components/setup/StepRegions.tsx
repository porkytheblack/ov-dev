"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoiCanvas, type RoiLite } from "@/components/RoiCanvas";
import { RoiList } from "./RoiList";
import { RoiForm } from "./RoiForm";
import {
  draftDirty,
  draftFromRoi,
  freshDraft,
  roiPayload,
  validateDraft,
  type Pt,
  type Roi,
  type RoiDraft,
} from "./shared";

/**
 * Step 2 — Regions. Two-pane core:
 *   LEFT  = RoiCanvas (persistent snapshot, ALL ROIs color-coded)
 *   RIGHT = RoiList (manage) + RoiForm (properties of selected/new zone)
 *
 * Editing model. `editing` is the single source of truth for what the form +
 * canvas-draft show:
 *   - { kind: "none" }            — nothing selected
 *   - { kind: "existing", id }    — editing a stored ROI
 *   - { kind: "new" } (drawing)   — drawing/editing a brand-new zone
 *
 * Every transition (select row, click zone on canvas, +Add, delete, save) is
 * an explicit imperative move that is dirty-guarded (discard-confirm) — no
 * effect-driven reconciliation, so there are no stale-draft races.
 *
 * Saving an ROI (POST new / PATCH existing) STAYS on this step so several
 * zones can be added and watched accumulating; a transient "Saved ✓" shows.
 */

type Editing =
  | { kind: "none" }
  | { kind: "existing"; id: string }
  | { kind: "new" };

export function StepRegions({
  cameraId,
  rois,
  classes,
  selectedId,
  onSelectedIdChange,
  onRoisChange,
  registerDirty,
  confirmDiscard,
}: {
  cameraId: string;
  rois: Roi[];
  classes: string[];
  /** URL-synced selected ROI id (null = none / drawing new). */
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  /** Replace the parent's ROI list after a mutation. */
  onRoisChange: (rois: Roi[]) => void;
  /** Report whether the ROI form currently has unsaved changes. */
  registerDirty: (dirty: boolean) => void;
  /** Ask the user to confirm discarding unsaved ROI changes. */
  confirmDiscard: () => boolean;
}) {
  const [editing, setEditing] = useState<Editing>(
    selectedId ? { kind: "existing", id: selectedId } : { kind: "none" },
  );
  const [draft, setDraftState] = useState<RoiDraft | null>(() => {
    if (selectedId) {
      const r = rois.find((x) => x.id === selectedId);
      return r ? draftFromRoi(r) : null;
    }
    return null;
  });
  // Stored baseline the draft was hydrated from (dirty comparison). null for a
  // brand-new zone.
  const [baseDraft, setBaseDraft] = useState<RoiDraft | null>(() => draft);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSavedId, setJustSavedId] = useState<string | "new" | null>(null);

  const isNew = editing.kind === "new";
  const dirty = draft ? draftDirty(draft, baseDraft) : false;

  useEffect(() => {
    registerDirty(dirty);
  }, [dirty, registerDirty]);

  // ── External selection (URL deep-link / parent) drives the editor, but
  //    only when it actually diverges from what we're already editing and
  //    the form is clean (a dirty in-progress edit must not be stomped by a
  //    URL echo). The save path sets editing first, so this stays quiet. ──
  useEffect(() => {
    const curId = editing.kind === "existing" ? editing.id : null;
    if (selectedId === curId) return;
    if (editing.kind === "new" && selectedId == null) return;
    if (dirty) return; // don't clobber an unsaved edit on a URL echo
    if (selectedId == null) {
      setEditing({ kind: "none" });
      setDraftState(null);
      setBaseDraft(null);
      setFormErr(null);
      return;
    }
    const roi = rois.find((r) => r.id === selectedId);
    if (!roi) return;
    const d = draftFromRoi(roi);
    setEditing({ kind: "existing", id: selectedId });
    setDraftState(d);
    setBaseDraft(d);
    setFormErr(null);
  }, [selectedId, rois, editing, dirty]);

  const setDraft = useCallback((patch: Partial<RoiDraft>) => {
    setDraftState((cur) => (cur ? { ...cur, ...patch } : cur));
  }, []);

  // Load a stored ROI into the editor (imperative, no guard — callers guard).
  const loadExisting = useCallback(
    (roi: Roi) => {
      const d = draftFromRoi(roi);
      setEditing({ kind: "existing", id: roi.id });
      setDraftState(d);
      setBaseDraft(d);
      setFormErr(null);
      onSelectedIdChange(roi.id);
    },
    [onSelectedIdChange],
  );

  // ── Transitions (all dirty-guarded) ────────────────────────────────────
  const nextZoneNumber = useMemo(() => rois.length + 1, [rois.length]);

  const startAdd = useCallback(() => {
    if (dirty && !confirmDiscard()) return;
    setEditing({ kind: "new" });
    setDraftState(freshDraft(nextZoneNumber));
    setBaseDraft(null);
    setFormErr(null);
    setJustSavedId(null);
    onSelectedIdChange(null);
  }, [dirty, confirmDiscard, nextZoneNumber, onSelectedIdChange]);

  const selectRoi = useCallback(
    (id: string | null) => {
      const curId = editing.kind === "existing" ? editing.id : null;
      if (id === curId && editing.kind !== "new") return;
      if (dirty && !confirmDiscard()) return;
      setJustSavedId(null);
      if (id == null) {
        setEditing({ kind: "none" });
        setDraftState(null);
        setBaseDraft(null);
        setFormErr(null);
        onSelectedIdChange(null);
        return;
      }
      const roi = rois.find((r) => r.id === id);
      if (roi) loadExisting(roi);
    },
    [editing, dirty, confirmDiscard, rois, loadExisting, onSelectedIdChange],
  );

  // Canvas live geometry edits feed the draft.
  const onDraftChange = useCallback((poly: Pt[] | null) => {
    setDraftState((cur) => (cur ? { ...cur, polygon: poly } : cur));
  }, []);

  // A new rectangle finished drawing → keep editing it (stay in "new").
  const onAddComplete = useCallback(() => {
    /* draw mode is derived from `editing.kind === "new"`; the rect is now in
       the draft. Nothing else to do — the user keeps tuning it. */
  }, []);

  // ── Persistence ───────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    const j = await fetch(`/api/cameras/${cameraId}/rois`).then((r) =>
      r.json(),
    );
    const next: Roi[] = j.rois ?? [];
    onRoisChange(next);
    return next;
  }, [cameraId, onRoisChange]);

  const saveRoi = useCallback(async () => {
    if (!draft) return;
    const err = validateDraft(draft);
    if (err) {
      setFormErr(err);
      return;
    }
    setFormErr(null);
    setSaving(true);
    try {
      const body = roiPayload(draft);
      if (editing.kind === "existing") {
        const r = await fetch(`/api/rois/${editing.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        await refetch();
        setBaseDraft({ ...draft }); // current draft is now the saved baseline
        setJustSavedId(editing.id);
      } else {
        const r = await fetch(`/api/cameras/${cameraId}/rois`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        const { id } = (await r.json()) as { id: string };
        const next = await refetch();
        // Stay on Regions; switch to editing the just-created zone so the
        // user sees it accumulate and can immediately add another.
        const created = next.find((x) => x.id === id);
        if (created) {
          const d = draftFromRoi(created);
          setEditing({ kind: "existing", id });
          setDraftState(d);
          setBaseDraft(d);
        } else {
          setEditing({ kind: "none" });
          setDraftState(null);
          setBaseDraft(null);
        }
        onSelectedIdChange(id);
        setJustSavedId("new");
      }
    } catch (e) {
      setFormErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [draft, editing, cameraId, refetch, onSelectedIdChange]);

  const discard = useCallback(() => {
    if (isNew) {
      if (dirty && !confirmDiscard()) return;
      setEditing({ kind: "none" });
      setDraftState(null);
      setBaseDraft(null);
      setFormErr(null);
      onSelectedIdChange(null);
      return;
    }
    if (baseDraft) {
      setDraftState({ ...baseDraft });
      setFormErr(null);
    }
  }, [isNew, dirty, confirmDiscard, baseDraft, onSelectedIdChange]);

  const duplicate = useCallback(
    async (r: Roi) => {
      if (dirty && !confirmDiscard()) return;
      setSaving(true);
      setFormErr(null);
      try {
        const src = draftFromRoi(r);
        const body = { ...roiPayload(src), name: `${r.name} (copy)` };
        const resp = await fetch(`/api/cameras/${cameraId}/rois`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok)
          throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        const { id } = (await resp.json()) as { id: string };
        const next = await refetch();
        const created = next.find((x) => x.id === id);
        if (created) loadExisting(created);
      } catch (e) {
        setFormErr((e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [dirty, confirmDiscard, cameraId, refetch, loadExisting],
  );

  const remove = useCallback(
    async (r: Roi) => {
      if (!window.confirm(`Delete ROI "${r.name}"? This cannot be undone.`))
        return;
      setSaving(true);
      setFormErr(null);
      try {
        const resp = await fetch(`/api/rois/${r.id}`, { method: "DELETE" });
        if (!resp.ok)
          throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        await refetch();
        const editingThis =
          editing.kind === "existing" && editing.id === r.id;
        if (editingThis) {
          setEditing({ kind: "none" });
          setDraftState(null);
          setBaseDraft(null);
          setFormErr(null);
          onSelectedIdChange(null);
        }
      } catch (e) {
        setFormErr((e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [editing, refetch, onSelectedIdChange],
  );

  // Canvas render sources.
  const roisLite: RoiLite[] = useMemo(
    () =>
      rois.map((r) => ({
        id: r.id,
        name: r.name,
        polygon: Array.isArray(r.polygon) ? r.polygon : [],
      })),
    [rois],
  );

  const canvasSelectedId =
    editing.kind === "existing" ? editing.id : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      <div className="lg:col-span-3 card">
        <div className="label mb-3">Camera view</div>
        <RoiCanvas
          cameraId={cameraId}
          rois={roisLite}
          selectedRoiId={canvasSelectedId}
          draftPolygon={draft?.polygon ?? null}
          mode={isNew ? "draw" : "select"}
          onSelect={selectRoi}
          onDraftChange={onDraftChange}
          onAddComplete={onAddComplete}
        />
      </div>

      <div className="lg:col-span-2 space-y-4">
        <RoiList
          rois={rois}
          selectedId={canvasSelectedId}
          isDrawingNew={isNew}
          selectedDirty={dirty}
          onSelect={selectRoi}
          onAdd={startAdd}
          onDuplicate={duplicate}
          onDelete={remove}
        />

        {draft ? (
          <RoiForm
            draft={draft}
            setDraft={setDraft}
            classes={classes}
            isNew={isNew}
            dirty={dirty}
            error={formErr}
            saving={saving}
            justSaved={
              justSavedId != null &&
              (justSavedId === "new" || justSavedId === canvasSelectedId)
            }
            onSave={saveRoi}
            onDiscard={discard}
          />
        ) : (
          <div className="card">
            <p className="text-[13px] text-text-muted">
              {rois.length === 0
                ? "No zones yet."
                : "Select a zone to edit it, or add a new one."}
            </p>
            <p className="text-[11px] text-text-dim mt-1.5 leading-relaxed">
              Pick a zone from the list (or click it on the camera view) to
              edit its properties, or use{" "}
              <span className="text-text">+ Add region</span> to draw another.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

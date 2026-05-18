"use client";

import { DAYS, DEFAULT_CLASSES, type RoiDraft } from "./shared";
import { ToggleChip, ToggleGroup } from "./ToggleChip";

/**
 * Properties of the selected / new ROI. The detection-window block (Start /
 * End / Active-on days / Timezone) is the EXACT UI from the old single page,
 * still feeding buildDetectionWindow with Sun=0..Sat=6 day numbering.
 *
 * "Save region" stays on the page; "Discard" reverts to the stored values.
 * Switching ROI / +Add while dirty is gated by the parent (discard-confirm).
 */
export function RoiForm({
  draft,
  setDraft,
  classes,
  isNew,
  dirty,
  error,
  saving,
  justSaved,
  onSave,
  onDiscard,
}: {
  draft: RoiDraft;
  setDraft: (patch: Partial<RoiDraft>) => void;
  classes: string[];
  isNew: boolean;
  dirty: boolean;
  error: string | null;
  saving: boolean;
  justSaved: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const classList = classes.length > 0 ? classes : DEFAULT_CLASSES;

  function toggleClass(cls: string) {
    setDraft({
      classes_of_interest: draft.classes_of_interest.includes(cls)
        ? draft.classes_of_interest.filter((c) => c !== cls)
        : [...draft.classes_of_interest, cls],
    });
  }

  function toggleDay(d: number) {
    setDraft({
      winDays: draft.winDays.includes(d)
        ? draft.winDays.filter((x) => x !== d)
        : [...draft.winDays, d],
    });
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="label">
          {isNew ? "New zone" : "Zone properties"}
        </div>
        {dirty && (
          <span className="mono text-[10px] text-accent">● unsaved</span>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="roi-name">
          Zone name
        </label>
        <input
          id="roi-name"
          className="input-text"
          value={draft.name}
          onChange={(e) => setDraft({ name: e.target.value })}
          placeholder="Front gate"
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="roi-desc">
          Zone description
        </label>
        <textarea
          id="roi-desc"
          className="input-text h-16"
          value={draft.description}
          onChange={(e) => setDraft({ description: e.target.value })}
          placeholder="What this region covers (optional). VLM context."
        />
      </div>

      <div className="field">
        <span className="label">Region type</span>
        <ToggleGroup>
          {[
            { v: "include" as const, t: "Detect zone" },
            { v: "exclude" as const, t: "Exclusion (ignore)" },
          ].map((o) => (
            <ToggleChip
              key={o.v}
              active={draft.kind === o.v}
              onClick={() => setDraft({ kind: o.v })}
            >
              {o.t}
            </ToggleChip>
          ))}
        </ToggleGroup>
        <span className="text-text-dim text-[10px]">
          {draft.kind === "exclude"
            ? "Anything detected inside this area is ignored — e.g. a tall tree mistaken for a person in bad light. No incidents or fire alerts from here, ever."
            : "A normal region of interest — incidents fire for the classes below."}
        </span>
      </div>

      {draft.kind === "include" ? (
        <>
      <div className="field">
        <span className="label">Classes of interest</span>
        <ToggleGroup wrap>
          {classList.map((cls) => (
            <ToggleChip
              key={cls}
              mono
              active={draft.classes_of_interest.includes(cls)}
              onClick={() => toggleClass(cls)}
            >
              {cls}
            </ToggleChip>
          ))}
        </ToggleGroup>
        <span className="text-text-dim text-[10px]">
          An incident fires when one of these object types lingers in the zone.
        </span>
      </div>

      <div className="field">
        <label className="label" htmlFor="roi-linger">
          Linger threshold (seconds)
        </label>
        <div className="w-24">
          <input
            id="roi-linger"
            type="number"
            min={0}
            max={3600}
            className="input"
            value={draft.linger_threshold_seconds}
            onChange={(e) =>
              setDraft({ linger_threshold_seconds: Number(e.target.value) })
            }
          />
        </div>
        <span className="text-text-dim text-[10px]">
          How long an object must stay before it counts as an incident.
        </span>
      </div>

      <div className="field">
        <span className="label">Match mode</span>
        <ToggleGroup>
          {(["centroid", "iou"] as const).map((m) => (
            <ToggleChip
              key={m}
              mono
              active={draft.match_mode === m}
              onClick={() => setDraft({ match_mode: m })}
            >
              {m.toUpperCase()}
            </ToggleChip>
          ))}
        </ToggleGroup>
        <span className="text-text-dim text-[10px]">
          Centroid: object center inside the zone. IoU: bounding box overlaps
          the zone.
        </span>
      </div>

      {/* ── Active time range (verbatim window UI) ────────────────────── */}
      <div className="field">
        <span className="label">Active time range</span>
        <ToggleGroup>
          {[
            { v: false, t: "Always active" },
            { v: true, t: "During a time window" },
          ].map((opt) => (
            <ToggleChip
              key={String(opt.v)}
              active={draft.windowed === opt.v}
              onClick={() => setDraft({ windowed: opt.v })}
            >
              {opt.t}
            </ToggleChip>
          ))}
        </ToggleGroup>

        {draft.windowed && (
          <div className="mt-2 space-y-3 border border-border rounded-md p-3 bg-surface">
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label" htmlFor="win-start">
                  Start
                </label>
                <input
                  id="win-start"
                  type="time"
                  className="input"
                  value={draft.winStart}
                  onChange={(e) => setDraft({ winStart: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="win-end">
                  End
                </label>
                <input
                  id="win-end"
                  type="time"
                  className="input"
                  value={draft.winEnd}
                  onChange={(e) => setDraft({ winEnd: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <span className="label">Active on</span>
              <ToggleGroup wrap>
                {DAYS.map((d) => (
                  <ToggleChip
                    key={d.value}
                    mono
                    active={draft.winDays.includes(d.value)}
                    onClick={() => toggleDay(d.value)}
                    className="!w-12 !px-0"
                  >
                    {d.label}
                  </ToggleChip>
                ))}
              </ToggleGroup>
              <span className="text-text-dim text-[10px]">
                {draft.winDays.length === 0
                  ? "No days selected — the zone will be active every day."
                  : "Zone is only active on the selected days."}
              </span>
            </div>

            <div className="field">
              <label className="label" htmlFor="win-tz">
                Timezone
              </label>
              <input
                id="win-tz"
                className="input"
                value={draft.winTz}
                onChange={(e) => setDraft({ winTz: e.target.value })}
                placeholder="Africa/Nairobi"
              />
              <span className="text-text-dim text-[10px]">
                IANA name. Start/end times are interpreted in this timezone. An
                end before the start wraps past midnight (e.g. 18:00 → 06:00 =
                overnight).
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Notifications ────────────────────────────────────────────── */}
      <div className="field">
        <span className="label">Notifications</span>
        <label className="flex items-center gap-2 select-none h-9">
          <input
            type="checkbox"
            checked={draft.notify_enabled}
            onChange={(e) => setDraft({ notify_enabled: e.target.checked })}
          />
          <span className="text-[12px]">
            Send a notification when an incident fires in this zone
          </span>
        </label>
      </div>
        </>
      ) : null}

      {error && <div className="mono text-[11px] text-danger">{error}</div>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "Saving…" : isNew ? "Save region" : "Save changes"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={saving || (!dirty && !isNew)}
          onClick={onDiscard}
        >
          {isNew ? "Cancel" : "Discard"}
        </button>
        {justSaved && !dirty && (
          <span className="mono text-[11px] text-success">Saved ✓</span>
        )}
      </div>
    </div>
  );
}

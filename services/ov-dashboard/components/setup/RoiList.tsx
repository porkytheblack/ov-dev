"use client";

import { roiColor } from "@/lib/roiColors";
import { summarizeWindow, type Roi } from "./shared";

/**
 * The "manage" pane of Step 2: one row per stored ROI (color swatch + name +
 * classes + window summary + notify), plus per-row Duplicate / Delete and an
 * "+ Add region" header action. The currently-selected row is accent-marked;
 * an "edited" dot appears when it has unsaved changes.
 */
export function RoiList({
  rois,
  selectedId,
  isDrawingNew,
  selectedDirty,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: {
  rois: Roi[];
  selectedId: string | null;
  /** A brand-new (unsaved) zone is being drawn/edited. */
  isDrawingNew: boolean;
  /** The selected/new draft has unsaved changes. */
  selectedDirty: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (r: Roi) => void;
  onDelete: (r: Roi) => void;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="label">Detection zones</div>
        <button
          type="button"
          className="btn-primary !min-h-8 !px-3 !text-[12px]"
          onClick={onAdd}
        >
          + Add region
        </button>
      </div>

      {rois.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-[13px] text-text">
            {isDrawingNew
              ? "Drawing your first zone…"
              : "Draw your first detection zone"}
          </p>
          <p className="text-[11px] text-text-muted mt-1.5 max-w-xs mx-auto leading-relaxed">
            A camera with no zones still records video, but it raises no
            incidents. Use{" "}
            <span className="text-text">+ Add region</span> and drag a box on
            the snapshot.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--border)]">
          {/* New (unsaved) zone gets its own provisional row at the top. */}
          {isDrawingNew && (
            <li className="flex items-start gap-3 px-4 py-3 bg-[color:var(--accent-soft)] border-l-2 border-accent">
              <span className="inline-block w-3 h-3 rounded-sm mt-0.5 shrink-0 border border-border-strong" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-accent truncate">
                    New zone
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-accent shrink-0"
                    title="Unsaved"
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Unsaved — fill in the form and Save region.
                </p>
              </div>
            </li>
          )}
          {rois.map((r, i) => {
            const active = !isDrawingNew && r.id === selectedId;
            const color = roiColor(i);
            return (
              <li key={r.id}>
                <div
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    active
                      ? "bg-[color:var(--accent-soft)] border-l-2 border-accent"
                      : "border-l-2 border-transparent hover:bg-surface-elev"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className="flex items-start gap-3 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] rounded-sm"
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-sm mt-0.5 shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`text-[13px] font-medium truncate ${
                            active ? "text-accent" : "text-text"
                          }`}
                        >
                          {r.name}
                        </span>
                        {active && selectedDirty && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-accent shrink-0"
                            title="Unsaved changes"
                          />
                        )}
                        {r.notify_enabled && (
                          <span
                            className="text-[10px] mono text-text-dim shrink-0"
                            title="Notifications enabled"
                          >
                            ●&#xfe0e; notify
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] mono text-text-muted truncate mt-0.5">
                        {(r.classes_of_interest ?? []).join(", ") || "—"}
                      </span>
                      <span className="block text-[11px] mono text-text-dim truncate">
                        {summarizeWindow(r.detection_window)}
                      </span>
                    </span>
                  </button>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      className="text-[10px] mono uppercase tracking-[0.06em] text-text-dim hover:text-text px-1.5 py-0.5 rounded transition-colors"
                      onClick={() => onDuplicate(r)}
                      title="Duplicate this zone"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="text-[10px] mono uppercase tracking-[0.06em] text-text-dim hover:text-danger px-1.5 py-0.5 rounded transition-colors"
                      onClick={() => onDelete(r)}
                      title="Delete this zone"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { STEPS, STEP_LABEL, type Step } from "./shared";

type SegState = "complete" | "current" | "upcoming" | "blocked";

/**
 * Three-segment progress stepper under the page <h1>.
 *
 * - setup-mode (camera has 0 ROIs): strict — only complete/current segments
 *   are clickable, later ones are "blocked"; shows a "Step n of 3" caption.
 * - edit-mode (>=1 ROI): every segment is a freely-clickable tab.
 */
export function Stepper({
  current,
  mode,
  canLeaveConnection,
  onGo,
}: {
  current: Step;
  mode: "setup" | "edit";
  /** setup-mode only: is Step 1 satisfied (camera saved & not dirty)? */
  canLeaveConnection: boolean;
  onGo: (s: Step) => void;
}) {
  const idx = STEPS.indexOf(current);

  function stateOf(s: Step, i: number): SegState {
    if (s === current) return "current";
    if (mode === "edit") return i < idx ? "complete" : "upcoming";
    // setup-mode strict gating
    if (i < idx) return "complete";
    if (i === idx + 1 && canLeaveConnection && current === "connection")
      return "upcoming";
    if (i > idx) return "blocked";
    return "upcoming";
  }

  function clickable(s: Step, i: number): boolean {
    if (s === current) return false;
    if (mode === "edit") return true;
    if (i < idx) return true; // step back freely
    // forward only into the immediate next step, and only once unblocked
    return i === idx + 1 && current === "connection" && canLeaveConnection;
  }

  return (
    <div>
      <ol className="flex items-stretch gap-2" role="tablist">
        {STEPS.map((s, i) => {
          const st = stateOf(s, i);
          const can = clickable(s, i);
          return (
            <li key={s} className="flex-1">
              <button
                type="button"
                role="tab"
                aria-selected={st === "current"}
                aria-disabled={!can && st !== "current"}
                disabled={!can && st !== "current"}
                onClick={() => can && onGo(s)}
                className={`group w-full text-left rounded-md border px-3.5 py-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${segClass(
                  st,
                  can,
                )}`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] mono shrink-0 border ${badgeClass(
                      st,
                    )}`}
                  >
                    {st === "complete" ? "✓" : i + 1}
                  </span>
                  <span className="flex flex-col leading-tight min-w-0">
                    <span className="label !text-[10px]">{`Step ${i + 1}`}</span>
                    <span
                      className={`text-[13px] font-medium truncate ${
                        st === "current"
                          ? "text-text"
                          : st === "complete"
                            ? "text-text-muted"
                            : "text-text-dim"
                      }`}
                    >
                      {STEP_LABEL[s]}
                    </span>
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
      {mode === "setup" && (
        <div className="mono text-[11px] text-text-dim mt-2">
          Step {idx + 1} of {STEPS.length}
        </div>
      )}
    </div>
  );
}

function segClass(st: SegState, can: boolean): string {
  if (st === "current")
    return "border-accent bg-[color:var(--accent-soft)]";
  if (st === "complete")
    return `border-border-strong bg-surface-elev ${
      can ? "hover:border-accent cursor-pointer" : ""
    }`;
  if (st === "upcoming")
    return `border-border bg-surface ${
      can ? "hover:border-accent cursor-pointer" : ""
    }`;
  // blocked
  return "border-border bg-surface opacity-55 cursor-not-allowed";
}

function badgeClass(st: SegState): string {
  if (st === "current")
    return "border-accent text-accent bg-[color:var(--accent-soft)]";
  if (st === "complete")
    return "border-success text-success bg-[color:var(--success-soft)]";
  return "border-border-strong text-text-dim";
}

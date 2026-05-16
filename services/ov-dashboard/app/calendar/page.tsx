"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    fetch(`/api/incidents?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=200`)
      .then((r) => r.json())
      .then((j) => setIncidents(j.incidents ?? []))
      .finally(() => setLoading(false));
  }, [year, month]);

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const offset = first.getDay();
    const out: (number | null)[] = Array.from({ length: offset }).map(() => null);
    for (let d = 1; d <= last.getDate(); d++) out.push(d);
    return out;
  }, [year, month]);

  const byDay = useMemo(() => {
    const m: Record<number, any[]> = {};
    for (const i of incidents) {
      const d = new Date(i.opened_at).getDate();
      m[d] = m[d] ?? [];
      m[d].push(i);
    }
    return m;
  }, [incidents]);

  const monthName = new Date(year, month).toLocaleString("en-US", { month: "long" });

  const todayDate = new Date();
  const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() === month;
  const todayDay = isCurrentMonth ? todayDate.getDate() : null;

  function prevMonth() {
    const d = new Date(year, month - 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function nextMonth() {
    const d = new Date(year, month + 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const totalIncidents = incidents.length;

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-[22px] font-semibold">{monthName} {year}</h1>
            <p className="text-text-dim text-[13px] mt-0.5">
              {loading
                ? "Loading incidents…"
                : totalIncidents === 0
                  ? "No incidents this month"
                  : `${totalIncidents} incident${totalIncidents !== 1 ? "s" : ""} this month`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={prevMonth} aria-label="Previous month">
              ← Previous
            </button>
            {!isCurrentMonth && (
              <button
                className="btn-ghost text-[13px]"
                onClick={() => {
                  setYear(todayDate.getFullYear());
                  setMonth(todayDate.getMonth());
                }}
              >
                Today
              </button>
            )}
            <button className="btn" onClick={nextMonth} aria-label="Next month">
              Next →
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="card p-0 overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAY_LABELS.map((d) => (
              <div key={d} className="label py-2.5 px-3 text-center">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              if (d === null) {
                return (
                  <div
                    key={`empty-${i}`}
                    className="min-h-[88px] border-b border-r border-border bg-bg"
                    aria-hidden="true"
                  />
                );
              }

              const list = byDay[d] ?? [];
              const isToday = d === todayDay;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const cams = Array.from(
                new Set(list.map((x: any) => x.camera_name).filter(Boolean)),
              ) as string[];

              return (
                <Link
                  key={`day-${d}`}
                  href={`/calendar/${dateStr}`}
                  className="group min-h-[88px] border-b border-r border-border p-2 block hover:bg-surface-elev transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ring)]"
                  style={isToday ? { backgroundColor: "var(--accent-soft)" } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className={`mono text-[11px] ${isToday ? "text-accent font-semibold" : "text-text-dim"}`}>
                      {String(d).padStart(2, "0")}
                      {isToday && <span className="ml-1 text-accent">Today</span>}
                    </div>
                    <span className="mono text-[10px] text-text-dim opacity-0 group-hover:opacity-100 transition-opacity">
                      View →
                    </span>
                  </div>

                  {list.length > 0 ? (
                    <>
                      <div className="mono text-[16px] text-text font-semibold leading-none mt-1 mb-1">
                        {list.length}
                        <span className="text-[10px] text-text-dim font-normal ml-1">
                          incident{list.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {cams.slice(0, 3).map((cn) => (
                        <div
                          key={cn}
                          className="mono text-[11px] text-text-muted truncate"
                        >
                          {cn}
                        </div>
                      ))}
                      {cams.length > 3 && (
                        <div className="mono text-[10px] text-text-dim mt-0.5">
                          +{cams.length - 3} more
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mono text-[10px] text-text-dim mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      No incidents
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-text-dim text-[12px]">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: "var(--accent-soft)", border: "1px solid var(--accent)" }}
            />
            <span>Today</span>
          </div>
          <span className="mono">Click any day to open its incidents, grouped by camera.</span>
        </div>
      </main>
    </>
  );
}

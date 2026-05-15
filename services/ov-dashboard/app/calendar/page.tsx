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

              return (
                <div
                  key={`day-${d}`}
                  className="min-h-[88px] border-b border-r border-border p-2"
                  style={isToday ? { backgroundColor: "var(--accent-soft)" } : undefined}
                >
                  {/* Day number */}
                  <div className={`mono text-[11px] mb-1 ${isToday ? "text-accent font-semibold" : "text-text-dim"}`}>
                    {String(d).padStart(2, "0")}
                    {isToday && <span className="ml-1 text-accent">Today</span>}
                  </div>

                  {/* Incident count badge */}
                  {list.length > 0 && (
                    <div className="mono text-[16px] text-text font-semibold leading-none mb-1">
                      {list.length}
                    </div>
                  )}

                  {/* Incident links (first two) */}
                  {list.slice(0, 2).map((it) => (
                    <Link
                      key={it.id}
                      href={`/incidents/${it.id}`}
                      className="block mono text-[11px] text-text-muted hover:text-accent truncate transition-colors"
                    >
                      {it.camera_name}
                    </Link>
                  ))}

                  {/* Overflow indicator */}
                  {list.length > 2 && (
                    <div className="mono text-[10px] text-text-dim mt-0.5">
                      +{list.length - 2} more
                    </div>
                  )}
                </div>
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
          <span className="mono">Numbers = incident count for that day. Click an incident name to view details.</span>
        </div>
      </main>
    </>
  );
}

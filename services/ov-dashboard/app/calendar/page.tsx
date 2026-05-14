"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function CalendarPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    fetch(`/api/incidents?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=200`)
      .then((r) => r.json())
      .then((j) => setIncidents(j.incidents ?? []));
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

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-[18px]">{monthName} {year}</h1>
          <div className="flex-1" />
          <button
            className="btn"
            onClick={() => {
              const d = new Date(year, month - 1);
              setYear(d.getFullYear());
              setMonth(d.getMonth());
            }}
          >
            ← PREV
          </button>
          <button
            className="btn"
            onClick={() => {
              const d = new Date(year, month + 1);
              setYear(d.getFullYear());
              setMonth(d.getMonth());
            }}
          >
            NEXT →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
            <div key={d} className="mono uppercase tracking-[0.08em] text-text-dim text-[11px] py-1 px-2">{d}</div>
          ))}
          {days.map((d, i) => {
            if (d === null) return <div key={i} />;
            const list = byDay[d] ?? [];
            return (
              <div key={i} className="border border-border bg-surface p-2 min-h-[88px]">
                <div className="mono text-[11px] text-text-dim">{String(d).padStart(2, "0")}</div>
                <div className="mt-1 mono text-[18px] text-text">{list.length || ""}</div>
                {list.slice(0, 2).map((it) => (
                  <Link key={it.id} href={`/incidents/${it.id}`} className="block mono text-[11px] text-text-muted hover:text-accent truncate">
                    {it.camera_name}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { api } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import Link from "next/link";

async function getMe(cookie: string) {
  try {
    const r = await api<{ user: any }>("/auth/me", { cookie });
    return r.user;
  } catch {
    return null;
  }
}

async function isInitialized(): Promise<boolean> {
  try {
    const r = await api<{ initialized: boolean }>("/auth/status");
    return r.initialized;
  } catch {
    return true; // fail closed — show login, not wizard
  }
}

export default async function Page() {
  const cookie = headers().get("cookie") ?? "";
  const me = await getMe(cookie);
  if (!me) {
    const initialized = await isInitialized();
    redirect(initialized ? "/login" : "/login?wizard=1");
  }
  const cameras = await api<{ cameras: any[] }>("/cameras", { cookie }).catch(() => ({ cameras: [] }));
  const incidents = await api<{ incidents: any[] }>("/incidents?limit=10", { cookie }).catch(
    () => ({ incidents: [] }),
  );
  return (
    <>
      <Nav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <section className="mb-8">
          <div className="flex items-baseline gap-3 mb-3">
            <h2 className="mono uppercase tracking-[0.08em] text-text-dim text-[11px]">CAMERAS</h2>
            <span className="mono text-text-dim text-[11px]">{cameras.cameras.length} TOTAL</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {cameras.cameras.length === 0 && (
              <div className="card text-text-muted col-span-full">
                No cameras yet. <Link href="/cameras/new" className="text-accent underline">Add one →</Link>
              </div>
            )}
            {cameras.cameras.map((c: any) => (
              <Link
                key={c.id}
                href={`/cameras/${c.id}`}
                className="card hover:bg-surface-elev block"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text">{c.name}</span>
                  <StatusPill status={c.status} />
                </div>
                <div className="mono text-[11px] text-text-dim">
                  {c.last_frame_at ? `last frame ${formatRelative(c.last_frame_at)}` : "no frames yet"}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-baseline gap-3 mb-3">
            <h2 className="mono uppercase tracking-[0.08em] text-text-dim text-[11px]">RECENT INCIDENTS</h2>
            <Link href="/incidents" className="mono text-[11px] text-accent">VIEW ALL →</Link>
          </div>
          <div className="card p-0">
            <table className="ov">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>CAMERA</th>
                  <th>CLASSES</th>
                  <th>STATUS</th>
                  <th>SUMMARY</th>
                </tr>
              </thead>
              <tbody>
                {incidents.incidents.length === 0 && (
                  <tr><td colSpan={5} className="text-text-muted">No incidents in the last 7 days.</td></tr>
                )}
                {incidents.incidents.map((i: any) => (
                  <tr key={i.id}>
                    <td className="mono">{formatRelative(i.opened_at)}</td>
                    <td>{i.camera_name}</td>
                    <td className="mono">{(i.classes ?? []).join(", ")}</td>
                    <td><StatusPill status={i.status} /></td>
                    <td className="max-w-md truncate text-text-muted">{i.summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

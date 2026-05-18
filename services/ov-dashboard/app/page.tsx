import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { IncidentFeed } from "@/components/IncidentFeed";
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
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Camera grid */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[17px] font-semibold">Cameras</h2>
              <p className="text-text-dim text-[13px] mt-0.5">
                {cameras.cameras.length === 0
                  ? "No cameras configured"
                  : `${cameras.cameras.length} camera${cameras.cameras.length !== 1 ? "s" : ""} configured`}
              </p>
            </div>
            <Link href="/cameras/new" className="btn-primary">Add camera</Link>
          </div>

          {cameras.cameras.length === 0 ? (
            <div className="card flex flex-col items-center text-center py-12 gap-3">
              <p className="text-text-muted">No cameras have been added yet.</p>
              <p className="text-text-dim text-[13px] max-w-xs">
                Add your first camera to start monitoring footage and detecting incidents.
              </p>
              <Link href="/cameras/new" className="btn-primary mt-2">Add your first camera</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {cameras.cameras.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/cameras/${c.id}`}
                  className="card hover:bg-surface-elev block transition-colors duration-150 group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-text font-medium leading-snug">{c.name}</span>
                    <StatusPill status={c.status} />
                  </div>
                  <div className="mono text-[11px] text-text-dim">
                    {c.last_frame_at
                      ? `Last frame ${formatRelative(c.last_frame_at)}`
                      : "No frames received yet"}
                  </div>
                  <div className="mt-3 text-[12px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                    View camera →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent incidents */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[17px] font-semibold">Recent Incidents</h2>
              <p className="text-text-dim text-[13px] mt-0.5">Last 10 detections across all cameras</p>
            </div>
            <Link href="/incidents" className="btn">View all incidents</Link>
          </div>

          <IncidentFeed
            incidents={incidents.incidents}
            emptyText="No incidents recorded yet. The system is monitoring for activity."
          />
        </section>
      </main>
    </>
  );
}

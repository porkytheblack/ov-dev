import postgres from "postgres";
import { v4 as uuid } from "uuid";

export type IncidentRow = {
  id: string;
  cameraId: string;
  roiId: string;
  trackId: string | null;
  classes: string[];
  openedAt: Date;
  closedAt: Date | null;
  status: "open" | "closed" | "suppressed" | "acknowledged";
};

export class IncidentStore {
  constructor(private sql: ReturnType<typeof postgres>) {}

  async createOpen(args: {
    cameraId: string;
    roiId: string;
    trackId: string | null;
    classes: string[];
    openedAt: Date;
  }): Promise<string> {
    const id = uuid();
    await this.sql`
      INSERT INTO incidents (id, camera_id, roi_id, track_id, classes, opened_at, status)
      VALUES (
        ${id}, ${args.cameraId}::uuid, ${args.roiId}::uuid,
        ${args.trackId}, ${args.classes as unknown as string[]}::text[], ${args.openedAt}, 'open'
      )
    `;
    return id;
  }

  async markSuppressed(incidentId: string): Promise<void> {
    await this.sql`UPDATE incidents SET status = 'suppressed' WHERE id = ${incidentId}::uuid`;
  }

  async close(incidentId: string, closedAt: Date): Promise<void> {
    await this.sql`
      UPDATE incidents SET status = 'closed', closed_at = ${closedAt}
      WHERE id = ${incidentId}::uuid
    `;
  }

  async markNotified(incidentId: string, at: Date): Promise<void> {
    await this.sql`UPDATE incidents SET notified_at = ${at} WHERE id = ${incidentId}::uuid`;
  }

  async addClasses(incidentId: string, classes: string[]): Promise<void> {
    await this.sql`
      UPDATE incidents
         SET classes = ARRAY(SELECT DISTINCT unnest(classes || ${classes as unknown as string[]}::text[]))
       WHERE id = ${incidentId}::uuid
    `;
  }

  async loadOpen(): Promise<IncidentRow[]> {
    return await this.sql<IncidentRow[]>`
      SELECT id, camera_id AS "cameraId", roi_id AS "roiId", track_id AS "trackId",
             classes, opened_at AS "openedAt", closed_at AS "closedAt", status
      FROM incidents WHERE status = 'open'
    `;
  }
}

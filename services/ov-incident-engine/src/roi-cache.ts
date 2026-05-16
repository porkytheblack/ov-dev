import postgres from "postgres";
import type { DetectionWindow, Polygon } from "./matching/geometry.js";
import { normalizePolygon, normalizeWindow } from "./matching/geometry.js";

export type RoiRow = {
  id: string;
  cameraId: string;
  name: string;
  polygon: Polygon;
  classesOfInterest: string[];
  matchMode: "centroid" | "iou";
  detectionWindow: DetectionWindow;
  lingerThresholdSeconds: number;
  notifyEnabled: boolean;
};

export class RoiCache {
  private byCamera = new Map<string, RoiRow[]>();
  private sql: ReturnType<typeof postgres>;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, { max: 4 });
  }

  async reload(cameraId?: string): Promise<void> {
    const rows = cameraId
      ? await this.sql<RoiRow[]>`
          SELECT id, camera_id AS "cameraId", name, polygon,
                 classes_of_interest AS "classesOfInterest",
                 match_mode AS "matchMode",
                 detection_window AS "detectionWindow",
                 linger_threshold_seconds AS "lingerThresholdSeconds",
                 notify_enabled AS "notifyEnabled"
          FROM rois WHERE camera_id = ${cameraId}::uuid
        `
      : await this.sql<RoiRow[]>`
          SELECT id, camera_id AS "cameraId", name, polygon,
                 classes_of_interest AS "classesOfInterest",
                 match_mode AS "matchMode",
                 detection_window AS "detectionWindow",
                 linger_threshold_seconds AS "lingerThresholdSeconds",
                 notify_enabled AS "notifyEnabled"
          FROM rois
        `;
    const normalized = rows.map((r) => ({
      ...r,
      polygon: normalizePolygon(r.polygon),
      detectionWindow: normalizeWindow(r.detectionWindow),
    }));
    if (cameraId) {
      this.byCamera.set(cameraId, normalized);
    } else {
      this.byCamera.clear();
      for (const row of normalized) {
        const arr = this.byCamera.get(row.cameraId) ?? [];
        arr.push(row);
        this.byCamera.set(row.cameraId, arr);
      }
    }
  }

  forCamera(cameraId: string): RoiRow[] {
    return this.byCamera.get(cameraId) ?? [];
  }

  async listen(onChange: (cameraId: string) => Promise<void>): Promise<void> {
    // Postgres LISTEN/NOTIFY for live ROI changes.
    await this.sql.listen("roi_changed", async (payload) => {
      if (payload) await onChange(payload);
    });
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}

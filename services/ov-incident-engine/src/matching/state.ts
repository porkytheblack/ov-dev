/**
 * In-memory open-incident registry. Built fresh on boot from the DB and updated
 * by each FrameDetections event.
 */
// One incident represents a continuous span of activity in a zone. It is
// keyed by (camera, roi) ONLY — never by track_id. Trackers churn ids for the
// same object (and often emit none), which previously fragmented a single
// walk-through into a pile of short, separately-keyed incidents.
export type OpenIncidentKey = string; // `${cameraId}:${roiId}`

export type OpenIncident = {
  incidentId: string;
  cameraId: string;
  roiId: string;
  trackId: string | null;
  classes: Set<string>;
  openedAt: Date;
  lastSeenAt: Date;
  notifyPending: boolean;
  lingerThresholdSeconds: number;
  notifyEnabled: boolean;
};

export class OpenIncidents {
  private map = new Map<OpenIncidentKey, OpenIncident>();

  static key(cameraId: string, roiId: string): OpenIncidentKey {
    return `${cameraId}:${roiId}`;
  }

  get(key: OpenIncidentKey): OpenIncident | undefined {
    return this.map.get(key);
  }

  set(key: OpenIncidentKey, incident: OpenIncident): void {
    this.map.set(key, incident);
  }

  delete(key: OpenIncidentKey): void {
    this.map.delete(key);
  }

  entries(): IterableIterator<[OpenIncidentKey, OpenIncident]> {
    return this.map.entries();
  }

  size(): number {
    return this.map.size;
  }
}

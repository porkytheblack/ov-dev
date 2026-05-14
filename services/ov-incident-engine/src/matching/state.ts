/**
 * In-memory open-incident registry. Built fresh on boot from the DB and updated
 * by each FrameDetections event.
 */
export type OpenIncidentKey = string; // `${cameraId}:${roiId}:${trackId|untracked}`

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

  static key(cameraId: string, roiId: string, trackId?: string | null): OpenIncidentKey {
    return `${cameraId}:${roiId}:${trackId ?? "untracked"}`;
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

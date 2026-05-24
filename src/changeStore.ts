import { randomUUID } from 'node:crypto';

export type WorkspaceChangeEventType = 'add' | 'change' | 'unlink';

export type WorkspaceChangeRecord = {
  id: string;
  filePath: string;
  extension: string;
  timestamp: number;
  eventType: WorkspaceChangeEventType;
  repoRoot?: string | null;
};

export class WorkspaceChangeStore {
  private records: WorkspaceChangeRecord[] = [];

  constructor(private readonly maxRecords = 500) {}

  add(record: Omit<WorkspaceChangeRecord, 'id'>) {
    this.records.push({
      ...record,
      id: randomUUID()
    });

    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
  }

  getRecent(limit: number) {
    const clamped = Math.max(1, Math.min(limit, this.records.length));
    return this.records.slice(-clamped).reverse();
  }

  getAll() {
    return [...this.records];
  }
}

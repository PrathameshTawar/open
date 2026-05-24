export type AgentTaskRecord = {
  id: string;
  goalSummary: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  relatedFiles?: string[];
  executionSteps?: string[];
  reasoningSummary?: string;
  startedAt?: number;
  finishedAt?: number;
};

function truncate(value: string, maxChars = 2000) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...[truncated]`;
}

function sanitizeSummary(value?: string) {
  if (!value) return undefined;
  return truncate(value.replace(/\s+/g, ' ').trim());
}

export class AgentTaskStore {
  private records: AgentTaskRecord[] = [];
  private readonly maxRecords: number;

  constructor(opts?: { maxRecords?: number }) {
    this.maxRecords = opts?.maxRecords ?? 200;
  }

  add(record: AgentTaskRecord) {
    this.records.push({
      ...record,
      goalSummary: truncate(record.goalSummary.replace(/\s+/g, ' ').trim()),
      reasoningSummary: sanitizeSummary(record.reasoningSummary),
      relatedFiles: record.relatedFiles?.slice(0, 50),
      executionSteps: record.executionSteps?.map((step) => truncate(step.replace(/\s+/g, ' ').trim())).slice(0, 50)
    });

    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
  }

  getRecent(limit: number) {
    const l = Math.max(1, Math.min(limit, this.records.length));
    return this.records.slice(-l).reverse();
  }
}


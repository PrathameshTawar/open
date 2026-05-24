function truncate(value, maxChars = 2000) {
    if (value.length <= maxChars)
        return value;
    return `${value.slice(0, maxChars)}...[truncated]`;
}
function sanitizeSummary(value) {
    if (!value)
        return undefined;
    return truncate(value.replace(/\s+/g, ' ').trim());
}
export class AgentTaskStore {
    records = [];
    maxRecords;
    constructor(opts) {
        this.maxRecords = opts?.maxRecords ?? 200;
    }
    add(record) {
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
    getRecent(limit) {
        const l = Math.max(1, Math.min(limit, this.records.length));
        return this.records.slice(-l).reverse();
    }
}

function maskSecrets(value) {
    const patterns = [
        /(?:api[-_ ]?key|token|secret|password|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi,
        /(?:bearer\s+)[a-z0-9._-]+/gi
    ];
    let sanitized = value;
    for (const pattern of patterns) {
        sanitized = sanitized.replace(pattern, '[redacted]');
    }
    return sanitized;
}
function truncate(value, maxChars = 4000) {
    if (value.length <= maxChars)
        return value;
    return `${value.slice(0, maxChars)}...[truncated]`;
}
function summarizeValue(value) {
    if (!value)
        return undefined;
    return truncate(maskSecrets(value.replace(/\s+/g, ' ').trim()));
}
export class ToolExecutionStore {
    records = [];
    maxRecords;
    constructor(opts) {
        this.maxRecords = opts?.maxRecords ?? 200;
    }
    add(record) {
        this.records.push({
            ...record,
            summarizedArguments: summarizeValue(record.summarizedArguments),
            summarizedResult: summarizeValue(record.summarizedResult),
            affectedFiles: record.affectedFiles?.slice(0, 50)
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

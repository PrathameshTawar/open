import { randomUUID } from 'node:crypto';
export class WorkspaceChangeStore {
    maxRecords;
    records = [];
    constructor(maxRecords = 500) {
        this.maxRecords = maxRecords;
    }
    add(record) {
        this.records.push({
            ...record,
            id: randomUUID()
        });
        if (this.records.length > this.maxRecords) {
            this.records.splice(0, this.records.length - this.maxRecords);
        }
    }
    getRecent(limit) {
        const clamped = Math.max(1, Math.min(limit, this.records.length));
        return this.records.slice(-clamped).reverse();
    }
    getAll() {
        return [...this.records];
    }
}

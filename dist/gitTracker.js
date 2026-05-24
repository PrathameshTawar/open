import simpleGit from 'simple-git';
import path from 'node:path';
function toError(e) {
    return e instanceof Error ? e.message : 'Unknown error';
}
export class GitTracker {
    repoRoot;
    git;
    constructor(repoRoot) {
        this.repoRoot = repoRoot;
        this.git = simpleGit(repoRoot);
    }
    static async tryCreate(repoRoot) {
        try {
            const git = simpleGit(repoRoot);
            const isRepo = await git.checkIsRepo();
            if (!isRepo)
                return null;
            return new GitTracker(repoRoot);
        }
        catch {
            return null;
        }
    }
    async getLatestCommit() {
        try {
            const log = await this.git.log({ maxCount: 1 });
            const item = log.latest;
            if (!item)
                return { ok: false, error: 'No git commits found' };
            return { ok: true, commitSha: item.hash, date: item.date };
        }
        catch (e) {
            return { ok: false, error: toError(e) };
        }
    }
    async getChangedFiles() {
        try {
            const diff = await this.git.diff(['--name-only']);
            return diff
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean);
        }
        catch (e) {
            return { ok: false, error: toError(e) };
        }
    }
    async getCurrentDiff(maxChars = 60_000) {
        try {
            const diffText = await this.git.diff();
            const changedFiles = await this.getChangedFiles();
            const files = Array.isArray(changedFiles) ? changedFiles : [];
            return {
                ok: true,
                diff: diffText.length > maxChars ? diffText.slice(0, maxChars) + '\n...[truncated]' : diffText,
                changedFiles: files.map((f) => path.normalize(f))
            };
        }
        catch (e) {
            return { ok: false, error: toError(e) };
        }
    }
}

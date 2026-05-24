import { getProjectTree, safeReadFile } from './safeFs.js';
import { searchCode } from './codeSearch.js';
import { GitTracker } from './gitTracker.js';
import { WorkspaceChangeStore } from './changeStore.js';
import { discoverArtifacts } from './artifactDiscovery.js';
export function createWorkspaceTools(opts) {
    const { cfg, agentTasks, toolExecutions } = opts;
    const changes = opts.changes ?? new WorkspaceChangeStore();
    const clampLimit = (limit, fallback = 10) => {
        if (!Number.isFinite(limit) || limit <= 0) {
            return fallback;
        }
        return Math.min(100, Math.floor(limit));
    };
    return {
        listProjects: () => cfg.allowedRoots.map((r) => r),
        getWorkspaceTree: async (root) => getProjectTree(root, cfg),
        readWorkspaceFile: async (filePath) => safeReadFile(filePath, cfg),
        searchWorkspaceCode: async (query) => searchCode(query, cfg),
        getRecentWorkspaceChanges: (limit) => changes.getRecent(clampLimit(limit, 10)),
        getRecentToolExecutions: (limit) => toolExecutions.getRecent(clampLimit(limit, 10)),
        getRecentAgentTasks: (limit) => agentTasks.getRecent(clampLimit(limit, 10)),
        getRecentArtifacts: async (limit) => {
            const artifacts = await discoverArtifacts(cfg, { limit: clampLimit(limit, 10) });
            return artifacts.slice().reverse();
        },
        getLatestWorkspaceDiff: async () => {
            const repoRoot = cfg.allowedRoots[0] ?? process.cwd();
            const tracker = await GitTracker.tryCreate(repoRoot);
            if (!tracker)
                return { ok: false, error: 'No git repo detected' };
            return tracker.getCurrentDiff();
        },
        getWorkspaceSummary: async () => {
            const repoRoot = cfg.allowedRoots[0] ?? process.cwd();
            const tracker = await GitTracker.tryCreate(repoRoot);
            const latestCommit = tracker ? await tracker.getLatestCommit() : { ok: false, error: 'No git repo detected' };
            const latestDiff = tracker ? await tracker.getCurrentDiff() : { ok: false, error: 'No git repo detected' };
            const artifacts = await discoverArtifacts(cfg, { limit: 10 });
            return {
                ok: true,
                allowedRoots: cfg.allowedRoots,
                recentChanges: changes.getRecent(5),
                recentToolExecutions: toolExecutions.getRecent(5),
                recentAgentTasks: agentTasks.getRecent(5),
                latestCommit,
                latestDiff,
                recentArtifacts: artifacts.slice().reverse(),
                watchedRoots: cfg.allowedRoots
            };
        }
    };
}

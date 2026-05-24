import chokidar from 'chokidar';
import path from 'node:path';
import { isAllowedPath } from './safeFs.js';
import { GitTracker } from './gitTracker.js';
function isBlockedFilePath(filePath, cfg) {
    const normalized = path.normalize(filePath);
    const baseName = path.basename(normalized).toLowerCase();
    const ext = path.extname(normalized).toLowerCase();
    if (cfg.blockedFileNames.includes(baseName))
        return true;
    return cfg.blockedExts.includes(ext);
}
function isIgnoredPath(filePath, cfg, stats) {
    const normalized = path.normalize(filePath);
    const segments = normalized.split(path.sep).filter(Boolean);
    if (segments.some((segment) => cfg.ignoreDirs.includes(segment))) {
        return true;
    }
    if (stats?.isDirectory()) {
        return false;
    }
    return isBlockedFilePath(normalized, cfg);
}
export class WorkspaceWatcher {
    options;
    watcher = null;
    stopped = false;
    repoRoot = null;
    constructor(options) {
        this.options = options;
    }
    async start() {
        if (this.watcher)
            return;
        this.stopped = false;
        const roots = this.options.cfg.allowedRoots.filter((root) => root && root.trim().length > 0);
        if (roots.length === 0) {
            return;
        }
        const repoRoot = roots[0];
        const tracker = await GitTracker.tryCreate(repoRoot);
        this.repoRoot = tracker ? repoRoot : null;
        const watchTarget = roots.length === 1 ? roots[0] : roots;
        this.watcher = chokidar.watch(watchTarget, {
            ignoreInitial: true,
            usePolling: true,
            interval: 200,
            binaryInterval: 300,
            awaitWriteFinish: {
                stabilityThreshold: Math.max(150, this.options.cfg.maxFileBytes / 1024),
                pollInterval: 50
            }
        });
        const handlePath = (eventType, filePath) => {
            if (this.stopped || !filePath)
                return;
            const resolved = path.resolve(filePath);
            if (!isAllowedPath(resolved, this.options.cfg))
                return;
            if (isIgnoredPath(resolved, this.options.cfg))
                return;
            const extension = path.extname(resolved).toLowerCase();
            this.options.changes.add({
                filePath: resolved,
                extension,
                timestamp: Date.now(),
                eventType,
                repoRoot: this.repoRoot
            });
        };
        this.watcher.on('add', (filePath) => handlePath('add', filePath));
        this.watcher.on('change', (filePath) => handlePath('change', filePath));
        this.watcher.on('unlink', (filePath) => handlePath('unlink', filePath));
        this.watcher.on('error', () => {
            // Keep watcher resilient: log and continue without crashing the process.
            console.warn('[openclaw-reader] watcher error received; continuing safely.');
        });
        await new Promise((resolve) => {
            this.watcher?.once('ready', () => resolve());
            this.watcher?.once('error', () => resolve());
        });
    }
    async stop() {
        this.stopped = true;
        if (!this.watcher)
            return;
        await this.watcher.close();
        this.watcher = null;
    }
}

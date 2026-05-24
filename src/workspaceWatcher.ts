import chokidar, { type FSWatcher } from 'chokidar';
import path from 'node:path';
import type { Stats } from 'node:fs';
import type { OpenclawReaderConfig } from './config.js';
import { isAllowedPath } from './safeFs.js';
import { GitTracker } from './gitTracker.js';
import { WorkspaceChangeStore } from './changeStore.js';

export type WorkspaceWatcherOptions = {
  cfg: OpenclawReaderConfig;
  changes: WorkspaceChangeStore;
};

function isBlockedFilePath(filePath: string, cfg: OpenclawReaderConfig) {
  const normalized = path.normalize(filePath);
  const baseName = path.basename(normalized).toLowerCase();
  const ext = path.extname(normalized).toLowerCase();

  if (cfg.blockedFileNames.includes(baseName)) return true;
  return cfg.blockedExts.includes(ext);
}

function isIgnoredPath(filePath: string, cfg: OpenclawReaderConfig, stats?: Stats) {
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
  private watcher: FSWatcher | null = null;
  private stopped = false;
  private repoRoot: string | null = null;

  constructor(private readonly options: WorkspaceWatcherOptions) {}

  async start() {
    if (this.watcher) return;

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

    const handlePath = (eventType: 'add' | 'change' | 'unlink', filePath?: string) => {
      if (this.stopped || !filePath) return;

      const resolved = path.resolve(filePath);
      if (!isAllowedPath(resolved, this.options.cfg)) return;
      if (isIgnoredPath(resolved, this.options.cfg)) return;

      const extension = path.extname(resolved).toLowerCase();
      this.options.changes.add({
        filePath: resolved,
        extension,
        timestamp: Date.now(),
        eventType,
        repoRoot: this.repoRoot
      });
    };

    this.watcher.on('add', (filePath: string) => handlePath('add', filePath));
    this.watcher.on('change', (filePath: string) => handlePath('change', filePath));
    this.watcher.on('unlink', (filePath: string) => handlePath('unlink', filePath));

    this.watcher.on('error', () => {
      // Keep watcher resilient: log and continue without crashing the process.
      console.warn('[openclaw-reader] watcher error received; continuing safely.');
    });

    await new Promise<void>((resolve) => {
      this.watcher?.once('ready', () => resolve());
      this.watcher?.once('error', () => resolve());
    });
  }

  async stop() {
    this.stopped = true;
    if (!this.watcher) return;
    await this.watcher.close();
    this.watcher = null;
  }
}

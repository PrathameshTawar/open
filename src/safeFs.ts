import fs from 'node:fs';
import path from 'node:path';
import fsExtra from 'fs-extra';
// Some npm registry setups in this environment may not provide @types/fs-extra.
// Keep compilation working by treating it as an untyped module when needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _fsExtra: any = fsExtra;
import type { OpenclawReaderConfig } from './config.js';

export function isAllowedPath(absolutePath: string, cfg: OpenclawReaderConfig): boolean {
  const normalized = path.normalize(absolutePath);
  return cfg.allowedRoots.some((root) => {
    const rootAbs = path.resolve(root);
    const rel = path.relative(rootAbs, normalized);
    // rel will start with .. when outside root; rel === '' allows the root itself.
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  });
}

function isBlockedByName(fileName: string, cfg: OpenclawReaderConfig): boolean {
  return cfg.blockedFileNames.some((b) => b === fileName);
}

function isBlockedByExt(filePath: string, cfg: OpenclawReaderConfig): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return false;
  return cfg.blockedExts.some((b) => b.toLowerCase() === ext);
}

function isIgnoredPath(filePath: string, cfg: OpenclawReaderConfig): boolean {
  const normalized = path.normalize(filePath);
  return normalized.split(path.sep).some((segment) => cfg.ignoreDirs.includes(segment));
}

function isLikelyBinary(buffer: Buffer): boolean {
  // quick heuristic: NUL bytes suggest binary
  const len = Math.min(buffer.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export async function safeReadFile(
  filePath: string,
  cfg: OpenclawReaderConfig
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const abs = path.resolve(filePath);
  if (!isAllowedPath(abs, cfg)) return { ok: false, error: 'Path is outside allowed roots' };
  if (isIgnoredPath(abs, cfg)) return { ok: false, error: 'Ignored path' };

  const base = path.basename(abs);
  if (isBlockedByName(base, cfg)) return { ok: false, error: 'Blocked file name' };
  if (isBlockedByExt(abs, cfg)) return { ok: false, error: 'Blocked file extension' };

  try {
    const stat = await _fsExtra.stat(abs);
    if (stat.size > cfg.maxFileBytes) return { ok: false, error: 'File too large' };

    const buf = await _fsExtra.readFile(abs);

    if (isLikelyBinary(buf)) return { ok: false, error: 'Blocked binary file' };

    const content = buf.toString('utf8');
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function getProjectTree(root: string, cfg: OpenclawReaderConfig) {
  const rootAbs = path.resolve(root);
  if (!isAllowedPath(rootAbs, cfg)) return { ok: false as const, error: 'Root not allowed' };

  const ignore = new Set(cfg.ignoreDirs);

  const walk = async (dir: string) => {
    const entries = await _fsExtra.readdir(dir, { withFileTypes: true });

    const children: Array<{ name: string; type: 'file' | 'dir' }> = [];
    for (const ent of entries) {
      if (ent.isDirectory()) {
        if (ignore.has(ent.name)) continue;
        children.push({ name: ent.name, type: 'dir' });
      } else if (ent.isFile()) {
        children.push({ name: ent.name, type: 'file' });
      }
    }
    return children;
  };

  return {
    ok: true as const,
    root: rootAbs,
    files: await walk(rootAbs)
  };
}


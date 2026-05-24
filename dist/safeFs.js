import path from 'node:path';
import fsExtra from 'fs-extra';
// Some npm registry setups in this environment may not provide @types/fs-extra.
// Keep compilation working by treating it as an untyped module when needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _fsExtra = fsExtra;
export function isAllowedPath(absolutePath, cfg) {
    const normalized = path.normalize(absolutePath);
    return cfg.allowedRoots.some((root) => {
        const rootAbs = path.resolve(root);
        const rel = path.relative(rootAbs, normalized);
        // rel will start with .. when outside root; rel === '' allows the root itself.
        return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    });
}
function isBlockedByName(fileName, cfg) {
    return cfg.blockedFileNames.some((b) => b === fileName);
}
function isBlockedByExt(filePath, cfg) {
    const ext = path.extname(filePath).toLowerCase();
    if (!ext)
        return false;
    return cfg.blockedExts.some((b) => b.toLowerCase() === ext);
}
function isIgnoredPath(filePath, cfg) {
    const normalized = path.normalize(filePath);
    return normalized.split(path.sep).some((segment) => cfg.ignoreDirs.includes(segment));
}
function isLikelyBinary(buffer) {
    // quick heuristic: NUL bytes suggest binary
    const len = Math.min(buffer.length, 8000);
    for (let i = 0; i < len; i++) {
        if (buffer[i] === 0)
            return true;
    }
    return false;
}
export async function safeReadFile(filePath, cfg) {
    const abs = path.resolve(filePath);
    if (!isAllowedPath(abs, cfg))
        return { ok: false, error: 'Path is outside allowed roots' };
    if (isIgnoredPath(abs, cfg))
        return { ok: false, error: 'Ignored path' };
    const base = path.basename(abs);
    if (isBlockedByName(base, cfg))
        return { ok: false, error: 'Blocked file name' };
    if (isBlockedByExt(abs, cfg))
        return { ok: false, error: 'Blocked file extension' };
    try {
        const stat = await _fsExtra.stat(abs);
        if (stat.size > cfg.maxFileBytes)
            return { ok: false, error: 'File too large' };
        const buf = await _fsExtra.readFile(abs);
        if (isLikelyBinary(buf))
            return { ok: false, error: 'Blocked binary file' };
        const content = buf.toString('utf8');
        return { ok: true, content };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}
export async function getProjectTree(root, cfg) {
    const rootAbs = path.resolve(root);
    if (!isAllowedPath(rootAbs, cfg))
        return { ok: false, error: 'Root not allowed' };
    const ignore = new Set(cfg.ignoreDirs);
    const walk = async (dir) => {
        const entries = await _fsExtra.readdir(dir, { withFileTypes: true });
        const children = [];
        for (const ent of entries) {
            if (ent.isDirectory()) {
                if (ignore.has(ent.name))
                    continue;
                children.push({ name: ent.name, type: 'dir' });
            }
            else if (ent.isFile()) {
                children.push({ name: ent.name, type: 'file' });
            }
        }
        return children;
    };
    return {
        ok: true,
        root: rootAbs,
        files: await walk(rootAbs)
    };
}

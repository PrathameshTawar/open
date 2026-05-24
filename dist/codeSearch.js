import fg from 'fast-glob';
import { safeReadFile } from './safeFs.js';
function isTextLikely(content) {
    // crude heuristic; still relying on safeReadFile binary blocking
    return true;
}
export async function searchCode(query, cfg, opts) {
    const q = query.trim();
    if (!q)
        return { ok: false, error: 'Empty query' };
    const limit = opts?.limit ?? cfg.maxSearchResults;
    const roots = opts?.roots ?? cfg.allowedRoots;
    // Avoid regex injection: treat query as plain text.
    const ignoreDirs = new Set(cfg.ignoreDirs);
    try {
        const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.json', '**/*.md', '**/*.txt'];
        const found = [];
        for (const root of roots) {
            if (found.length >= limit)
                break;
            const globbed = await fg(patterns, {
                cwd: root,
                ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', ...Array.from(ignoreDirs).map((d) => `${d}/**`)],
                onlyFiles: true,
                absolute: true
            });
            for (const absFile of globbed) {
                if (found.length >= limit)
                    break;
                const read = await safeReadFile(absFile, cfg);
                if (!read.ok)
                    continue;
                if (!isTextLikely(read.content))
                    continue;
                const lines = read.content.split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) {
                    const idx = lines[i].indexOf(q);
                    if (idx !== -1) {
                        const start = Math.max(0, idx - 40);
                        const end = Math.min(lines[i].length, idx + q.length + 60);
                        found.push({
                            filePath: absFile,
                            line: i + 1,
                            snippet: lines[i].slice(start, end)
                        });
                        if (found.length >= limit)
                            break;
                    }
                }
            }
        }
        return { ok: true, results: found.slice(0, limit) };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
}

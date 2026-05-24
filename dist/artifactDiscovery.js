import path from 'node:path';
import fg from 'fast-glob';
import { randomUUID } from 'node:crypto';
import { safeReadFile } from './safeFs.js';
function inferArtifactType(filePath) {
    const name = path.basename(filePath).toLowerCase();
    if (/task|agent|goal|prompt|reason/i.test(name)) {
        return 'agent-task-artifact';
    }
    if (/log|trace|history|output|run/i.test(name)) {
        return 'execution-artifact';
    }
    return 'workspace-artifact';
}
function extractTimestamp(content) {
    const isoMatch = content.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/i);
    if (isoMatch) {
        const parsed = Date.parse(isoMatch[0]);
        if (!Number.isNaN(parsed))
            return parsed;
    }
    const dateMatch = content.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\b/);
    if (dateMatch) {
        const parsed = Date.parse(dateMatch[0]);
        if (!Number.isNaN(parsed))
            return parsed;
    }
    return undefined;
}
function extractSummary(content) {
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const focusLine = lines.find((line) => /goal|task|prompt|summary|reason|result|status/i.test(line));
    const firstLine = lines[0];
    const executionTrace = lines.slice(0, 8).join(' ');
    return {
        taskGoalSummary: focusLine ?? firstLine,
        executionTraceSummary: executionTrace
    };
}
export async function discoverArtifacts(cfg, opts) {
    const roots = opts?.roots ?? cfg.allowedRoots;
    const limit = opts?.limit ?? cfg.maxSearchResults;
    const candidates = new Set();
    for (const root of roots) {
        const pattern = ['**/*.{json,md,txt,log,trace}'];
        const found = await fg(pattern, {
            cwd: root,
            absolute: true,
            ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
            onlyFiles: true
        });
        for (const file of found) {
            const name = path.basename(file).toLowerCase();
            if (/(\.env|\.pem|\.key|credentials\.json|token\.json|id_rsa)$/i.test(name))
                continue;
            if (/task|agent|history|trace|log|output/i.test(name)) {
                candidates.add(file);
            }
        }
    }
    const artifacts = [];
    for (const filePath of Array.from(candidates)) {
        if (artifacts.length >= limit)
            break;
        const safe = await safeReadFile(filePath, cfg);
        if (!safe.ok)
            continue;
        const { taskGoalSummary, executionTraceSummary } = extractSummary(safe.content);
        const timestamp = extractTimestamp(safe.content);
        artifacts.push({
            id: randomUUID(),
            filePath,
            artifactType: inferArtifactType(filePath),
            timestamp,
            relatedFiles: [filePath],
            taskGoalSummary,
            executionTraceSummary
        });
    }
    return artifacts;
}

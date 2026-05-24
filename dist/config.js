import fs from 'node:fs';
import path from 'node:path';
const DEFAULTS = {
    allowedRoots: [process.cwd()],
    blockedFileNames: [
        '.env',
        '.pem',
        '.key',
        'credentials.json',
        'token.json',
        'id_rsa'
    ],
    blockedExts: [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp',
        '.pdf',
        '.zip',
        '.7z',
        '.rar',
        '.exe',
        '.dll',
        '.so',
        '.dylib',
        '.bin'
    ],
    ignoreDirs: ['node_modules', '.git', 'dist', 'build'],
    maxFileBytes: 1024 * 1024, // 1 MiB
    maxSearchResults: 50,
    maxOutputChars: 32_000
};
export function loadConfig(configPath) {
    const resolved = configPath ? path.resolve(configPath) : undefined;
    if (resolved && fs.existsSync(resolved)) {
        const raw = fs.readFileSync(resolved, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULTS,
            ...parsed,
            allowedRoots: parsed.allowedRoots ?? DEFAULTS.allowedRoots
        };
    }
    return DEFAULTS;
}

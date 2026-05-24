import fs from 'node:fs';
import path from 'node:path';

export type OpenclawReaderConfig = {
  allowedRoots: string[];
  blockedFileNames: string[];
  blockedExts: string[];
  ignoreDirs: string[];
  maxFileBytes: number;
  maxSearchResults: number;
  maxOutputChars: number;
};

const DEFAULTS: OpenclawReaderConfig = {
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

export function loadConfig(configPath?: string): OpenclawReaderConfig {
  const resolved = configPath ? path.resolve(configPath) : undefined;
  if (resolved && fs.existsSync(resolved)) {
    const raw = fs.readFileSync(resolved, 'utf8');
    const parsed = JSON.parse(raw) as Partial<OpenclawReaderConfig>;
    return {
      ...DEFAULTS,
      ...parsed,
      allowedRoots: parsed.allowedRoots ?? DEFAULTS.allowedRoots
    };
  }
  return DEFAULTS;
}


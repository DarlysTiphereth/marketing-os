// Cloud-first / local-light configuration. Everything the control plane writes locally lives under MOS_HOME
// (default <repo>/.mos, gitignored). Paths outside it are never modified except explicitly allowlisted leaks.
import {mkdirSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GITHUB_REPO = process.env.MOS_GITHUB_REPO ?? 'DarlysTiphereth/marketing-os';

export function mosHome() { return path.resolve(process.env.MOS_HOME ?? path.join(REPO, '.mos')); }

const num = (v: string | undefined, d: number) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
export const LIMITS = {
  cacheMaxBytes: num(process.env.MOS_CACHE_MAX_BYTES, 1_500_000_000), // bundles + reusable caches
  tmpTtlHours: num(process.env.MOS_TMP_TTL_HOURS, 24),
  cacheTtlDays: num(process.env.MOS_CACHE_TTL_DAYS, 14),
  candidateTtlDays: num(process.env.MOS_CANDIDATE_TTL_DAYS, 30), // unapproved finals
  quarantineDays: num(process.env.MOS_QUARANTINE_DAYS, 7),
  maxConcurrency: num(process.env.MOS_MAX_CONCURRENCY, 1),
  maxAttempts: num(process.env.MOS_MAX_ATTEMPTS, 3), // 1 try + 2 retries
  localFrameConcurrency: num(process.env.MOS_LOCAL_FRAME_CONCURRENCY, 2),
};

// Directories outside MOS_HOME that this project is known to leak into and may clean (only with approval).
export const ALLOWLISTED_EXTERNAL = [
  {dir: os.tmpdir(), pattern: /^remotion-webpack-bundle-/, reason: 'Remotion bundle() default outDir (leaked by Benchmark 001 runs)'},
  {dir: os.tmpdir(), pattern: /^puppeteer_dev_chrome_profile-/, reason: 'Chrome profile left by Remotion headless browser (~2–3 MB per run)'},
  {dir: os.tmpdir(), pattern: /^mos-test-/, reason: 'MOS_HOME of an interrupted ops test run'},
];

export function managed(...parts: string[]) {
  const home = mosHome();
  const p = path.resolve(home, ...parts);
  if (p !== home && !p.startsWith(home + path.sep)) throw new Error(`path escapes MOS_HOME: ${parts.join('/')}`);
  return p;
}

export function ensureLayout() {
  for (const d of ['store/objects', 'tmp', 'cache/bundles', 'quarantine', 'queue/jobs', 'logs', 'runs']) mkdirSync(managed(d), {recursive: true});
}

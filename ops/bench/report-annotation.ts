// Emits a single ::notice:: annotation "MOS_METRICS {json}" so the control plane can read results through the
// public GitHub API without a token (annotations are public on public repositories; artifacts need auth).
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {managed} from '../config.ts';

const job = process.argv[2] ?? '';
const summaryFile = managed('runs', `${job}.json`);
const summary = existsSync(summaryFile) ? JSON.parse(readFileSync(summaryFile, 'utf8')) as Record<string, unknown> : {};
const logs = readdirSync(managed('logs')).filter((f) => f.startsWith('measure-')).sort();
const m = logs.length ? JSON.parse(readFileSync(managed('logs', logs.at(-1)!), 'utf8')) as Record<string, unknown> : {};
const metrics = {
  job_id: job, output_sha256: summary.output_sha256, output_bytes: summary.output_bytes, qc_verdict: summary.qc_verdict,
  runner: {wall_s: m.wall_s, ram_peak_bytes: m.ram_peak_bytes, cpu_seconds: m.cpu_seconds, cpus: m.cpus, exit_code: m.exit_code, platform: m.platform},
};
console.log(`::notice title=MOS_METRICS::MOS_METRICS ${JSON.stringify(metrics)}`);

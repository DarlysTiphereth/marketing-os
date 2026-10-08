// Runs a command and measures what it costs THIS machine: process-tree RAM (sum of working sets), CPU seconds,
// GPU engine utilization (Windows perf counters), wall time, and disk growth of watched dirs.
// Usage: node ops/bench/measure.ts --label A-local --watch <dir> [--watch <dir>] -- <command> [args...]
import {spawn, spawnSync} from 'node:child_process';
import {existsSync, lstatSync, readdirSync, writeFileSync, mkdirSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {managed} from '../config.ts';

type Proc = {pid: number; ppid: number; rss: number; cpu_s: number; name: string};
// Entries never attributed to the measured command (e.g. the Claude Code session's own temp folder).
const EXCLUDE = new RegExp(process.env.MOS_MEASURE_EXCLUDE ?? '^claude$');

function dirBytes(p: string): number {
  if (!existsSync(p)) return 0;
  const st = lstatSync(p);
  if (st.isSymbolicLink()) return 0;
  if (!st.isDirectory()) return st.size;
  let n = 0;
  for (const f of readdirSync(p)) { if (EXCLUDE.test(f)) continue; try { n += dirBytes(path.join(p, f)); } catch { /* vanished while scanning */ } }
  return n;
}

// Windows sampler: one long-lived PowerShell emitting one JSON line per sample (process table + GPU engine %).
const PS = `
$ErrorActionPreference='SilentlyContinue'
while ($true) {
  $p = Get-CimInstance Win32_Process | ForEach-Object { '{0},{1},{2},{3},{4}' -f $_.ProcessId,$_.ParentProcessId,$_.WorkingSetSize,($_.KernelModeTime + $_.UserModeTime),$_.Name }
  $g = (Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -ErrorAction SilentlyContinue).CounterSamples | Where-Object { $_.CookedValue -gt 0 } | ForEach-Object { '{0}={1}' -f $_.InstanceName,[math]::Round($_.CookedValue,2) }
  [Console]::Out.WriteLine((@{t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); p=@($p); g=@($g)} | ConvertTo-Json -Compress -Depth 3))
  Start-Sleep -Milliseconds 1500
}`;

function sampleLinux(): {p: Proc[]; g: string[]} {
  const r = spawnSync('ps', ['-eo', 'pid=,ppid=,rss=,cputimes=,comm='], {encoding: 'utf8'});
  const p = r.stdout.trim().split('\n').map((l) => l.trim().split(/\s+/)).map(([pid, ppid, rss, cpu, ...name]) => ({pid: +pid!, ppid: +ppid!, rss: +rss! * 1024, cpu_s: +cpu!, name: name.join(' ')}));
  return {p, g: []};
}

function tree(all: Proc[], root: number) {
  const kids = new Map<number, Proc[]>();
  for (const x of all) kids.set(x.ppid, [...(kids.get(x.ppid) ?? []), x]);
  const out: Proc[] = [], stack = [root];
  while (stack.length) { const id = stack.pop()!; const self = all.find((x) => x.pid === id); if (self) out.push(self); for (const k of kids.get(id) ?? []) if (k.pid !== id) stack.push(k.pid); }
  return out;
}

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 0) throw new Error('usage: measure.ts --label X [--watch dir]... -- command args');
const opts = argv.slice(0, sep), cmd = argv.slice(sep + 1);
const label = opts[opts.indexOf('--label') + 1] ?? 'run';
const watch = opts.flatMap((o, i) => (o === '--watch' ? [path.resolve(opts[i + 1]!)] : []));

const diskBefore = Object.fromEntries(watch.map((d) => [d, dirBytes(d)]));
const t0 = Date.now();
const child = spawn(cmd[0]!, cmd.slice(1), {stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true});
const samples: {t: number; rss: number; procs: number; gpu_pct: number}[] = [];
const cpuByPid = new Map<number, number>();
const names = new Set<string>();

function ingest(t: number, all: Proc[], gpu: string[]) {
  const tr = tree(all, child.pid!);
  for (const x of tr) { cpuByPid.set(x.pid, Math.max(cpuByPid.get(x.pid) ?? 0, x.cpu_s)); names.add(x.name); }
  const pids = new Set(tr.map((x) => x.pid));
  const gpu_pct = gpu.reduce((n, s) => { const m = s.match(/pid_(\d+)_.*=([\d.]+)$/); return m && pids.has(+m[1]!) ? n + +m[2]! : n; }, 0);
  samples.push({t: t - t0, rss: tr.reduce((n, x) => n + x.rss, 0), procs: tr.length, gpu_pct});
}

let ps: ReturnType<typeof spawn> | null = null, timer: NodeJS.Timeout | null = null;
if (process.platform === 'win32') {
  ps = spawn('powershell.exe', ['-NoProfile', '-Command', PS], {stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true});
  let buf = '';
  ps.stdout!.on('data', (d: Buffer) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('{')) continue;
      try {
        const j = JSON.parse(line) as {t: number; p: string[]; g: string[]};
        const all = j.p.map((s) => s.split(',')).map(([pid, ppid, ws, cpu, ...n]) => ({pid: +pid!, ppid: +ppid!, rss: +ws!, cpu_s: +cpu! / 1e7, name: n.join(',')}));
        ingest(j.t, all, j.g ?? []);
      } catch { /* partial line */ }
    }
  });
} else {
  timer = setInterval(() => { const s = sampleLinux(); ingest(Date.now(), s.p, s.g); }, 1000);
}

const code: number = await new Promise((r) => child.on('exit', (c) => r(c ?? 1)));
const wall = (Date.now() - t0) / 1000;
ps?.kill(); if (timer) clearInterval(timer);
const diskAfter = Object.fromEntries(watch.map((d) => [d, dirBytes(d)]));
const peak = samples.reduce((m, s) => Math.max(m, s.rss), 0);
const cpu = [...cpuByPid.values()].reduce((n, x) => n + x, 0);
const result = {
  label, command: cmd.map((c) => (c.includes(path.sep) ? path.basename(c) : c)).join(' '), exit_code: code, platform: `${os.platform()} ${os.release()}`, cpus: os.cpus().length, total_ram_bytes: os.totalmem(),
  wall_s: +wall.toFixed(2), samples: samples.length, sample_interval_s: process.platform === 'win32' ? 1.5 : 1,
  ram_peak_bytes: peak, ram_avg_bytes: Math.round(samples.reduce((n, s) => n + s.rss, 0) / Math.max(1, samples.length)),
  cpu_seconds: +cpu.toFixed(2), cpu_avg_pct_of_machine: +(cpu / wall / os.cpus().length * 100).toFixed(1),
  gpu_peak_pct: Math.max(0, ...samples.map((s) => s.gpu_pct)), gpu_avg_pct: +(samples.reduce((n, s) => n + s.gpu_pct, 0) / Math.max(1, samples.length)).toFixed(2),
  processes_seen: [...names].sort(), peak_processes: Math.max(0, ...samples.map((s) => s.procs)),
  disk_delta_bytes: Object.fromEntries(watch.map((d) => [d, diskAfter[d]! - diskBefore[d]!])),
  method: 'process-tree sampling (Win32_Process / ps). CPU of processes that exit between samples is undercounted; GPU from Windows GPU Engine counters.',
};
mkdirSync(managed('logs'), {recursive: true});
const out = managed('logs', `measure-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(out, JSON.stringify({...result, timeline: samples}, null, 2) + '\n');
console.log(JSON.stringify(result));
process.exitCode = code;

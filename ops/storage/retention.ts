// Retention: plan (always dry) -> apply (moves to quarantine, reversible, needs approval) -> purge (irreversible,
// needs a separate explicit approval and only touches quarantine batches older than LIMITS.quarantineDays).
import {existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, cpSync} from 'node:fs';
import path from 'node:path';
import {ALLOWLISTED_EXTERNAL, LIMITS, managed, mosHome} from '../config.ts';
import {Cas, type ObjectEntry} from './cas.ts';

export type Action = {kind: 'tmp' | 'bundle' | 'object' | 'external'; path: string; bytes: number; reason: string; sha256?: string; entry?: ObjectEntry};
export type Plan = {created_at: string; actions: Action[]; protected: {path: string; reason: string}[]; total_bytes: number};

const H = 3600_000, D = 24 * H;

function dirBytes(p: string): number {
  const st = lstatSync(p);
  if (st.isSymbolicLink()) return 0;
  if (!st.isDirectory()) return st.size;
  return readdirSync(p).reduce((n, f) => n + dirBytes(path.join(p, f)), 0);
}

export function plan(opts: {now?: number; includeExternal?: boolean} = {}): Plan {
  const now = opts.now ?? Date.now();
  const actions: Action[] = [], prot: Plan['protected'] = [];
  const age = (p: string) => now - statSync(p).mtimeMs;

  // 1. tmp: anything older than the TTL.
  const tmp = managed('tmp');
  if (existsSync(tmp)) for (const f of readdirSync(tmp)) {
    const p = path.join(tmp, f);
    if (age(p) > LIMITS.tmpTtlHours * H) actions.push({kind: 'tmp', path: p, bytes: dirBytes(p), reason: `tmp older than ${LIMITS.tmpTtlHours}h`});
  }

  // 2. bundle cache: TTL, then LRU until under the size cap.
  const bdir = managed('cache', 'bundles');
  if (existsSync(bdir)) {
    const bundles = readdirSync(bdir).map((f) => ({p: path.join(bdir, f), m: statSync(path.join(bdir, f)).mtimeMs})).sort((a, b) => a.m - b.m);
    let total = bundles.reduce((n, b) => n + dirBytes(b.p), 0);
    for (const b of bundles) {
      const bytes = dirBytes(b.p);
      if (now - b.m > LIMITS.cacheTtlDays * D) { actions.push({kind: 'bundle', path: b.p, bytes, reason: `cache older than ${LIMITS.cacheTtlDays}d`}); total -= bytes; }
      else if (total > LIMITS.cacheMaxBytes) { actions.push({kind: 'bundle', path: b.p, bytes, reason: `cache over ${LIMITS.cacheMaxBytes} bytes (LRU)`}); total -= bytes; }
    }
  }

  // 3. CAS objects: approved and pinned are never touched.
  const cas = new Cas();
  for (const e of Object.values(cas.load().objects)) {
    const p = cas.objectPath(e.sha256, e.ext);
    if (e.approved || e.pinned) { prot.push({path: p, reason: e.approved ? 'approved' : 'pinned'}); continue; }
    const idle = now - Date.parse(e.last_access);
    const classes = new Set(e.refs.map((r) => r.class));
    const ttl = classes.has('candidate') ? LIMITS.candidateTtlDays * D : classes.has('cache') ? LIMITS.cacheTtlDays * D : LIMITS.tmpTtlHours * H;
    if (idle > ttl) actions.push({kind: 'object', path: p, bytes: e.bytes, sha256: e.sha256, entry: e, reason: `${[...classes].join('+')} idle > ttl`});
  }

  // 4. Known external leaks (opt-in listing only).
  if (opts.includeExternal) for (const x of ALLOWLISTED_EXTERNAL) {
    if (!existsSync(x.dir)) continue;
    for (const f of readdirSync(x.dir)) if (x.pattern.test(f)) {
      const p = path.join(x.dir, f);
      if (age(p) > LIMITS.tmpTtlHours * H) actions.push({kind: 'external', path: p, bytes: dirBytes(p), reason: x.reason});
    }
  }
  return {created_at: new Date(now).toISOString(), actions, protected: prot, total_bytes: actions.reduce((n, a) => n + a.bytes, 0)};
}

function assertSafe(a: Action) {
  const home = mosHome();
  const inside = a.path.startsWith(home + path.sep);
  const external = ALLOWLISTED_EXTERNAL.some((x) => path.dirname(a.path) === path.resolve(x.dir) && x.pattern.test(path.basename(a.path)));
  if (!inside && !external) throw new Error(`refusing to touch path outside managed roots: ${a.path}`);
  if (a.path.startsWith(managed('quarantine'))) throw new Error('refusing to re-quarantine quarantine');
  if (lstatSync(a.path).isSymbolicLink()) throw new Error(`refusing symlink: ${a.path}`);
}

// Reversible: moves everything into quarantine/<batch>/ and writes restore.json.
export function apply(p: Plan, opts: {approve: boolean}) {
  if (!opts.approve) throw new Error('apply requires explicit approval (--approve). Run `plan` first to review.');
  const batch = new Date().toISOString().replace(/[:.]/g, '-');
  const qdir = managed('quarantine', batch);
  mkdirSync(qdir, {recursive: true});
  const cas = new Cas();
  const moved: {from: string; to: string; bytes: number; entry?: ObjectEntry}[] = [];
  for (const [i, a] of p.actions.entries()) {
    if (!existsSync(a.path)) continue;
    assertSafe(a);
    if (a.sha256 && (cas.load().objects[a.sha256]?.approved || cas.load().objects[a.sha256]?.pinned)) continue; // re-check at apply time
    const to = path.join(qdir, `${String(i).padStart(4, '0')}_${path.basename(a.path)}`);
    try { renameSync(a.path, to); } catch { cpSync(a.path, to, {recursive: true}); rmSync(a.path, {recursive: true, force: true}); } // cross-volume (e.g. %TEMP% on another drive)
    if (a.sha256) cas.forget(a.sha256);
    moved.push({from: a.path, to, bytes: a.bytes, ...(a.entry ? {entry: a.entry} : {})});
  }
  writeFileSync(path.join(qdir, 'restore.json'), JSON.stringify({batch, created_at: new Date().toISOString(), moved}, null, 2) + '\n');
  return {batch, moved: moved.length, bytes: moved.reduce((n, m) => n + m.bytes, 0), quarantine: qdir};
}

export function restore(batch: string) {
  const qdir = managed('quarantine', batch);
  const r = JSON.parse(readFileSync(path.join(qdir, 'restore.json'), 'utf8')) as {moved: {from: string; to: string; entry?: ObjectEntry}[]};
  const cas = new Cas();
  for (const m of r.moved) {
    if (existsSync(m.from)) throw new Error(`restore target exists: ${m.from}`);
    mkdirSync(path.dirname(m.from), {recursive: true});
    renameSync(m.to, m.from);
    if (m.entry) cas.restore(m.entry);
  }
  rmSync(path.join(qdir, 'restore.json'));
  return r.moved.length;
}

// Irreversible. Separate flag, only quarantine batches older than the retention window.
export function purge(opts: {approveIrreversible: boolean; now?: number}) {
  if (!opts.approveIrreversible) throw new Error('purge is irreversible and requires --i-approve-irreversible-delete');
  const now = opts.now ?? Date.now();
  const qroot = managed('quarantine');
  const removed: string[] = [];
  for (const b of existsSync(qroot) ? readdirSync(qroot) : []) {
    const p = path.join(qroot, b);
    if (now - statSync(p).mtimeMs > LIMITS.quarantineDays * D) { rmSync(p, {recursive: true, force: true}); removed.push(b); }
  }
  return removed;
}

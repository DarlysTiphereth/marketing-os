// Marketing OS control plane CLI. Nothing heavy runs unless a command explicitly asks for it.
//   node ops/cli.ts status
//   node ops/cli.ts enqueue --creative experiments/remotion/creatives/fixture.creative.json --public-safe --sel hook=hook-a2 --sel body=body-1 ...
//   node ops/cli.ts dispatch <job> [--allow-local] [--prefer github-actions|local|colab|codex-cloud]
//   node ops/cli.ts poll <job> | jobs | complete <job> --sha256 <hash>
//   node ops/cli.ts run-here <job.json>            (used by CI / Colab / Codex Cloud: renders in the CURRENT environment)
//   node ops/cli.ts storage plan [--include-external] | storage apply --approve [--include-external]
//   node ops/cli.ts storage restore <batch> | storage purge --i-approve-irreversible-delete | storage approve <sha256> --name <n>
import {spawnSync} from 'node:child_process';
import {appendFileSync, existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {LIMITS, REPO, ensureLayout, managed, mosHome} from './config.ts';
import {Queue, type RenderSpec} from './queue/store.ts';
import {Scheduler} from './render/scheduler.ts';
import {ColabWorker, CodexCloudWorker, GithubActionsWorker, LocalWorker} from './render/workers.ts';
import {Cas} from './storage/cas.ts';
import * as retention from './storage/retention.ts';

ensureLayout();
const log = (msg: string, extra: Record<string, unknown> = {}) => appendFileSync(managed('logs', 'ops.log'), JSON.stringify({t: new Date().toISOString(), msg, ...extra}) + '\n');
const queue = new Queue();
// Priority order: remote free first, local fallback last (and only with --allow-local). Manual workers only on --prefer.
const scheduler = new Scheduler(queue, log).register(new GithubActionsWorker()).register(new LocalWorker()).register(new ColabWorker()).register(new CodexCloudWorker());
const out = (v: unknown) => console.log(JSON.stringify(v, null, 2));
const gib = (b: number) => `${(b / 2 ** 30).toFixed(2)} GiB`;

const [cmd, ...rest] = process.argv.slice(2);
const {values: o, positionals: pos} = parseArgs({args: rest, allowPositionals: true, options: {
  creative: {type: 'string'}, 'public-safe': {type: 'boolean', default: false}, sel: {type: 'string', multiple: true, default: []},
  'allow-local': {type: 'boolean', default: false}, prefer: {type: 'string'}, sha256: {type: 'string'}, name: {type: 'string'},
  approve: {type: 'boolean', default: false}, 'include-external': {type: 'boolean', default: false}, 'i-approve-irreversible-delete': {type: 'boolean', default: false},
}});

switch (cmd) {
  case 'status': {
    const probe = {job_id: 'job-000000000000', kind: 'render' as const, spec: {creative: '', selection: {}, public_safe: true}, state: 'QUEUED' as const, attempts: 0, max_attempts: 1, executor: null, history: [], created_at: '', updated_at: ''};
    const workers = [];
    for (const w of [new GithubActionsWorker(), new LocalWorker(), new ColabWorker(), new CodexCloudWorker()]) workers.push({id: w.id, mode: w.mode, heavy_local: w.heavy_local, cost: w.cost_class, ...(await w.availability(probe))});
    const objs = Object.values(new Cas().load().objects);
    out({mos_home: mosHome(), limits: LIMITS, workers, jobs: queue.list().map((j) => ({job_id: j.job_id, state: j.state, executor: j.executor, attempts: j.attempts})),
      store: {objects: objs.length, bytes: objs.reduce((n, e) => n + e.bytes, 0), approved: objs.filter((e) => e.approved).length}});
    break;
  }
  case 'enqueue': {
    if (!o.creative) throw new Error('--creative is required');
    const selection = Object.fromEntries(o.sel!.map((s) => s.split('=') as [string, string]));
    const spec: RenderSpec = {creative: o.creative.replaceAll('\\', '/'), selection, public_safe: o['public-safe']!};
    out(queue.add(spec, LIMITS.maxAttempts));
    break;
  }
  case 'dispatch': out(await scheduler.dispatch(pos[0]!, {allowLocal: o['allow-local']!, ...(o.prefer ? {prefer: o.prefer} : {})})); break;
  case 'poll': out(await scheduler.poll(pos[0]!)); break;
  case 'jobs': out(queue.list()); break;
  case 'complete': {
    if (!o.sha256 || !/^[a-f0-9]{64}$/.test(o.sha256)) throw new Error('--sha256 <64 hex> required');
    const j = queue.get(pos[0]!);
    const n = queue.transition(j, 'SUCCEEDED', `completed manually, sha256 ${o.sha256}`);
    queue.save({...n, result: {output_sha256: o.sha256}});
    out(queue.get(j.job_id));
    break;
  }
  case 'run-here': {
    // Renders a job spec file in the current environment (CI runner, Colab, Codex Cloud). Not used by the local scheduler.
    const file = path.resolve(pos[0]!);
    const {job_id, spec} = JSON.parse(readFileSync(file, 'utf8')) as {job_id: string; spec: RenderSpec};
    if (!/^job-[a-f0-9]{12}$/.test(job_id)) throw new Error('invalid job id');
    const remotion = path.join(REPO, 'experiments', 'remotion');
    const args = ['pipeline/produce.ts', '--creative', path.relative(remotion, path.join(REPO, spec.creative)), ...Object.entries(spec.selection).flatMap(([k, v]) => [`--${k}`, v]),
      '--job-id', job_id, '--runs-dir', managed('runs-out')];
    const r = spawnSync(process.execPath, args, {cwd: remotion, stdio: 'inherit', env: {...process.env, MOS_HOME: mosHome()}});
    const summary = managed('runs', `${job_id}.json`);
    out({job_id, exit_code: r.status, summary: existsSync(summary) ? JSON.parse(readFileSync(summary, 'utf8')) : null});
    process.exitCode = r.status ?? 1;
    break;
  }
  case 'storage': {
    const sub = pos[0];
    if (sub === 'plan') { const p = retention.plan({includeExternal: o['include-external']!}); out({...p, total: gib(p.total_bytes), actions: p.actions.map(({entry: _e, ...a}) => a)}); }
    else if (sub === 'apply') { const p = retention.plan({includeExternal: o['include-external']!}); out(retention.apply(p, {approve: o.approve!})); }
    else if (sub === 'restore') out({restored: retention.restore(pos[1]!)});
    else if (sub === 'purge') out({purged_batches: retention.purge({approveIrreversible: o['i-approve-irreversible-delete']!})});
    else if (sub === 'approve') { new Cas().approve(pos[1]!, o.name ?? 'approved'); out({approved: pos[1]}); }
    else throw new Error('storage plan|apply|restore|purge|approve');
    break;
  }
  default:
    console.log('commands: status | enqueue | dispatch | poll | jobs | complete | run-here | storage <plan|apply|restore|purge|approve>');
}

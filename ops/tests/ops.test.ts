import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const homes: string[] = [];
const home = () => { const d = mkdtempSync(path.join(os.tmpdir(), 'mos-test-')); homes.push(d); process.env.MOS_HOME = d; return d; };
after(() => { for (const d of homes) rmSync(d, {recursive: true, force: true}); });
const {ensureLayout, managed} = await import('../config.ts');
const {Cas} = await import('../storage/cas.ts');
const retention = await import('../storage/retention.ts');
const {Queue} = await import('../queue/store.ts');
const {Scheduler} = await import('../render/scheduler.ts');
const {GithubActionsWorker} = await import('../render/workers.ts');
import type {RenderWorker, RunOutcome} from '../render/types.ts';

const file = (dir: string, name: string, body: string) => { const p = path.join(dir, name); writeFileSync(p, body); return p; };
const old = (p: string, days: number) => { const t = Date.now() / 1000 - days * 86400; utimesSync(p, t, t); };

test('CAS stores identical bytes once and records every reference', () => {
  const h = home(); ensureLayout();
  const cas = new Cas();
  const a = cas.put(file(h, 'a.png', 'same'), {name: 'a', class: 'cache'});
  const b = cas.put(file(h, 'b.png', 'same'), {name: 'b', class: 'candidate'});
  assert.equal(a.sha256, b.sha256);
  assert.equal(b.deduplicated, true);
  assert.equal(cas.load().objects[a.sha256]!.refs.length, 2);
  assert.equal(readdirSync(path.dirname(a.path)).length, 1);
});

test('managed paths cannot escape MOS_HOME and CAS rejects malformed ids', () => {
  home();
  assert.throws(() => managed('..', 'etc'), /escapes MOS_HOME/);
  assert.throws(() => new Cas().objectPath('../../x', ''), /invalid sha256/);
});

test('retention never plans approved or pinned objects', () => {
  const h = home(); ensureLayout();
  const cas = new Cas();
  const keep = cas.put(file(h, 'k.mp4', 'approved'), {name: 'k', class: 'candidate'});
  const pin = cas.put(file(h, 'p.mp4', 'pinned'), {name: 'p', class: 'temp'});
  const drop = cas.put(file(h, 'd.mp4', 'drop'), {name: 'd', class: 'temp'});
  cas.approve(keep.sha256, 'final');
  cas.pin(pin.sha256);
  const p = retention.plan({now: Date.now() + 400 * 86400_000});
  const planned = p.actions.map((x) => x.sha256);
  assert.ok(planned.includes(drop.sha256));
  assert.ok(!planned.includes(keep.sha256) && !planned.includes(pin.sha256));
  assert.equal(p.protected.length, 2);
});

test('apply requires approval, quarantines reversibly, restore brings files back', () => {
  home(); ensureLayout();
  const tmpItem = path.join(managed('tmp'), 'frames-x');
  mkdirSync(tmpItem); file(tmpItem, 'f.jpeg', 'x'); old(tmpItem, 3);
  const p = retention.plan();
  assert.equal(p.actions.length, 1);
  assert.throws(() => retention.apply(p, {approve: false}), /explicit approval/);
  const r = retention.apply(p, {approve: true});
  assert.equal(existsSync(tmpItem), false);
  assert.equal(retention.restore(r.batch), 1);
  assert.equal(existsSync(path.join(tmpItem, 'f.jpeg')), true);
});

test('purge is a separate irreversible step limited to old quarantine batches', () => {
  home(); ensureLayout();
  const fresh = managed('quarantine', 'fresh'), stale = managed('quarantine', 'stale');
  mkdirSync(fresh); mkdirSync(stale); old(stale, 30);
  assert.throws(() => retention.purge({approveIrreversible: false}), /irreversible/);
  assert.deepEqual(retention.purge({approveIrreversible: true}), ['stale']);
  assert.equal(existsSync(fresh), true);
});

const fake = (over: Partial<RenderWorker> & {outcomes?: RunOutcome[]}): RenderWorker => {
  const outcomes = over.outcomes ?? [{status: 'SUCCEEDED'}];
  let i = 0;
  return {id: 'fake', cost_class: 'free', mode: 'automatic', gpu_required: false, heavy_local: false,
    availability: async () => ({available: true, reason: 'ok'}), run: async () => outcomes[Math.min(i++, outcomes.length - 1)]!, ...over} as RenderWorker;
};
const spec = {creative: 'experiments/remotion/creatives/fixture.creative.json', selection: {hook: 'hook-a2'}, public_safe: true};

test('scheduler refuses paid workers outright', () => {
  home(); ensureLayout();
  assert.throws(() => new Scheduler(new Queue()).register(fake({cost_class: 'paid'} as Partial<RenderWorker>)), /only free workers/);
});

test('with no free worker available the job stays QUEUED (never substituted)', async () => {
  home(); ensureLayout();
  const q = new Queue(), j = q.add(spec, 3);
  const s = new Scheduler(q).register(fake({availability: async () => ({available: false, reason: 'billing lock'})}));
  const after = await s.dispatch(j.job_id, {allowLocal: false});
  assert.equal(after.state, 'QUEUED');
  assert.match(after.history.at(-1)!.msg, /billing lock/);
});

test('local heavy worker is only used with explicit opt-in', async () => {
  home(); ensureLayout();
  const q = new Queue(), j = q.add(spec, 3);
  const s = new Scheduler(q).register(fake({id: 'local', heavy_local: true}));
  assert.equal((await s.dispatch(j.job_id, {allowLocal: false})).state, 'QUEUED');
  assert.equal((await s.dispatch(j.job_id, {allowLocal: true})).state, 'SUCCEEDED');
});

test('retries are bounded by max_attempts', async () => {
  home(); ensureLayout();
  const q = new Queue(), j = q.add(spec, 3);
  const s = new Scheduler(q).register(fake({outcomes: [{status: 'FAILED', error: 'boom', retryable: true}]}));
  let state = j.state;
  for (let k = 0; k < 5 && state === 'QUEUED'; k++) state = (await s.dispatch(j.job_id, {allowLocal: false})).state;
  const final = q.get(j.job_id);
  assert.equal(final.state, 'FAILED');
  assert.equal(final.attempts, 3);
});

test('concurrency limit keeps extra jobs queued', async () => {
  home(); ensureLayout();
  const q = new Queue();
  const busy = q.add({...spec, selection: {hook: 'busy'}}, 3);
  q.transition(busy, 'RUNNING', 'simulated');
  const j = q.add(spec, 3);
  const after = await new Scheduler(q).register(fake({})).dispatch(j.job_id, {allowLocal: false});
  assert.equal(after.state, 'QUEUED');
  assert.match(after.history.at(-1)!.msg, /concurrency/);
});

test('queue is idempotent and rejects illegal transitions', () => {
  home(); ensureLayout();
  const q = new Queue();
  const a = q.add(spec, 3), b = q.add(spec, 3);
  assert.equal(a.job_id, b.job_id);
  assert.throws(() => q.transition(a, 'SUCCEEDED', 'skip'), /illegal transition/);
});

test('GitHub worker never sends non-public-safe (brand) jobs to the public repository', async () => {
  home(); ensureLayout();
  const q = new Queue(), j = q.add({...spec, public_safe: false}, 3);
  const a = await new GithubActionsWorker().availability(j);
  assert.equal(a.available, false);
  assert.match(a.reason, /PUBLIC/);
});

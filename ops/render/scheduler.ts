// Scheduler: picks the first AVAILABLE FREE worker. Never falls back to a paid service; if nothing free is
// available the job stays QUEUED (or AWAITING_MANUAL when a manual worker is explicitly requested).
import {LIMITS} from '../config.ts';
import {Queue, type Job} from '../queue/store.ts';
import type {RenderWorker, RunOutcome} from './types.ts';

export type DispatchOptions = {allowLocal: boolean; prefer?: string};

export class Scheduler {
  private workers: RenderWorker[] = [];
  private queue: Queue;
  private log: (msg: string, extra?: Record<string, unknown>) => void;
  constructor(queue: Queue, log: (msg: string, extra?: Record<string, unknown>) => void = () => {}) { this.queue = queue; this.log = log; }

  register(w: RenderWorker) {
    if (w.cost_class !== 'free') throw new Error(`worker ${w.id} is ${w.cost_class}; only free workers may be registered`);
    this.workers.push(w);
    return this;
  }
  list() { return this.workers.map((w) => ({id: w.id, mode: w.mode, heavy_local: w.heavy_local, cost_class: w.cost_class})); }

  // A RUNNING job whose process died would block the slot forever: leases expire after 2 h without updates.
  private busy() {
    const fresh = (j: {updated_at: string}) => Date.now() - Date.parse(j.updated_at) < 2 * 3600_000;
    return this.queue.list().filter((j) => j.state === 'DISPATCHED' || (j.state === 'RUNNING' && fresh(j))).length;
  }

  private apply(job: Job, w: RenderWorker, out: RunOutcome): Job {
    if (out.status === 'SUCCEEDED') {
      const j = job.state === 'SUCCEEDED' ? job : this.queue.transition(job, 'SUCCEEDED', 'render succeeded', w.id);
      const done = {...j, result: {...(out.output_sha256 ? {output_sha256: out.output_sha256} : {}), ...(out.output_bytes ? {output_bytes: out.output_bytes} : {}),
        ...(out.remote_ref ? {remote_ref: out.remote_ref} : {}), ...(out.metrics ? {metrics: out.metrics} : {}), ...(out.run_dir ? {run_dir: out.run_dir} : {})}};
      this.queue.save(done);
      return done;
    }
    if (out.status === 'DISPATCHED') { const j = job.state === 'DISPATCHED' ? job : this.queue.transition(job, 'DISPATCHED', `dispatched: ${out.remote_ref}`, w.id); this.queue.save({...j, result: {remote_ref: out.remote_ref}}); return this.queue.get(j.job_id); }
    if (out.status === 'AWAITING_MANUAL') return this.queue.transition(job, 'AWAITING_MANUAL', out.instructions, w.id);
    const attempts = job.attempts + 1;
    const counted = {...job, attempts};
    this.queue.save(counted);
    if (out.retryable && attempts < job.max_attempts) return this.queue.transition(counted, 'QUEUED', `attempt ${attempts}/${job.max_attempts} failed (will retry): ${out.error}`, null);
    return this.queue.transition(counted, 'FAILED', `attempt ${attempts}/${job.max_attempts} failed: ${out.error}`, w.id);
  }

  async dispatch(jobId: string, opts: DispatchOptions): Promise<Job> {
    let job = this.queue.get(jobId);
    if (job.state !== 'QUEUED') throw new Error(`job ${jobId} is ${job.state}, not QUEUED`);
    if (this.busy() >= LIMITS.maxConcurrency) { this.note(job, `concurrency limit ${LIMITS.maxConcurrency} reached; stays QUEUED`); return this.queue.get(jobId); }

    const reasons: string[] = [];
    const candidates = this.workers.filter((w) => (opts.prefer ? w.id === opts.prefer : w.mode === 'automatic'));
    if (opts.prefer && !candidates.length) throw new Error(`unknown worker ${opts.prefer}`);
    for (const w of candidates) {
      if (w.heavy_local && !opts.allowLocal) { reasons.push(`${w.id}: local render is opt-in (--allow-local)`); continue; }
      const a = await w.availability(job);
      if (!a.available) { reasons.push(`${w.id}: ${a.reason}`); continue; }
      this.log('dispatch', {job: jobId, worker: w.id, reason: a.reason});
      job = this.queue.transition(job, 'RUNNING', `handed to ${w.id}`, w.id);
      const out = await w.run(job);
      return this.apply(this.queue.get(jobId), w, out);
    }
    this.note(job, `no free worker available; stays QUEUED. ${reasons.join(' | ')}`);
    return this.queue.get(jobId);
  }

  // For DISPATCHED jobs on remote workers.
  async poll(jobId: string): Promise<Job> {
    const job = this.queue.get(jobId);
    if (job.state !== 'DISPATCHED') return job;
    const w = this.workers.find((x) => x.id === job.executor) as (RenderWorker & {poll?: (j: Job) => Promise<RunOutcome | null>}) | undefined;
    if (!w?.poll) return job;
    const out = await w.poll(job);
    return out ? this.apply(job, w, out) : job;
  }

  private note(job: Job, msg: string) {
    const t = new Date().toISOString();
    this.queue.save({...job, updated_at: t, history: [...job.history, {t, state: job.state, msg}]});
    this.log('note', {job: job.job_id, msg});
  }
}

// File-backed job queue with an explicit state machine. One JSON per job under MOS_HOME/queue/jobs.
import {existsSync, readdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {managed} from '../config.ts';

export type JobState = 'QUEUED' | 'DISPATCHED' | 'RUNNING' | 'AWAITING_MANUAL' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type RenderSpec = {
  creative: string; // repo-relative path to creative.json
  selection: Record<string, string>;
  public_safe: boolean; // may this job's inputs/outputs be exposed in a PUBLIC repository?
  stack?: string;
};
export type Job = {
  job_id: string; kind: 'render'; spec: RenderSpec; state: JobState;
  attempts: number; max_attempts: number; executor: string | null;
  history: {t: string; state: JobState; executor?: string | null; msg: string}[];
  created_at: string; updated_at: string;
  result?: {output_sha256?: string; output_bytes?: number; remote_ref?: string; metrics?: Record<string, unknown>; run_dir?: string};
};

const NEXT: Record<JobState, JobState[]> = {
  QUEUED: ['DISPATCHED', 'RUNNING', 'AWAITING_MANUAL', 'CANCELLED'],
  DISPATCHED: ['RUNNING', 'SUCCEEDED', 'FAILED', 'QUEUED'],
  RUNNING: ['SUCCEEDED', 'FAILED', 'QUEUED', 'DISPATCHED', 'AWAITING_MANUAL'],
  AWAITING_MANUAL: ['RUNNING', 'SUCCEEDED', 'FAILED', 'QUEUED', 'CANCELLED'],
  SUCCEEDED: [], FAILED: ['QUEUED'], CANCELLED: [],
};

export class Queue {
  private dir() { return managed('queue', 'jobs'); }
  private file(id: string) {
    if (!/^job-[a-f0-9]{12}$/.test(id)) throw new Error(`invalid job id: ${id}`);
    return path.join(this.dir(), `${id}.json`);
  }
  save(j: Job) { const f = this.file(j.job_id), tmp = `${f}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(j, null, 2) + '\n'); renameSync(tmp, f); }
  get(id: string): Job { return JSON.parse(readFileSync(this.file(id), 'utf8')) as Job; }
  list(): Job[] { const d = this.dir(); return existsSync(d) ? readdirSync(d).filter((f) => /^job-[a-f0-9]{12}\.json$/.test(f)).map((f) => JSON.parse(readFileSync(path.join(d, f), 'utf8')) as Job) : []; }

  // Idempotent: the same spec maps to the same job id; re-adding returns the existing job.
  add(spec: RenderSpec, maxAttempts: number): Job {
    const id = `job-${createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 12)}`;
    if (existsSync(this.file(id))) return this.get(id);
    const now = new Date().toISOString();
    const j: Job = {job_id: id, kind: 'render', spec, state: 'QUEUED', attempts: 0, max_attempts: maxAttempts, executor: null, history: [{t: now, state: 'QUEUED', msg: 'created'}], created_at: now, updated_at: now};
    this.save(j);
    return j;
  }

  transition(j: Job, to: JobState, msg: string, executor: string | null = j.executor): Job {
    if (!NEXT[j.state].includes(to)) throw new Error(`illegal transition ${j.state} -> ${to} (${j.job_id})`);
    const t = new Date().toISOString();
    const n: Job = {...j, state: to, executor, updated_at: t, history: [...j.history, {t, state: to, executor, msg}]};
    this.save(n);
    return n;
  }
}

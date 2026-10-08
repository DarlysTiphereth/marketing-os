// Concrete RenderWorkers. All are free. None assumes a GPU.
import {spawn, spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {GITHUB_REPO, LIMITS, REPO, managed, mosHome} from '../config.ts';
import {Cas} from '../storage/cas.ts';
import type {Job} from '../queue/store.ts';
import type {Availability, RenderWorker, RunOutcome} from './types.ts';

const selectionArgs = (j: Job) => Object.entries(j.spec.selection).flatMap(([k, v]) => [`--${k}`, v]);

// ---------- local (fallback, opt-in, low priority) ----------
export class LocalWorker implements RenderWorker {
  readonly id = 'local';
  readonly cost_class = 'free' as const;
  readonly mode = 'automatic' as const;
  readonly gpu_required = false as const;
  readonly heavy_local = true;
  async availability(): Promise<Availability> {
    const freeGiB = os.freemem() / 2 ** 30;
    if (freeGiB < 1.5) return {available: false, reason: `only ${freeGiB.toFixed(1)} GiB RAM free (< 1.5 GiB)`};
    return {available: true, reason: `opt-in local fallback; ${freeGiB.toFixed(1)} GiB RAM free`};
  }
  async run(job: Job): Promise<RunOutcome> {
    const remotion = path.join(REPO, 'experiments', 'remotion');
    const args = ['pipeline/produce.ts', '--creative', path.relative(remotion, path.join(REPO, job.spec.creative)), ...selectionArgs(job),
      '--stack', job.spec.stack ?? 'remotion', '--concurrency', String(LIMITS.localFrameConcurrency), '--job-id', job.job_id];
    const code = await new Promise<number>((resolve) => {
      const child = spawn(process.execPath, args, {cwd: remotion, env: {...process.env, MOS_HOME: mosHome()}, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true});
      try { os.setPriority(child.pid!, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* best effort */ }
      child.on('exit', (c) => resolve(c ?? 1));
    });
    const latest = managed('runs', `${job.job_id}.json`);
    if (code !== 0 || !existsSync(latest)) return {status: 'FAILED', error: `produce exited ${code}`, retryable: code !== 0};
    const r = JSON.parse(readFileSync(latest, 'utf8')) as {run_dir: string; output_sha256: string; output_bytes: number; qc_verdict: string};
    if (r.qc_verdict !== 'PASS') return {status: 'FAILED', error: `technical QC ${r.qc_verdict}`, retryable: false};
    return {status: 'SUCCEEDED', output_sha256: r.output_sha256, output_bytes: r.output_bytes, run_dir: r.run_dir};
  }
}

// ---------- GitHub Actions (free for public repos; respects billing lock; never sends brand content) ----------
type GhRun = {id: number; status: string; conclusion: string | null; html_url: string; head_branch: string; created_at: string};
async function gh<T>(p: string): Promise<T> {
  const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}${p}`, {headers: {accept: 'application/vnd.github+json', 'user-agent': 'marketing-os-ops'}});
  if (!r.ok) throw new Error(`GitHub API ${r.status} for ${p}`);
  return r.json() as Promise<T>;
}
async function annotations(runId: number) {
  const jobs = await gh<{jobs: {id: number; name: string}[]}>(`/actions/runs/${runId}/jobs`);
  const out: {job: string; level: string; message: string}[] = [];
  for (const j of jobs.jobs) for (const a of await gh<{annotation_level: string; message: string}[]>(`/check-runs/${j.id}/annotations`)) out.push({job: j.name, level: a.annotation_level, message: a.message});
  return out;
}
const BILLING = /locked due to a billing issue|spending limit/i;

export class GithubActionsWorker implements RenderWorker {
  readonly id = 'github-actions';
  readonly cost_class = 'free' as const;
  readonly mode = 'automatic' as const;
  readonly gpu_required = false as const;
  readonly heavy_local = false;

  async availability(job: Job): Promise<Availability> {
    if (!job.spec.public_safe) return {available: false, reason: `${GITHUB_REPO} is PUBLIC: brand/private content is never sent there (spec.public_safe=false)`};
    try {
      const repo = await (await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {headers: {'user-agent': 'marketing-os-ops'}})).json() as {private?: boolean};
      if (repo.private !== false) return {available: false, reason: 'repository is not public: Actions minutes would count against a quota; not auto-dispatched'};
      const runs = await gh<{workflow_runs: GhRun[]}>('/actions/runs?per_page=5');
      const last = runs.workflow_runs[0];
      if (last?.conclusion === 'failure') {
        const ann = await annotations(last.id);
        const lock = ann.find((a) => BILLING.test(a.message));
        if (lock) return {available: false, reason: 'GitHub account is billing-locked: Actions jobs are not started', evidence: `run ${last.id}: ${lock.message}`};
      }
      return {available: true, reason: last ? `last run ${last.id} ${last.conclusion ?? last.status}; no billing lock observed` : 'no previous runs; billing state UNVERIFIED until first run'};
    } catch (e) {
      return {available: false, reason: `GitHub API unreachable: ${(e as Error).message}`};
    }
  }

  // Creates a commit on top of HEAD that only adds ops/jobs/<id>.json (temporary index: the working tree is untouched),
  // then pushes it to refs/heads/render-jobs/<id>. The workflow render-job.yml runs on that branch.
  async run(job: Job): Promise<RunOutcome> {
    const branch = `render-jobs/${job.job_id}`;
    const tmp = mkdtempSync(path.join(managed('tmp'), 'gh-'));
    const g = (args: string[], env: Record<string, string> = {}) => {
      const r = spawnSync('git', ['-C', REPO, ...args], {encoding: 'utf8', env: {...process.env, ...env}, windowsHide: true});
      if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr.trim().slice(-500)}`);
      return r.stdout.trim();
    };
    try {
      const specFile = path.join(tmp, 'job.json');
      writeFileSync(specFile, JSON.stringify({job_id: job.job_id, spec: job.spec}, null, 2) + '\n');
      const idx = {GIT_INDEX_FILE: path.join(tmp, 'index')};
      const blob = g(['hash-object', '-w', specFile]);
      g(['read-tree', 'HEAD'], idx);
      g(['update-index', '--add', '--cacheinfo', `100644,${blob},ops/jobs/${job.job_id}.json`], idx);
      const tree = g(['write-tree'], idx);
      const commit = g(['commit-tree', tree, '-p', 'HEAD', '-m', `render job ${job.job_id}`]);
      g(['push', 'origin', `${commit}:refs/heads/${branch}`]);
      return {status: 'DISPATCHED', remote_ref: `${branch}@${commit.slice(0, 12)}`};
    } catch (e) {
      return {status: 'FAILED', error: (e as Error).message, retryable: false};
    } finally {
      rmSync(tmp, {recursive: true, force: true});
    }
  }

  async poll(job: Job): Promise<RunOutcome | null> {
    const branch = `render-jobs/${job.job_id}`;
    const runs = await gh<{workflow_runs: GhRun[]}>(`/actions/runs?branch=${encodeURIComponent(branch)}&per_page=1`);
    const run = runs.workflow_runs[0];
    if (!run || run.status !== 'completed') return null;
    const ann = await annotations(run.id);
    const lock = ann.find((a) => BILLING.test(a.message));
    if (lock) return {status: 'FAILED', error: `billing lock: ${lock.message}`, retryable: false};
    const metricsLine = ann.find((a) => a.message.startsWith('MOS_METRICS '));
    const metrics = metricsLine ? JSON.parse(metricsLine.message.slice('MOS_METRICS '.length)) as Record<string, unknown> : undefined;
    if (run.conclusion !== 'success') return {status: 'FAILED', error: `run ${run.id} ${run.conclusion}`, retryable: true};
    return {status: 'SUCCEEDED', remote_ref: run.html_url, ...(metrics ? {metrics} : {}),
      ...(typeof metrics?.output_sha256 === 'string' ? {output_sha256: metrics.output_sha256} : {}), ...(typeof metrics?.output_bytes === 'number' ? {output_bytes: metrics.output_bytes} : {})};
  }
}

// ---------- manual workers: they only produce instructions; a human starts them ----------
export class ColabWorker implements RenderWorker {
  readonly id = 'colab';
  readonly cost_class = 'free' as const;
  readonly mode = 'manual' as const;
  readonly gpu_required = false as const;
  readonly heavy_local = false;
  async availability(): Promise<Availability> { return {available: true, reason: 'manual: interactive notebook started by you; never used as a server'}; }
  async run(job: Job): Promise<RunOutcome> {
    const url = `https://colab.research.google.com/github/${GITHUB_REPO}/blob/master/ops/colab/render_job.ipynb`;
    return {status: 'AWAITING_MANUAL', instructions: `Open ${url}, paste this job spec in the first cell and run all: ${JSON.stringify({job_id: job.job_id, spec: job.spec})}. Upload private assets only inside your Colab session. Then run: node ops/cli.ts complete ${job.job_id} --sha256 <hash printed by the notebook>`};
  }
}

export class CodexCloudWorker implements RenderWorker {
  readonly id = 'codex-cloud';
  readonly cost_class = 'free' as const; // covered by the existing Codex subscription; no extra spend
  readonly mode = 'manual' as const;
  readonly gpu_required = false as const;
  readonly heavy_local = false;
  async availability(): Promise<Availability> { return {available: true, reason: 'manual: start a Codex Cloud task from the existing subscription'}; }
  async run(job: Job): Promise<RunOutcome> {
    return {status: 'AWAITING_MANUAL', instructions: `In Codex Cloud on ${GITHUB_REPO}, run: node ops/cli.ts run-here ${job.job_id} (spec: ${JSON.stringify(job.spec)}). Report the printed sha256 with: node ops/cli.ts complete ${job.job_id} --sha256 <hash>`};
  }
}

export function storeOutput(file: string, runId: string) {
  return new Cas().put(file, {name: path.basename(file), class: 'candidate', run_id: runId});
}

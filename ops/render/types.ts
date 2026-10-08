import type {Job} from '../queue/store.ts';

export type CostClass = 'free' | 'paid';
export type Availability = {available: boolean; reason: string; evidence?: string};
export type RunOutcome =
  | {status: 'SUCCEEDED'; output_sha256?: string; output_bytes?: number; remote_ref?: string; metrics?: Record<string, unknown>; run_dir?: string}
  | {status: 'DISPATCHED'; remote_ref: string}
  | {status: 'AWAITING_MANUAL'; instructions: string}
  | {status: 'FAILED'; error: string; retryable: boolean};

// A RenderWorker turns a queued render job into an MP4 somewhere. It never assumes a GPU.
export interface RenderWorker {
  readonly id: string;
  readonly cost_class: CostClass;   // the scheduler refuses anything that is not 'free'
  readonly mode: 'automatic' | 'manual'; // manual = a human starts it (Colab, Codex Cloud)
  readonly gpu_required: false;
  readonly heavy_local: boolean;    // true = consumes this computer's CPU/RAM (local fallback)
  availability(job: Job): Promise<Availability>;
  run(job: Job): Promise<RunOutcome>;
}

import { z } from 'zod';
import { AITaskSchema } from '../contracts/schemas.ts';
import type { AITask } from '../contracts/schemas.ts';
import { uuid } from '../domain/identity.ts';

export interface AIBatch { batch_id: string; tasks: AITask[]; max_output_tokens: number; prompt_version: string }
export function prepareBatch(tasks: AITask[], promptVersion: string, maximum = 4096): AIBatch {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || !promptVersion.trim()) throw new Error('Invalid batch budget or prompt version');
  if (!tasks.length) throw new Error('Empty AI batch');
  const parsed = tasks.map(t => AITaskSchema.parse(t));
  const first = parsed[0]!;
  if (new Set(parsed.map(t => t.task_id)).size !== parsed.length) throw new Error('Duplicate task IDs');
  if (parsed.some(t => !t.batch_allowed || t.latency_requirement !== 'BATCH' || t.brand_id !== first.brand_id ||
    t.product_id !== first.product_id || t.task_type !== first.task_type)) throw new Error('Unsafe batch grouping');
  const output = parsed.reduce((total, t) => total + t.max_output_tokens, 128); // reserved envelope tokens
  if (output > maximum) throw new Error('Batch output budget exceeded');
  return { batch_id: uuid([parsed.map(t => t.task_id), promptVersion]), tasks: parsed, max_output_tokens: output, prompt_version: promptVersion };
}
export function validateBatchResults<T>(batch: AIBatch, results: Array<{ task_id: string; result: unknown }>, schema: z.ZodType<T>) {
  const expected = new Set(batch.tasks.map(t => t.task_id));
  if (results.length !== expected.size || new Set(results.map(r => r.task_id)).size !== results.length ||
    results.some(r => !expected.has(r.task_id))) throw new Error('Incomplete, duplicate or unknown AI batch result IDs');
  return results.map(r => ({ task_id: r.task_id, result: schema.parse(r.result) }));
}

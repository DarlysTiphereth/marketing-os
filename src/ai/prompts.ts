import { AITaskSchema, PromptTemplateSchema } from '../contracts/schemas.ts';
import type { AITask, PromptTemplate } from '../contracts/schemas.ts';

export const TOKEN_BUDGETS: Record<AITask['task_type'], number> = {
  CLASSIFICATION: 64, HOOK: 128, CAPTION: 192, SCRIPT: 768, STRATEGY: 1024, DEEP_ANALYSIS: 2048,
};
export class PromptRegistry {
  private readonly templates = new Map<string, PromptTemplate>();
  constructor(templates: PromptTemplate[]) {
    for (const raw of templates) {
      const template = PromptTemplateSchema.parse(raw);
      const key = `${template.task_type}:${template.version}`;
      if (this.templates.has(key)) throw new Error('Duplicate prompt version');
      this.templates.set(key, template);
    }
  }
  get(taskType: AITask['task_type'], version: string): PromptTemplate {
    const template = this.templates.get(`${taskType}:${version}`);
    if (!template) throw new Error('Prompt version not found');
    return structuredClone(template);
  }
}
export const DEFAULT_PROMPTS = new PromptRegistry(Object.entries(TOKEN_BUDGETS).map(([taskType, budget]) =>
  PromptTemplateSchema.parse({ prompt_template_id: `prompt-${taskType.toLowerCase().replace('_', '-')}`,
    name: taskType, task_type: taskType, version: '1',
    static_instructions: 'Return structured JSON. Use supplied sourced facts only. Unknown data stays UNKNOWN. No identifiable human face.',
    expected_schema: { type: 'object', additionalProperties: false, required: ['text', 'source_ids'],
      properties: { text: { type: 'string' }, source_ids: { type: 'array', items: { type: 'string' } } } },
    max_output_tokens: budget, created_at: '2026-10-05T00:00:00.000Z' })));

export function enforceOutputBudget(task: AITask, template: PromptTemplate, outputTokens: number): void {
  AITaskSchema.parse(task); PromptTemplateSchema.parse(template);
  if (task.task_type !== template.task_type) throw new Error('Task/prompt mismatch');
  if (!Number.isSafeInteger(outputTokens) || outputTokens < 0 ||
    outputTokens > Math.min(task.max_output_tokens, template.max_output_tokens)) throw new Error('Output token budget exceeded');
}

import type { LogEvent, Logger } from '../contracts/ports.ts';
import { Slug, UUID } from '../contracts/schemas.ts';

export class StructuredLogger implements Logger {
  private readonly write: (line: string) => void;
  constructor(write: (line: string) => void = line => process.stderr.write(`${line}\n`)) { this.write = write; }
  log(event: LogEvent): void {
    // Field allowlist: never serialize request, context, arbitrary error text or credentials.
    UUID.parse(event.correlation_id); Slug.parse(event.brand_id); Slug.parse(event.product_id);
    if (event.batch_id) UUID.parse(event.batch_id);
    if (event.creative_id) UUID.parse(event.creative_id);
    const allowedEvent = ['BATCH_STARTED', 'COMPLIANCE_CHECKED', 'BATCH_REUSED', 'BATCH_SAVED', 'CREATIVE_CHECKED'];
    if (!allowedEvent.includes(event.event)) throw new Error('Unknown log event');
    const decision = ['ALLOW', 'REVIEW', 'BLOCK', 'PASS', 'FAIL'].includes(event.decision ?? '') ? event.decision : undefined;
    this.write(JSON.stringify({ event: event.event, correlation_id: event.correlation_id, batch_id: event.batch_id,
      brand_id: event.brand_id, product_id: event.product_id, creative_id: event.creative_id, decision }));
  }
}

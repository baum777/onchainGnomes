/**
 * Phase 4 — Correlation fields for structured logs.
 * Optional context: event_id, mention_id, user_id, launch_mode, state_store_backend, retry_count, skip_reason, pattern.
 */

export interface ObservabilityContextFields {
  event_id?: string;
  mention_id?: string;
  user_id?: string;
  launch_mode?: string;
  state_store_backend?: string;
  retry_count?: number;
  skip_reason?: string;
  pattern?: string;
}

let currentContext: ObservabilityContextFields = {};

export function setObservabilityContext(fields: ObservabilityContextFields): void {
  currentContext = { ...currentContext, ...fields };
}

export function clearObservabilityContext(): void {
  currentContext = {};
}

export function getObservabilityContext(): Readonly<ObservabilityContextFields> {
  return currentContext;
}

export function withObservabilityContext<T>(fields: ObservabilityContextFields, fn: () => T): T {
  const prev = { ...currentContext };
  setObservabilityContext(fields);
  try {
    return fn();
  } finally {
    currentContext = prev;
  }
}

export function getCorrelationFieldsForLog(): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (currentContext.event_id) o.event_id = currentContext.event_id;
  if (currentContext.mention_id) o.mention_id = currentContext.mention_id;
  if (currentContext.user_id) o.user_id = currentContext.user_id;
  if (currentContext.launch_mode) o.launch_mode = currentContext.launch_mode;
  if (currentContext.state_store_backend) o.state_store_backend = currentContext.state_store_backend;
  if (currentContext.retry_count !== undefined) o.retry_count = currentContext.retry_count;
  if (currentContext.skip_reason) o.skip_reason = currentContext.skip_reason;
  if (currentContext.pattern) o.pattern = currentContext.pattern;
  return o;
}

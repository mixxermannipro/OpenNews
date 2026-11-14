export const diagnosticEvents = ['app-error', 'unhandled-promise', 'feed-failed', 'storage-failed'] as const;
export type Diagnostic = (typeof diagnosticEvents)[number];

export function isDiagnostic(value: unknown): value is Diagnostic {
  return typeof value === 'string' && diagnosticEvents.some(event => event === value);
}

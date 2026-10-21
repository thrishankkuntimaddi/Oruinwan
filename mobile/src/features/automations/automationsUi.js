// Labels for automation runs (pure, tested).

export const RUN_STATUS = {
  success: { label: 'Succeeded', tile: 'success', text: 'text-success' },
  partial: { label: 'Partly failed', tile: 'danger', text: 'text-warning' },
  failed: { label: 'Failed', tile: 'danger', text: 'text-danger' },
  skipped: { label: 'Skipped', tile: 'neutral', text: 'text-text-3' },
};

const SOURCE_LABEL = { event: 'Triggered', schedule: 'Scheduled', manual: 'Run by hand', test: 'Test' };

/** "Run by hand · 2 of 3 steps · 180 ms" / "Test · conditions not met". */
export function runSummary(run) {
  const parts = [run.dryRun ? 'Test' : SOURCE_LABEL[run.source] || 'Run'];
  if (!run.conditionsMet) parts.push('conditions not met');
  else if (run.steps?.length) {
    const ok = run.steps.filter((s) => s.status === 'success').length;
    parts.push(run.dryRun ? `${run.steps.length} step${run.steps.length === 1 ? '' : 's'} checked` : `${ok} of ${run.steps.length} steps`);
  }
  if (run.durationMs) parts.push(run.durationMs >= 1000 ? `${(run.durationMs / 1000).toFixed(1)} s` : `${run.durationMs} ms`);
  return parts.join(' · ');
}

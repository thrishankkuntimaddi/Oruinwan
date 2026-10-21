// "12 of 50 AI requests left today": a small muted line wherever AI is asked. Hidden on a
// company plan (no daily cap) and on servers without plans.
import { cx } from '../../ui/cx.js';
import { useAiQuota } from './plan.js';
import { aiCounterText } from './planText.js';

export function AiQuotaLine({ ws, className }) {
  const { data } = useAiQuota(ws);
  const text = aiCounterText(data);
  if (!text) return null;
  const out = data?.userRemaining === 0;
  return (
    <p data-testid="ai-quota" aria-live="polite" className={cx('text-center text-[11px] tabular-nums', out ? 'text-warning' : 'text-text-3', className)}>
      {text}
    </p>
  );
}

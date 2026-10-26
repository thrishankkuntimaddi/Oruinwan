import { ArrowRight, Hash, Sparkles } from 'lucide-react';
import { BrandMark } from '../../app/BrandMark.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';

const delay = (ms) => ({ animationDelay: `${ms}ms` });

/** A tiny conversation that plays in on the welcome screen: what the app is for, at a glance. */
function Conversation() {
  return (
    <div className="mx-auto w-full max-w-[19rem] space-y-2.5" aria-hidden>
      <div className="intro-bubble flex items-center gap-1.5 text-[12px] font-semibold text-text-2" style={delay(500)}>
        <Icon as={Hash} size={13} /> website-redesign
      </div>
      <div className="intro-bubble flex items-end gap-2" style={delay(700)}>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#6a8f86] text-[11px] font-bold text-white">PR</span>
        <span className="rounded-2xl rounded-bl-md border border-line-soft bg-surface px-3 py-2 text-[13px] shadow-sm">New homepage is live on staging 🎉</span>
      </div>
      <div className="intro-bubble flex items-end justify-end gap-2" style={delay(1050)}>
        <span className="ml-9 rounded-2xl rounded-br-md bg-gold px-3 py-2 text-[13px] text-on-accent">Looks great. @ai summarise the feedback?</span>
      </div>
      <div className="intro-bubble flex items-end gap-2" style={delay(1450)}>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface text-accent-ink">
          <Icon as={Sparkles} size={14} />
        </span>
        <span className="rounded-2xl rounded-bl-md border border-accent/30 bg-accent/10 px-3 py-2 text-[13px]">3 people approved, 1 asked for darker buttons.</span>
      </div>
    </div>
  );
}

/**
 * The first screen: the mark lands, the tagline rises in and a little conversation plays.
 * "Get started" asks for an email next.
 */
export function Intro({ onGetStarted }) {
  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-bg px-6 pt-safe pb-safe">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60%] opacity-80"
        style={{ background: 'radial-gradient(60% 50% at 50% 18%, rgb(var(--c-accent) / 0.18), transparent 70%)' }}
      />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center pt-8">
        <div className="intro-mark mx-auto">
          <BrandMark size={72} glow />
        </div>
        <h1 className="intro-rise mt-7 text-center text-[34px] font-bold leading-[1.08] tracking-tight sm:text-[40px]" style={delay(250)}>
          One workspace.
          <br />
          <span className="text-accent-ink">Every conversation.</span>
        </h1>
        <p className="intro-rise mx-auto mt-3 max-w-xs text-center text-[15px] text-text-2" style={delay(380)}>
          Chat, tasks, notes and AI for your team. Encrypted in transit and at rest.
        </p>
        <div className="mt-9">
          <Conversation />
        </div>
      </div>
      <div className="intro-rise relative mx-auto w-full max-w-sm space-y-2.5 pt-8 pb-6" style={delay(600)}>
        <Button block size="lg" iconRight={ArrowRight} onClick={onGetStarted} data-testid="get-started">
          Get started
        </Button>
        <p className="pt-1 text-center text-xs text-text-3">Version {__APP_VERSION__}</p>
      </div>
    </div>
  );
}

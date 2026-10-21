// In-call extras UI: the call menu (captions, recording, transcript, ask AI), the live caption
// strip, the "being recorded" consent banner, and the transcript list the meeting page reuses.
import { useState } from 'react';
import { Captions, CaptionsOff, CircleStop, Disc, RotateCcw, ScrollText, Sparkles } from 'lucide-react';
import { useSession } from '../../data/session.js';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { ActionSheet, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState } from '../../ui/Feedback.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { cx } from '../../ui/cx.js';
import { useHuddle } from './huddle.js';
import { noticeKind, offsetLabel } from './callMedia.js';
import {
  askAboutCall, declineRecording, dismissConsent, recordingUnsupported, retryUpload, startRecording, stopRecording, toggleCallCaptions, useCallExtras,
  useCaptionLines,
} from './callExtras.js';

/** Who is recording the call right now (someone still in it, or me), or null. */
export function useActiveRecorder() {
  const recorder = useCallExtras((s) => s.recorder);
  const mine = useCallExtras((s) => s.recording);
  const present = useHuddle((s) => (recorder?.by ? s.participants.some((p) => p.userId === recorder.by) : false));
  const me = useSession((s) => String(s.user?.id || ''));
  if (mine) return { by: me, byName: 'You', mine: true };
  if (recorder && present && recorder.by !== me) return { ...recorder, mine: false };
  return null;
}

/** A transcript as a list of lines; recording notices show as small system lines. */
export function TranscriptList({ segments, className }) {
  const me = useSession((s) => String(s.user?.id || ''));
  const list = segments || [];
  const origin = list[0]?.startedAt;
  return (
    <ol className={cx('selectable space-y-2.5', className)} aria-label="Transcript">
      {list.map((s) =>
        noticeKind(s.text) ? (
          <li key={s.id} className="flex items-center gap-2 text-[12px] text-text-3">
            <Icon as={Disc} size={12} className="text-danger" />
            <span>{s.text.replace(/^\[[^\]]+\]\s*/, '')}</span>
            <span className="tabular-nums">{offsetLabel(s.startedAt, origin)}</span>
          </li>
        ) : (
          <li key={s.id} className="text-[14px] leading-relaxed">
            <span className="mr-2 text-[12px] text-text-3 tabular-nums">{offsetLabel(s.startedAt, origin) || '0:00'}</span>
            <span className="font-semibold">{s.speakerId && s.speakerId === me ? 'You' : s.speakerName}</span>
            <span className="text-text-2">: </span>
            <span>{s.text}</span>
          </li>
        ),
      )}
    </ol>
  );
}

const SUGGESTIONS = ['Summarise the meeting so far', 'What has been decided?', 'List the action items and owners'];

/** "Ask AI about this meeting": a question, an answer from the transcript. ask(question) → { text }. */
export function AskMeetingSheet({ open, onClose, ask, hint }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (q) => {
    const text = String(q || question).trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    setAsked(text);
    try {
      const res = await ask(text);
      setAnswer(res.text || 'No answer came back.');
      setQuestion('');
    } catch (err) {
      setError(err.message || "Oruinwan AI couldn't answer right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Ask about this meeting" full>
      <div className="space-y-4 px-5 pb-6">
        <p className="text-[13px] text-text-2">{hint || 'Answers come from the meeting’s transcript (live captions), so turn captions on for the best results.'}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex items-end gap-2"
        >
          <Field className="min-w-0 flex-1" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What did we decide about the launch?" aria-label="Question" enterKeyHint="send" />
          <Button type="submit" icon={Sparkles} loading={busy} disabled={!question.trim()} className="h-12">
            Ask
          </Button>
        </form>
        {!answer && !busy && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => run(s)} className="pressable rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px]">
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
        {(answer || busy) && (
          <div className="rounded-card border border-line-soft bg-surface p-4" style={{ backgroundImage: 'var(--glass)' }} aria-live="polite">
            <p className="mb-2 text-[12px] font-medium text-text-3">{asked}</p>
            {busy ? <p className="text-[14px] text-text-2">Thinking…</p> : <Markdown text={answer} />}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function CallTranscriptSheet({ open, onClose }) {
  const segments = useCallExtras((s) => s.segments);
  const captions = useCallExtras((s) => s.captions);
  return (
    <Sheet open={open} onClose={onClose} title="Transcript" full>
      <div className="px-5 pb-6">
        {segments.length ? (
          <TranscriptList segments={segments} />
        ) : (
          <EmptyState
            icon={ScrollText}
            title="Nothing transcribed yet"
            body={captions ? 'What people say shows here as they speak.' : 'Turn on live captions from the call menu: what people say is transcribed here.'}
            className="py-8"
          />
        )}
      </div>
    </Sheet>
  );
}

/** The call menu, opened from the call bar. */
export function CallMenu({ open, onClose }) {
  const showCaptions = useCallExtras((s) => s.showCaptions);
  const mine = useCallExtras((s) => s.recording);
  const uploading = useCallExtras((s) => s.uploading);
  const failed = useCallExtras((s) => s.failedUpload);
  const active = useActiveRecorder();
  const [sheet, setSheet] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const isMeeting = useHuddle((s) => Boolean(s.call?.huddleId?.startsWith('meeting-')));
  const unsupported = recordingUnsupported();

  const actions = [
    { label: showCaptions ? 'Turn off live captions' : 'Turn on live captions', icon: showCaptions ? CaptionsOff : Captions, hint: showCaptions ? null : 'What people say, as text, saved to the transcript', onSelect: toggleCallCaptions },
    mine
      ? { label: 'Stop recording', icon: CircleStop, danger: true, hint: 'The recording uploads to this call', onSelect: stopRecording }
      : active
        ? { label: `${active.byName} is recording`, icon: Disc, hint: 'One recording at a time', onSelect: () => {} }
        : { label: 'Record this call', icon: Disc, hint: unsupported || (uploading ? 'Uploading the last recording…' : 'Everyone in the call is told'), onSelect: () => !unsupported && setConfirm(true) },
    failed && { label: 'Retry recording upload', icon: RotateCcw, onSelect: retryUpload },
    { label: 'Transcript', icon: ScrollText, onSelect: () => setSheet('transcript') },
    { label: 'Ask AI about this meeting', icon: Sparkles, onSelect: () => setSheet('ai') },
  ];

  return (
    <>
      <ActionSheet open={open} onClose={onClose} title="Call" actions={actions} />
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Record this call?"
        footer={
          <div className="flex gap-2.5">
            <Button variant="secondary" block onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              block
              icon={Disc}
              onClick={() => {
                setConfirm(false);
                startRecording();
              }}
            >
              Start recording
            </Button>
          </div>
        }
      >
        <div className="space-y-2 px-5 pb-4 text-[14px] leading-relaxed text-text-2">
          <p>Everyone in the call sees that you are recording, and it is noted in the transcript.</p>
          <p>The call’s audio is saved to this {isMeeting ? 'meeting' : 'huddle'} when you stop recording or leave. Anyone who can see the call can play it.</p>
        </div>
      </Sheet>
      <CallTranscriptSheet open={sheet === 'transcript'} onClose={() => setSheet(null)} />
      <AskMeetingSheet open={sheet === 'ai'} onClose={() => setSheet(null)} ask={askAboutCall} />
    </>
  );
}

/** Live captions under the call bar. */
export function CaptionStrip() {
  const show = useCallExtras((s) => s.showCaptions);
  const listening = useCallExtras((s) => s.captions);
  const lines = useCaptionLines();
  if (!show) return null;
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Live captions"
      data-testid="caption-strip"
      className="glass fixed inset-x-3 z-[59] mx-auto max-w-2xl rounded-2xl border px-3.5 py-2.5"
      style={{ top: 'calc(env(safe-area-inset-top) + 124px)' }}
    >
      {lines.length ? (
        <ul className="space-y-1">
          {lines.map((l) => (
            <li key={l.key} className={cx('text-[14px] leading-snug', l.live && 'text-text-2')}>
              <span className="font-semibold">{l.name}: </span>
              {l.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-text-2">{listening ? 'Listening… captions appear as people speak.' : 'Captions from others appear here. Your speech can’t be captioned on this device.'}</p>
      )}
    </div>
  );
}

/** Shown to everyone else in the call while someone records it. */
export function RecordingConsentBanner() {
  const active = useActiveRecorder();
  const seen = useCallExtras((s) => s.consentSeen);
  if (!active || active.mine || seen) return null;
  return (
    <div
      role="alertdialog"
      aria-label="This call is being recorded"
      data-testid="recording-consent"
      className="glass-strong fixed inset-x-3 z-[61] mx-auto flex max-w-2xl flex-col gap-2.5 rounded-2xl border px-3.5 py-3 animate-sheet-in sm:flex-row sm:items-center"
      style={{ top: 'calc(env(safe-area-inset-top) + 8px)', borderLeft: '3px solid rgb(var(--c-danger))' }}
    >
      <span className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon as={Disc} size={18} className="mt-0.5 shrink-0 text-danger" />
        <span className="min-w-0 text-[14px] leading-snug">
          <span className="font-semibold">{active.byName} is recording this call.</span>{' '}
          <span className="text-text-2">The audio is saved for people who can see the call. Stay to agree, or leave.</span>
        </span>
      </span>
      <span className="flex shrink-0 gap-2">
        <Button size="sm" variant="secondary" onClick={declineRecording}>
          Leave call
        </Button>
        <Button size="sm" onClick={dismissConsent}>
          OK
        </Button>
      </span>
    </div>
  );
}

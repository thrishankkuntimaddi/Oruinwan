// Contact support: send a request to the Oruinwan team and follow its replies, all in the app.
// Requests go to the server's support desk (/api/support), the same one the web app's Help uses.
import { useState } from 'react';
import { LifeBuoy, Mail, Plus, Send } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { invalidate, useQuery } from '../../data/query.js';
import { APP_VERSION } from '../../config/env.js';
import { openExternal, platformLabel } from '../../native/index.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field, Segmented } from '../../ui/Controls.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';

export const SUPPORT_EMAIL = 'admin@poelys.com';

const STATUS = {
  open: { label: 'Open', tone: 'bg-accent/15 text-accent-ink' },
  'in-progress': { label: 'In progress', tone: 'bg-warning/15 text-warning' },
  resolved: { label: 'Resolved', tone: 'bg-success/15 text-success' },
  closed: { label: 'Closed', tone: 'bg-surface-3 text-text-2' },
};

const CATEGORIES = [
  { value: 'problem', label: 'Problem' },
  { value: 'question', label: 'Question' },
  { value: 'feedback', label: 'Idea' },
];

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.open;
  return <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', s.tone)}>{s.label}</span>;
}

/** App version and device, attached to every request so support can reproduce it. */
function supportContext() {
  return { path: 'mobile/settings/support', appVersion: `${APP_VERSION} (${platformLabel})`, userAgent: globalThis.navigator?.userAgent || '' };
}

/** A prefilled email, for when the server can't be reached. */
export function emailSupport(subject = 'Oruinwan app') {
  const body = `\n\n---\nApp ${APP_VERSION} · ${platformLabel}\n${globalThis.navigator?.userAgent || ''}`;
  openExternal(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
}

export function SupportScreen() {
  const signedIn = useSession((s) => s.mode === 'live');
  const { data: tickets, loading, error, refetch } = useQuery(signedIn ? 'support:mine' : null, () => api().supportTickets());

  return (
    <Screen>
      <Header title="Contact support" />
      <Body onRefresh={refetch}>
        <p className="px-4 pt-2 text-sm leading-relaxed text-text-2">
          Tell us what went wrong or what you'd like. We reply here, usually within a day.
        </p>
        <div className="px-4 pt-3">
          <Button icon={Plus} block onClick={() => nav.push('settings.support.new')} disabled={!signedIn}>
            New request
          </Button>
        </div>
        <Section title="Your requests">
          {loading && !tickets ? (
            <SkeletonRows count={3} avatar={false} />
          ) : error ? (
            <p className="px-4 text-sm text-text-2">Your requests couldn't be loaded. Pull down to try again, or email us below.</p>
          ) : tickets?.length ? (
            <RowGroup>
              {tickets.map((t) => (
                <Row
                  key={t.id}
                  title={t.subject}
                  subtitle={`${t.replies.length ? `${t.replies.length} ${t.replies.length === 1 ? 'reply' : 'replies'} · ` : ''}${shortAgo(t.updatedAt || t.createdAt)}`}
                  trailing={<StatusPill status={t.status} />}
                  onClick={() => nav.push('settings.support.ticket', { id: t.id })}
                />
              ))}
            </RowGroup>
          ) : (
            <EmptyState icon={LifeBuoy} title="No requests yet" body="Anything you send shows up here with our replies." className="py-8" />
          )}
        </Section>
        <Section title="Other ways">
          <RowGroup>
            <Row icon={Mail} tile="accent" title="Email us" subtitle={SUPPORT_EMAIL} onClick={() => emailSupport()} />
            <Row icon={LifeBuoy} tile="accent" title="Help center" subtitle="Answers to common questions" onClick={() => nav.push('settings.help')} />
          </RowGroup>
        </Section>
      </Body>
    </Screen>
  );
}

export function NewSupportRequestScreen({ category: initial = 'problem' }) {
  const [category, setCategory] = useState(initial);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = subject.trim() && description.trim();

  const send = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await api().createSupportTicket({ subject: subject.trim(), description: description.trim(), category, context: supportContext() });
      toast("Sent. We'll reply in Contact support.");
      nav.back();
      invalidate('support:mine');
    } catch (err) {
      toast(err.message || "Couldn't send it. Try again, or email us.", 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="New request" />
      <Body>
        <div className="space-y-4 px-4 pt-2 pb-6">
          <Segmented value={category} onChange={setCategory} options={CATEGORIES} />
          <Field label="Subject" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} placeholder="A short summary" />
          <Field
            label="What happened?"
            multiline
            value={description}
            maxLength={5000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={category === 'problem' ? 'What you did, what you expected, and what happened instead' : 'Tell us more'}
          />
          <p className="text-xs leading-relaxed text-text-3">
            We attach the app version ({APP_VERSION}) and your device type. Never your messages.
          </p>
          <Button icon={Send} block onClick={send} disabled={!ready || busy}>
            {busy ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </Body>
    </Screen>
  );
}

export function SupportTicketScreen({ id }) {
  const { data: tickets, loading, refetch } = useQuery('support:mine', () => api().supportTickets());
  const ticket = (tickets || []).find((t) => t.id === id);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = reply.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await api().replySupportTicket(id, text);
      setReply('');
      await refetch();
    } catch (err) {
      toast(err.message || "Couldn't send your reply.", 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (!ticket) {
    return (
      <Screen>
        <Header title="Request" />
        <Body>{loading ? <SkeletonRows count={3} avatar={false} /> : <p className="px-4 py-8 text-center text-sm text-text-2">This request couldn't be found.</p>}</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={ticket.subject} subtitle={STATUS[ticket.status]?.label} />
      <Body onRefresh={refetch}>
        <div className="space-y-3 px-4 pt-2 pb-4">
          <div className="rounded-card border border-line-soft bg-surface p-3.5">
            <p className="text-xs text-text-3">You · {shortAgo(ticket.createdAt)}</p>
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">{ticket.description}</p>
          </div>
          {ticket.replies.map((r) => (
            <div key={r.id} className={cx('rounded-card border p-3.5', r.fromSupport ? 'border-accent/30 bg-accent/8' : 'border-line-soft bg-surface')}>
              <p className="text-xs text-text-3">{r.fromSupport ? 'Oruinwan support' : 'You'} · {shortAgo(r.at)}</p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">{r.text}</p>
            </div>
          ))}
          <Field label="Reply" multiline value={reply} maxLength={5000} onChange={(e) => setReply(e.target.value)} placeholder="Add more details or answer our question" />
          <Button icon={Send} block onClick={send} disabled={!reply.trim() || busy}>
            {busy ? 'Sending…' : 'Send reply'}
          </Button>
        </div>
      </Body>
    </Screen>
  );
}

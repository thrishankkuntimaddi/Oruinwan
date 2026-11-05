import React from 'react';
import { CalendarDays, CreditCard, Mail, RotateCcw, Undo2, Users, XCircle } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, DocLayout } from '../../components/public/PublicKit';

// Cancellation & refund policy for Pro (paid through Razorpay: server/src/features/billing).
// Razorpay checks this page when activating the account; keep it in step with docs/BUSINESS_MODEL.md.

const SUPPORT = 'admin@poelys.com';
const List = ({ items }) => <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>;

const SECTIONS = [
    {
        id: 'plans',
        icon: CreditCard,
        title: 'What you pay for',
        content: (
            <>
                <p>Oruinwan Free costs nothing. Oruinwan Pro is a subscription for a workspace, billed per member,
                    monthly or yearly, in US dollars or Indian rupees. Payments are processed by Razorpay (cards, UPI and net banking).</p>
                <p>Pro is a digital service: it is switched on for the workspace as soon as the payment goes through. Nothing is shipped.</p>
            </>
        ),
    },
    {
        id: 'cancel',
        icon: XCircle,
        title: 'Cancelling',
        content: (
            <>
                <p>The workspace owner can cancel at any time on <strong>Plans and pricing</strong> (choose <em>Stop renewing</em>), or by writing to us.</p>
                <List items={[
                    'Cancelling stops the next renewal. Nothing more is charged.',
                    'The workspace stays on Pro until the end of the period already paid for, then moves to Free.',
                    'Nothing is deleted when a workspace moves to Free. Only new additions above the Free limits are refused.',
                ]} />
            </>
        ),
    },
    {
        id: 'refunds',
        icon: Undo2,
        title: 'Refunds',
        content: (
            <>
                <p>We don’t refund partial periods. When you cancel, you keep Pro until the paid period ends instead.</p>
                <p>We do refund in full when:</p>
                <List items={[
                    'you were charged twice for the same period, or charged after cancelling;',
                    'a payment went through but the workspace never moved to Pro and we couldn’t fix it within 3 business days;',
                    'the law where you live requires a refund.',
                ]} />
                <p>Write to <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> within 30 days of the charge, with the workspace name and the Razorpay payment id from your receipt.
                    Approved refunds go back to the original payment method; Razorpay and your bank usually take 5–7 business days.</p>
            </>
        ),
    },
    {
        id: 'members',
        icon: Users,
        title: 'Members joining or leaving',
        content: (
            <p>Pro is priced per member. When people join or leave, the new member count is used from the next charge.
                There are no extra charges or credits in the middle of a period.</p>
        ),
    },
    {
        id: 'failed',
        icon: RotateCcw,
        title: 'Failed payments',
        content: (
            <p>If a renewal fails, Razorpay tries again over the next few days and the workspace stays on Pro meanwhile.
                If every try fails, the subscription stops and the workspace moves to Free. Upgrade again at any time.</p>
        ),
    },
    {
        id: 'contact',
        icon: Mail,
        title: 'Contact',
        content: (
            <div className="orw-contact-card">
                <strong>Email:</strong> <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a><br />
                <strong>Response time:</strong> Within 2 business days
            </div>
        ),
    },
];

export default function Refunds() {
    return (
        <PublicPageShell title="Cancellation & Refund Policy">
            <PageHero
                crumb="Cancellation & Refunds"
                eyebrow="Cancellation & Refund Policy"
                icon={Undo2}
                title={<>Cancel any time. <span className="orw-gloss-text">No surprises.</span></>}
                lead={<>How cancelling Oruinwan Pro works, and when we refund. Questions: <a className="orw-link" style={{ fontSize: 'inherit' }} href={`mailto:${SUPPORT}`}>{SUPPORT}</a>.</>}
                meta={<span><CalendarDays size={14} aria-hidden="true" /> Last updated: November 5, 2026</span>}
            />
            <DocLayout numbered sections={SECTIONS} tocLabel="Contents" />
        </PublicPageShell>
    );
}

import React from 'react';
import { Trash2, Smartphone, Monitor, Mail, Database, CalendarDays } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, DocLayout } from '../../components/public/PublicKit';

// Public page for app stores (Google Play's account deletion requirement): how to delete an
// Oruinwan account and what happens to its data. Linked from the Play Console data safety form.

const List = ({ items }) => <ul>{items.map(t => <li key={t}>{t}</li>)}</ul>;

const SECTIONS = [
    {
        id: 'phone',
        icon: Smartphone,
        title: 'In the Android or iPhone app',
        content: (
            <List items={[
                'Open Oruinwan and sign in.',
                'Go to Settings → Data & storage.',
                'Under Your account, tap Delete account.',
                'Type DELETE to confirm. Your account is erased straight away.',
            ]} />
        ),
    },
    {
        id: 'web',
        icon: Monitor,
        title: 'On the web or the desktop app',
        content: (
            <List items={[
                'Sign in at oruinwan.poelys.com (or open the desktop app).',
                'Open Settings → Your data.',
                'Choose Delete account and type DELETE to confirm.',
            ]} />
        ),
    },
    {
        id: 'email',
        icon: Mail,
        title: "Can't sign in?",
        content: (
            <>
                <p>Email us from the address on your account and ask for it to be deleted. We confirm the request with you and erase the account within 30 days.</p>
                <div className="orw-contact-card">
                    <strong>Email:</strong> <a href="mailto:admin@poelys.com?subject=Delete%20my%20Oruinwan%20account">admin@poelys.com</a><br />
                    <strong>Subject:</strong> Delete my Oruinwan account
                </div>
            </>
        ),
    },
    {
        id: 'data',
        icon: Database,
        title: 'What is deleted and what is kept',
        content: (
            <>
                <p>Deleting your account is immediate and permanent. There is no grace period.</p>
                <h3>Deleted</h3>
                <List items={[
                    'Your profile: name, email address, date of birth, photo and password',
                    'Your sign-in details, sessions, devices, encryption keys and workspace memberships',
                    'Your Oruinwan AI memory, private notes and notification settings',
                ]} />
                <h3>Kept</h3>
                <List items={[
                    'Messages you sent in channels and direct messages stay for the other members, shown as “[Deleted User]”.',
                    'Tasks and notes you shared with others stay in their workspace.',
                    'Accounts managed by a company, or under a legal hold, are deleted by the company admin instead.',
                ]} />
                <p>Only want to delete some data? Settings → Your data also lets you download your data and delete old messages automatically.</p>
            </>
        ),
    },
];

export default function DeleteAccount() {
    return (
        <PublicPageShell title="Delete your account">
            <PageHero
                crumb="Delete your account"
                eyebrow="Your data"
                icon={Trash2}
                title={<>Delete your <span className="orw-gloss-text">account.</span></>}
                lead="You can delete your Oruinwan account and its personal data at any time, from the app or by email."
                meta={<span><CalendarDays size={14} aria-hidden="true" /> Applies to Oruinwan on Android, iPhone, desktop and the web</span>}
            />
            <DocLayout numbered sections={SECTIONS} tocLabel="Contents" />
        </PublicPageShell>
    );
}

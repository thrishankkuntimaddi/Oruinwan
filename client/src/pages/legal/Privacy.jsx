import React from 'react';
import { Shield, Database, UserCheck, Lock, Mail, Eye, CalendarDays } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, DocLayout } from '../../components/public/PublicKit';

const List = ({ items }) => <ul>{items.map(t => <li key={t}>{t}</li>)}</ul>;

const SECTIONS = [
    {
        id: 'overview',
        icon: Eye,
        title: 'Privacy Overview',
        content: (
            <>
                <p>Oruinwan (“we,” “our,” or “us”) is committed to protecting the personal information of our users. This Privacy Policy governs how we collect, use, share, and protect your information when you use our platform, available at oruinwan.com and related subdomains.</p>
                <p>By accessing or using Oruinwan, you agree to the terms of this Privacy Policy. If you do not agree, please do not use the service.</p>
                <List items={[
                    'We do not sell your personal data to third parties.',
                    'You own your workspace content — always.',
                    'We collect only what is necessary to provide the service.',
                    'You can export or delete your data at any time.',
                ]} />
            </>
        ),
    },
    {
        id: 'collection',
        icon: Database,
        title: 'Data We Collect',
        content: (
            <>
                <p>We collect information in three ways: information you provide directly, information generated automatically as you use the platform, and information from third-party integrations you authorize.</p>
                <h3>Information You Provide</h3>
                <List items={[
                    'Account details (name, email, password hash)',
                    'Profile information (job title, avatar, bio)',
                    'Workspace and channel content (messages, files, notes, tasks)',
                    'Company registration details (name, domain, billing info)',
                ]} />
                <h3>Automatically Collected</h3>
                <List items={[
                    'IP address and device type',
                    'Browser type and OS',
                    'Feature usage and interaction metadata',
                    'Error reports and performance diagnostics',
                ]} />
            </>
        ),
    },
    {
        id: 'usage',
        icon: Shield,
        title: 'How We Use Your Data',
        content: (
            <>
                <p>We use your data exclusively to operate, improve, and support the Oruinwan platform. We never use your message content to train AI models without explicit consent.</p>
                <List items={[
                    'Provide and maintain the Oruinwan service',
                    'Authenticate your identity and manage sessions',
                    'Send transactional emails (invites, notifications, receipts)',
                    'Improve product features based on anonymized usage analytics',
                    'Comply with legal obligations and enforce our Terms',
                ]} />
                <p>We do not send marketing emails without explicit opt-in. You can manage notification preferences from your account settings at any time.</p>
            </>
        ),
    },
    {
        id: 'rights',
        icon: UserCheck,
        title: 'Your Rights & Data Sharing',
        content: (
            <>
                <p>Depending on your jurisdiction, you have specific rights over your personal data. We honor all of them by default regardless of location.</p>
                <ul>
                    <li><strong>Access</strong> — request a copy of all data we hold about you</li>
                    <li><strong>Correction</strong> — update inaccurate or incomplete data</li>
                    <li><strong>Deletion</strong> — request erasure of your account and associated data</li>
                    <li><strong>Portability</strong> — export your workspace data in machine-readable format</li>
                    <li><strong>Objection</strong> — object to processing based on legitimate interests</li>
                </ul>
                <h3>When We Share Data</h3>
                <p>We only share data with: (1) infrastructure providers operating under strict DPA agreements, (2) legal authorities when required by court order, and (3) parties you explicitly authorize through integrations.</p>
            </>
        ),
    },
    {
        id: 'security',
        icon: Lock,
        title: 'Security',
        content: (
            <>
                <p>Oruinwan uses industry-standard security practices to protect your data at rest and in transit.</p>
                <List items={[
                    'AES-256 encryption for all data at rest',
                    'TLS 1.3 for all data in transit',
                    'Regular penetration testing and security audits',
                    'Role-based access controls on all internal systems',
                    'Automatic session expiry and anomaly detection',
                ]} />
                <p>Oruinwan AI processes workspace data only within your tenant’s isolated compute environment. No cross-tenant data access is possible by design.</p>
            </>
        ),
    },
    {
        id: 'contact',
        icon: Mail,
        title: 'Contact Us',
        content: (
            <>
                <p>For privacy-related requests, questions, or concerns, please contact our Data Protection team:</p>
                <div className="orw-contact-card">
                    <strong>Email:</strong> <a href="mailto:privacy@oruinwan.com">privacy@oruinwan.com</a><br />
                    <strong>Response time:</strong> Within 5 business days<br />
                    <strong>Address:</strong> Oruinwan Inc., Data Protection Office
                </div>
            </>
        ),
    },
];

export default function Privacy() {
    return (
        <PublicPageShell title="Privacy Policy">
            <PageHero
                crumb="Privacy Policy"
                eyebrow="Privacy Policy"
                icon={Shield}
                title={<>Your privacy <span className="orw-gloss-text">matters.</span></>}
                lead="We built Oruinwan with privacy as a foundation — not an afterthought. This policy explains exactly what we collect, how we use it, and how you stay in control."
                meta={<span><CalendarDays size={14} aria-hidden="true" /> Effective date: January 1, 2026</span>}
            />
            <DocLayout numbered sections={SECTIONS} tocLabel="Contents" />
        </PublicPageShell>
    );
}

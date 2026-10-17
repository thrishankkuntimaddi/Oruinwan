import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Key, Server, Cpu, FileText, Mail, ArrowRight } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, DocLayout, Callout } from '../../components/public/PublicKit';
import BRAND from '../../shared/brand';

const List = ({ items }) => <ul>{items.map(t => <li key={t}>{t}</li>)}</ul>;

const SECTIONS = [
    {
        id: 'overview', icon: Shield, title: 'Security overview',
        content: (
            <>
                <p>Security isn’t a feature at {BRAND.name}; it’s a foundational commitment. Product decisions, architecture choices and vendor evaluations all start with the same question: how does this affect the people whose data we hold?</p>
                <List items={[
                    'End-to-end encryption for messages in channels and direct messages',
                    'Role-based permissions that give each person only the access they need',
                    'Audit and compliance logs for administrative activity',
                    'Workspace-level controls over features, retention and data exports',
                    'A responsible-disclosure channel for security researchers',
                ]} />
            </>
        ),
    },
    {
        id: 'encryption', icon: Lock, title: 'Encryption',
        content: (
            <>
                <p>Messages in channels and DMs are encrypted on your device before they leave it, using a separate key for every conversation. Our servers relay and store ciphertext for that message content.</p>
                <List items={[
                    'Per-conversation keys, shared with members through X25519 key agreement',
                    'Message content encrypted with AES-256-GCM using the browser’s native Web Crypto API',
                    'Your identity key is protected by your password and never leaves your control unencrypted',
                    'A recovery file lets you restore your identity key on a new device if you forget your password',
                    'Traffic between the apps and our servers travels over HTTPS',
                ]} />
                <Callout>
                    <strong>Keep your recovery file safe.</strong> Because message keys are unlocked with your password on your device, we can’t read your messages, and we can’t recover them for you without it.
                </Callout>
            </>
        ),
    },
    {
        id: 'infrastructure', icon: Server, title: 'Infrastructure',
        content: (
            <>
                <p>{BRAND.name} runs on managed cloud platforms, with application data separated by workspace and access checked on every request.</p>
                <List items={[
                    'Every API request is authenticated and authorised against the caller’s workspace and role',
                    'Encrypted message content is stored as ciphertext',
                    'Administrative actions are written to an audit log that admins can review',
                ]} />
            </>
        ),
    },
    {
        id: 'access', icon: Key, title: 'Access control',
        content: (
            <>
                <p>Access to workspaces and their data is controlled on a need-to-know basis and enforced at every layer.</p>
                <List items={[
                    'Four roles (owner, admin, manager and member) mapped to a permission matrix',
                    'Channel membership decides who receives a conversation’s encryption key',
                    'A complete audit trail of administrative actions',
                    'Sign in with email and password, or with Google or GitHub',
                ]} />
            </>
        ),
    },
    {
        id: 'ai', icon: Cpu, title: 'AI safety',
        content: (
            <>
                <p>{BRAND.ai} is an optional layer on top of your workspace, and admins decide whether it’s available.</p>
                <List items={[
                    `${BRAND.ai} runs inside the workspace you’re signed in to`,
                    'AI requests are processed by a third-party large-language-model provider',
                    `Workspace admins can turn ${BRAND.ai} off at any time from workspace settings`,
                ]} />
            </>
        ),
    },
    {
        id: 'compliance', icon: FileText, title: 'Compliance & transparency',
        content: (
            <>
                <p>We build the tools admins need to meet their own regulatory obligations, such as GDPR requests and records retention.</p>
                <List items={[
                    'Personal data export and account deletion',
                    'Workspace-wide data export for admins',
                    'Configurable retention policies and legal holds',
                    'Audit and compliance logs available to workspace admins',
                ]} />
                <p>Read how we handle personal data in our <Link to="/privacy">Privacy Policy</Link>.</p>
            </>
        ),
    },
    {
        id: 'contact', icon: Mail, title: 'Report a vulnerability',
        content: (
            <>
                <p>We take every security report seriously. If you discover a vulnerability in {BRAND.name}, please disclose it responsibly and give us reasonable time to fix it before sharing it publicly.</p>
                <div className="orw-contact-card">
                    <strong>Security email:</strong> <a href="mailto:security@oruinwan.com">security@oruinwan.com</a><br />
                    <strong>What to include:</strong> affected URL or feature, steps to reproduce, and the impact you observed<br />
                    <strong>Response:</strong> we aim to acknowledge critical issues within 24 hours
                </div>
            </>
        ),
    },
];

export default function Security() {
    return (
        <PublicPageShell title="Security">
            <PageHero
                crumb="Security"
                eyebrow="Security"
                icon={Shield}
                title={<>Security <span className="orw-gloss-text">by design.</span></>}
                lead={`${BRAND.name} was built with security in every layer, from on-device encryption to role-based access on the server.`}
                meta={<>
                    <span><Lock size={13} aria-hidden="true" />End-to-end encrypted messages</span>
                    <span><Key size={13} aria-hidden="true" />X25519 + AES-256-GCM</span>
                    <span><FileText size={13} aria-hidden="true" />Audit &amp; compliance logs</span>
                </>}
                actions={
                    <>
                        <a href="mailto:security@oruinwan.com" className="orw-btn orw-btn--primary orw-btn--lg">
                            <Mail size={16} aria-hidden="true" /> Report a vulnerability
                        </a>
                        <Link to="/status" className="orw-btn orw-btn--ghost orw-btn--lg">
                            System status <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                    </>
                }
            />
            <DocLayout sections={SECTIONS} tocLabel="Contents" />
        </PublicPageShell>
    );
}

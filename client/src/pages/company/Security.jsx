import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Key, Server, Cpu, FileText, Mail, ArrowRight, EyeOff } from 'lucide-react';
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
                    'Messages in channels and direct messages encrypted on your device',
                    'Messages are never shown to admins, and there are no per-person activity metrics',
                    'Email verification, passkeys and two-factor authentication',
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
                <p>Messages in channels and DMs are encrypted on your device, using a separate key for every conversation. They are encrypted in transit and stored encrypted at rest.</p>
                <List items={[
                    'Per-conversation keys, wrapped for each member with their RSA-OAEP identity key',
                    'Message content encrypted with AES-256-GCM using the platform’s native Web Crypto API',
                    'Your identity key is sealed by the server so your new devices unlock automatically after you sign in',
                    'Traffic between the apps and the server travels over HTTPS',
                ]} />
                <Callout>
                    <strong>Key escrow.</strong> The server also keeps an escrowed copy of each conversation key, protected by a server master key. It exists for two reasons: so AI agents can answer in encrypted conversations, and so you can recover access to your conversations after a password reset. Escrowed keys are never used to show messages to admins.
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
                    'Message content is stored encrypted; escrowed conversation keys are protected by a server master key',
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
                    'Sign in with email and password, or with Google; email verification for new accounts',
                    'Passkeys and two-factor authentication',
                ]} />
            </>
        ),
    },
    {
        id: 'privacy', icon: EyeOff, title: 'Privacy from admins',
        content: (
            <>
                <p>Admins run the workspace and the company console: people, workspaces, roles and permissions. They don’t get a window into conversations.</p>
                <List items={[
                    'Admins never see message content or message counts',
                    'There are no per-person activity metrics',
                    'Admin actions are recorded in the audit log',
                ]} />
            </>
        ),
    },
    {
        id: 'ai', icon: Cpu, title: 'AI agents',
        content: (
            <>
                <p>Agents (Claude, ChatGPT, Gemini and Grok) are optional. A workspace admin can install one for the workspace, or a member can connect one personally with their own API key.</p>
                <List items={[
                    'An agent only answers in the conversations it’s added to or mentioned in',
                    'To answer in an encrypted conversation, the server uses the escrowed conversation key',
                    'Requests to an agent are processed by that agent’s provider',
                    'Workspace admins can turn AI off from workspace settings',
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
                    'Configurable retention policies',
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
                lead={`${BRAND.name} was built with security in every layer, from messages encrypted on your device to role-based access on the server.`}
                meta={<>
                    <span><Lock size={13} aria-hidden="true" />Messages encrypted on your device</span>
                    <span><Key size={13} aria-hidden="true" />AES-256-GCM + RSA-OAEP</span>
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

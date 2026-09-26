import React from 'react';
import { ScrollText, Scale, AlertOctagon, FileText, AlertTriangle, Mail, CalendarDays } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, DocLayout } from '../../components/public/PublicKit';

const List = ({ items }) => <ul>{items.map(t => <li key={t}>{t}</li>)}</ul>;

const SECTIONS = [
    {
        id: 'general',
        icon: Scale,
        title: 'General Terms',
        content: (
            <>
                <p>By creating an account or using Oruinwan, you agree to these Terms of Service and our Privacy Policy. These Terms form a binding agreement between you and Oruinwan Inc.</p>
                <p>You must be at least 16 years old to use Oruinwan. If you’re using Oruinwan on behalf of a company, you represent that you have authority to bind that company to these Terms.</p>
                <ul>
                    <li>One account per person — do not share credentials</li>
                    <li>Keep your account password secure and confidential</li>
                    <li>You are responsible for all activity under your account</li>
                    <li>Notify us immediately at <a href="mailto:security@oruinwan.com">security@oruinwan.com</a> of any unauthorized access</li>
                </ul>
            </>
        ),
    },
    {
        id: 'usage',
        icon: AlertOctagon,
        title: 'Acceptable Use',
        content: (
            <>
                <p>Oruinwan is a professional collaboration platform. You agree not to use it in any way that violates laws, harms others, or disrupts the platform’s integrity.</p>
                <p><strong>You may not use Oruinwan to:</strong></p>
                <List items={[
                    'Transmit spam, malware, or phishing content',
                    'Harass, threaten, or impersonate other users',
                    'Scrape, reverse-engineer, or attempt to access non-public APIs',
                    'Use the platform for illegal activities or to facilitate fraud',
                    'Upload content that violates third-party intellectual property rights',
                    'Circumvent access controls, rate limits, or security measures',
                ]} />
                <p>We reserve the right to suspend or terminate accounts that violate these standards without prior notice.</p>
            </>
        ),
    },
    {
        id: 'content',
        icon: FileText,
        title: 'Content & Intellectual Property',
        content: (
            <>
                <p>You retain all ownership rights to content you create on Oruinwan — messages, files, notes, and tasks. You grant us a limited license to store, process, and display your content solely to provide the service.</p>
                <p>Oruinwan does not claim ownership of your content. We will never sell, license, or use it for advertising purposes.</p>
                <List items={[
                    'Oruinwan owns the platform, UI, codebase, and brand assets',
                    'You own all content uploaded or created in your workspace',
                    'By posting, you grant us a license to serve that content to authorized members',
                    'Content in deleted workspaces is purged within 30 days of deletion',
                ]} />
            </>
        ),
    },
    {
        id: 'liability',
        icon: AlertTriangle,
        title: 'Liability & Disclaimer',
        content: (
            <>
                <p>Oruinwan is provided “as is” and “as available.” While we work to keep the service available, we cannot guarantee uninterrupted service. We are not liable for data loss caused by user error, third-party services, or force majeure events.</p>
                <p>To the maximum extent permitted by law, Oruinwan’s total liability for any claim arising from use of the platform is limited to the greater of: (1) amounts paid by you to Oruinwan in the past 12 months, or (2) USD $100.</p>
                <p>We are not responsible for the content, actions, or policies of third-party integrations or external services linked from Oruinwan.</p>
            </>
        ),
    },
    {
        id: 'changes',
        icon: ScrollText,
        title: 'Changes to These Terms',
        content: (
            <>
                <p>We may revise these Terms from time to time. When we make material changes, we will notify you by email and/or an in-app notice at least 14 days before the changes take effect.</p>
                <p>Your continued use of Oruinwan after the effective date constitutes acceptance of the revised Terms. If you disagree, you may terminate your account before the changes take effect.</p>
            </>
        ),
    },
    {
        id: 'contact',
        icon: Mail,
        title: 'Contact',
        content: (
            <>
                <p>For legal inquiries, disputes, or Terms-related questions:</p>
                <div className="orw-contact-card">
                    <strong>Email:</strong> <a href="mailto:legal@oruinwan.com">legal@oruinwan.com</a><br />
                    <strong>Response time:</strong> Within 5 business days<br />
                    <strong>Governing law:</strong> Laws of Delaware, USA
                </div>
            </>
        ),
    },
];

export default function Terms() {
    return (
        <PublicPageShell title="Terms of Service">
            <PageHero
                crumb="Terms of Service"
                eyebrow="Terms of Service"
                icon={Scale}
                title={<>Clear, fair <span className="orw-gloss-text">terms.</span></>}
                lead={<>These Terms govern your use of Oruinwan. We’ve written them to be readable, not a legal maze. If you have questions, email us at <a className="orw-link" style={{ fontSize: 'inherit' }} href="mailto:legal@oruinwan.com">legal@oruinwan.com</a>.</>}
                meta={<span><CalendarDays size={14} aria-hidden="true" /> Last updated: January 1, 2026</span>}
            />
            <DocLayout numbered sections={SECTIONS} tocLabel="Contents" />
        </PublicPageShell>
    );
}

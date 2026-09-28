import React from 'react';
import {
    Github, Webhook, Hash, CheckSquare, Sparkles, Building2, Users, Layers, MessageSquare,
    Lock, Server, KeyRound, Laptop, Cpu, Cloud, Code2, Send, BellOff, Bell, MonitorSmartphone,
    FileText, Mic, Video, MonitorUp, ShieldCheck, Database,
} from 'lucide-react';

/*
 * Animated illustrations for the docs, in CSS only (see docs.css, "Figures").
 * Every figure's resting state is its final, fully visible frame; keyframes
 * start from hidden. So with reduced motion (animations off) or no JS the
 * picture is complete, and animation is progressive enhancement.
 * Figures play only while on screen (DocsPage toggles .is-playing).
 */

const Av = ({ c, children }) => <span className="fx-av" style={{ '--c': c }} aria-hidden="true">{children}</span>;

// ── Chat → thread → @Oruinwan answer streaming ─────────────────────────────
function ChatAI() {
    return (
        <div className="fx-win fx-chat">
            <div className="fx-win__bar"><Hash size={13} aria-hidden="true" /> launch <span className="fx-win__meta">12 members</span></div>
            <div className="fx-chat__body">
                <div className="fx-msg fx-a1">
                    <Av c="#8ea6ff">MC</Av>
                    <div><b>Maya Chen</b><p>Can we ship the beta on Friday?</p>
                        <span className="fx-thread fx-a2"><MessageSquare size={11} aria-hidden="true" /> 3 replies · last reply now</span>
                    </div>
                </div>
                <div className="fx-msg fx-a3">
                    <Av c="#f39a6b">AR</Av>
                    <div><b>Arjun Rao</b><p><span className="fx-mention">@Oruinwan</span> what is still open for the beta?</p></div>
                </div>
                <div className="fx-msg fx-msg--ai fx-a4">
                    <span className="fx-av fx-av--ai" aria-hidden="true"><Sparkles size={12} /></span>
                    <div>
                        <b>Oruinwan AI</b>
                        <p className="fx-stream">
                            <span className="fx-line fx-l1">Two tasks are still open for the beta:</span>
                            <span className="fx-line fx-l2">• ENG-41 Fix invite link expiry (In review)</span>
                            <span className="fx-line fx-l3">• ENG-44 Onboarding copy (To do, Maya)</span>
                            <span className="fx-caret" aria-hidden="true" />
                        </p>
                    </div>
                </div>
                <div className="fx-banner fx-a5"><Sparkles size={12} aria-hidden="true" /> Continuing with Oruinwan AI <span>Stop</span></div>
            </div>
        </div>
    );
}

// ── AI panel (private chat beside the workspace) ───────────────────────────
function AIPanel() {
    return (
        <div className="fx-win fx-aipanel">
            <div className="fx-win__bar"><Sparkles size={13} aria-hidden="true" /> Oruinwan AI <span className="fx-win__meta">⌘/Ctrl ⇧ A</span></div>
            <div className="fx-chat__body">
                <div className="fx-bubble fx-bubble--me fx-a1">What did we decide about the launch date?</div>
                <div className="fx-src fx-a2"><FileText size={11} aria-hidden="true" /> Searched 3 notes · 2 tasks · 1 knowledge page</div>
                <div className="fx-bubble fx-a3">
                    <span className="fx-line fx-l1">The team moved launch to <b>14 October</b></span>
                    <span className="fx-line fx-l2">(Launch plan note, updated Tuesday).</span>
                    <span className="fx-caret" aria-hidden="true" />
                </div>
                <div className="fx-stop fx-a4">■ Stop</div>
            </div>
        </div>
    );
}

// ── PR card in a channel, task chip In review → Done ───────────────────────
function PRCard() {
    return (
        <div className="fx-win fx-pr">
            <div className="fx-win__bar"><Hash size={13} aria-hidden="true" /> engineering</div>
            <div className="fx-chat__body">
                <div className="fx-msg fx-a1">
                    <span className="fx-av fx-av--gh" aria-hidden="true"><Github size={12} /></span>
                    <div className="fx-pr__card">
                        <b>GitHub</b>
                        <div className="fx-pr__box">
                            <div className="fx-pr__title"><span className="fx-pr__state"><span className="fx-pr__open">Open</span><span className="fx-pr__merged">Merged</span></span> #142 ENG-41 Fix invite link expiry</div>
                            <div className="fx-pr__meta">acme/web · feature/eng-41 → main · +48 −12</div>
                            <div className="fx-pr__row">
                                <span className="fx-task"><CheckSquare size={11} aria-hidden="true" /> ENG-41 <span className="fx-task__s1">In review</span><span className="fx-task__s2">Done</span></span>
                                <span className="fx-pr__ai fx-a3"><Sparkles size={11} aria-hidden="true" /> AI review: 2 suggestions</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Huddle with the in-call workspace panel ─────────────────────────────────
function Huddle() {
    return (
        <div className="fx-win fx-huddle">
            <div className="fx-win__bar"><span className="fx-pill"><span className="fx-pill__dot" /> In huddle · #design</span><span className="fx-win__meta">12:48</span></div>
            <div className="fx-huddle__body">
                <div className="fx-huddle__tiles">
                    <div className="fx-tile fx-tile--talk"><Av c="#8ea6ff">MC</Av><span>Maya</span></div>
                    <div className="fx-tile"><Av c="#f39a6b">AR</Av><span>Arjun</span></div>
                    <div className="fx-tile fx-tile--talk2"><Av c="#5cc995">LK</Av><span>Lena</span></div>
                    <div className="fx-huddle__ctrls" aria-hidden="true"><Mic size={12} /><Video size={12} /><MonitorUp size={12} /></div>
                </div>
                <div className="fx-huddle__side">
                    <div className="fx-tabs"><span className="is-on">Notes</span><span>Tasks</span><span>Chat</span></div>
                    <p className="fx-note"><span className="fx-line fx-l1">• Hero uses the new gradient</span></p>
                    <p className="fx-note"><span className="fx-line fx-l2">• Lena owns icon export</span></p>
                    <p className="fx-check fx-a3"><span className="fx-box" /> Export icons (Lena)</p>
                </div>
            </div>
            <div className="fx-toast fx-a5"><Sparkles size={12} aria-hidden="true" /> AI wrap-up posted to #design</div>
        </div>
    );
}

// ── Task card moving across the board ───────────────────────────────────────
function Board() {
    const cols = ['To do', 'In progress', 'In review', 'Done'];
    return (
        <div className="fx-win fx-board">
            <div className="fx-win__bar"><CheckSquare size={13} aria-hidden="true" /> Tasks · Board</div>
            <div className="fx-board__cols">
                {cols.map((c) => <div key={c} className="fx-board__col"><span>{c}</span><i /><i /></div>)}
                <div className="fx-board__card"><b>ENG-41</b> Fix invite link expiry</div>
            </div>
        </div>
    );
}

// ── Notification rules: viewing / elsewhere / background ────────────────────
function NotifyRules() {
    const lanes = [
        { icon: MessageSquare, title: 'You are viewing that chat', out: 'No alert: it is already on screen', cls: 'none', OutIcon: BellOff },
        { icon: Layers, title: 'Elsewhere in Oruinwan', out: 'In-app toast for DMs and @mentions', cls: 'toast', OutIcon: Bell },
        { icon: MonitorSmartphone, title: 'App in the background', out: 'One OS notification per conversation', cls: 'os', OutIcon: Bell },
    ];
    return (
        <div className="fx-notify">
            {lanes.map(({ icon: Icon, title, out, cls, OutIcon }, i) => (
                <div key={cls} className={`fx-lane fx-lane--${cls}`} style={{ '--i': i }}>
                    <div className="fx-lane__where"><Icon size={15} aria-hidden="true" /> {title}</div>
                    <div className="fx-lane__track" aria-hidden="true"><span className="fx-lane__dot" /></div>
                    <div className="fx-lane__out"><OutIcon size={14} aria-hidden="true" /> {out}</div>
                </div>
            ))}
        </div>
    );
}

// ── Hierarchy trees ─────────────────────────────────────────────────────────
function Tree({ root, rootIcon: RootIcon, branches }) {
    return (
        <div className="fx-tree">
            <div className="fx-tree__root"><RootIcon size={16} aria-hidden="true" /> {root}</div>
            <ul className="fx-tree__level">
                {branches.map((b, i) => (
                    <li key={b.title} style={{ '--i': i }}>
                        <div className="fx-tree__node"><b>{b.title}</b>{b.sub && <span>{b.sub}</span>}</div>
                        {b.leaves && (
                            <ul className="fx-tree__leaves">
                                {b.leaves.map((l, j) => <li key={l} style={{ '--j': j }}>{l}</li>)}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

const COMPANY_TREE = {
    root: 'Company HQ · acme.com (verified)', rootIcon: Building2,
    branches: [
        { title: 'Engineering', sub: 'Department · manager: Priya', leaves: ['Workspace: Platform', '# backend', '# releases'] },
        { title: 'Design', sub: 'Department · manager: Lena', leaves: ['Workspace: Brand', '# design', '# reviews'] },
        { title: 'Sales', sub: 'Department · manager: Omar', leaves: ['Workspace: Revenue', '# deals', '# general'] },
    ],
};
const WORKSPACE_TREE = {
    root: 'You', rootIcon: Users,
    branches: [
        { title: 'Workspace: Side project', sub: 'You are the owner', leaves: ['# general', '# random', 'DMs · Tasks · Notes'] },
        { title: 'Workspace: Book club', sub: 'Joined with an invite link', leaves: ['# general', '# picks', 'Huddles · Files'] },
    ],
};

// ── Left-to-right flows (stack vertically on phones) ────────────────────────
function Flow({ steps }) {
    return (
        <div className="fx-flow">
            {steps.map((s, i) => (s.link !== undefined
                ? <div key={i} className="fx-flow__link" style={{ '--i': i }}><span className="fx-flow__label">{s.link}</span><span className="fx-flow__wire" aria-hidden="true"><i /></span></div>
                : (
                    <div key={i} className="fx-flow__col" style={{ '--i': i }}>
                        {s.nodes.map(({ icon: Icon, title, sub, dashed }) => (
                            <div key={title} className={`fx-flow__node${dashed ? ' fx-flow__node--dashed' : ''}`}>
                                <span className="fx-flow__icon"><Icon size={15} aria-hidden="true" /></span>
                                <span><b>{title}</b>{sub && <small>{sub}</small>}</span>
                            </div>
                        ))}
                    </div>
                )))}
        </div>
    );
}

const FLOWS = {
    'github-flow': [
        { nodes: [{ icon: Github, title: 'GitHub', sub: 'push, pull_request, review…' }] },
        { link: 'signed webhook' },
        { nodes: [{ icon: Webhook, title: 'Oruinwan', sub: 'verifies X-Hub-Signature-256' }] },
        { link: 'routes' },
        { nodes: [
            { icon: Hash, title: 'Channel card', sub: 'repo → #channel route' },
            { icon: CheckSquare, title: 'Task status', sub: 'ENG-41 → In review → Done' },
            { icon: Sparkles, title: 'AI review', sub: 'on request' },
        ] },
    ],
    'ai-engine': [
        { nodes: [{ icon: MessageSquare, title: 'You ask', sub: '@Oruinwan, AI panel, /ai' }] },
        { link: 'your workspace' },
        { nodes: [{ icon: Server, title: 'Oruinwan server', sub: 'adds context you can see' }] },
        { link: 'streams back' },
        { nodes: [
            { icon: Cpu, title: 'Oruinwan Engine', sub: 'local models (default)' },
            { icon: Cloud, title: 'Outside provider', sub: 'only if an admin sets it', dashed: true },
        ] },
    ],
    'api-flow': [
        { nodes: [{ icon: Code2, title: 'Your app or script', sub: 'curl, SDK, any HTTP client' }] },
        { link: 'X-Api-Key: chx_…' },
        { nodes: [{ icon: Server, title: '/api/public/*', sub: 'scope check · 100 req/min' }] },
        { link: 'JSON' },
        { nodes: [{ icon: Database, title: 'One workspace', sub: 'tasks, channels, files, users' }] },
    ],
    'webhook-flow': [
        { nodes: [{ icon: CheckSquare, title: 'Something happens', sub: 'task.created, message.sent…' }] },
        { link: 'POST, HMAC-SHA256' },
        { nodes: [{ icon: Send, title: 'Your endpoint', sub: 'checks X-Chttrix-Signature' }] },
        { link: '2xx' },
        { nodes: [{ icon: ShieldCheck, title: 'Delivered', sub: 'else retried (3 attempts)' }] },
    ],
    e2ee: [
        { nodes: [{ icon: Laptop, title: 'Your device', sub: 'encrypts with the conversation key' }] },
        { link: 'ciphertext only' },
        { nodes: [
            { icon: Server, title: 'Oruinwan servers', sub: 'store encrypted text' },
            { icon: KeyRound, title: 'Wrapped key copy', sub: 'lets new members join', dashed: true },
        ] },
        { link: 'ciphertext' },
        { nodes: [{ icon: Lock, title: 'Teammate’s device', sub: 'decrypts locally' }] },
    ],
};

const FIGURES = {
    'chat-ai': { el: <ChatAI />, label: 'A channel conversation: a message gets thread replies, someone asks @Oruinwan, and the AI answer streams in line by line.' },
    'ai-panel': { el: <AIPanel />, label: 'The Oruinwan AI panel answering a question from workspace notes and tasks, with a Stop button while it streams.' },
    'pr-card': { el: <PRCard />, label: 'A GitHub pull request card posted in a channel; the linked task chip changes from In review to Done when the PR is merged.' },
    huddle: { el: <Huddle />, label: 'A huddle with three people, shared notes being typed in the side panel, a task checked off, and the AI wrap-up posted to the channel.' },
    board: { el: <Board />, label: 'A task card moving across the board from To do to Done.' },
    'notify-rules': { el: <NotifyRules />, label: 'Notification rules: nothing for the chat you are viewing, an in-app toast for DMs and mentions when you are elsewhere, and one OS notification per conversation when the app is in the background.' },
    'company-tree': { el: <Tree {...COMPANY_TREE} />, label: 'Company HQ with a verified domain, departments with managers, and each department’s workspaces and channels.' },
    'workspace-tree': { el: <Tree {...WORKSPACE_TREE} />, label: 'One account belonging to two workspaces, each with its own channels, DMs, tasks and notes.' },
    ...Object.fromEntries(Object.entries(FLOWS).map(([id, steps]) => [id, {
        el: <Flow steps={steps} />,
        label: steps.map((s) => (s.link !== undefined ? `then ${s.link}` : s.nodes.map((n) => `${n.title}${n.sub ? ` (${n.sub})` : ''}`).join(' / '))).join(', '),
    }])),
};

export const FIGURE_IDS = Object.keys(FIGURES);

export default function DocsFigure({ id, caption }) {
    const f = FIGURES[id];
    if (!f) return null;
    return (
        <figure className={`docs-fig docs-fig--${id}`} data-docs-play data-docs-reveal>
            <div className="docs-fig__stage" role="img" aria-label={f.label}>
                <div aria-hidden="true" className="docs-fig__inner">{f.el}</div>
            </div>
            {caption && <figcaption className="docs-fig__cap">{caption}</figcaption>}
        </figure>
    );
}

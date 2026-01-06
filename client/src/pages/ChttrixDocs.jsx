import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import {
  BookOpen,
  MessageSquare,
  CheckSquare,
  Zap,
  LifeBuoy,
  Shield,
  Users,
  Search,
  Command,
  Sparkles,
  Menu,
  X,
  ArrowRight,
  Video,
  FileText,
  BellRing,
  Sun,
  Moon,
  Building2,
  Lock,
  UserCheck,
  CreditCard,
  AlertTriangle,
  Globe
} from "lucide-react";

const ChttrixDocs = () => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setMobileMenuOpen(false);
  };

  const NavItem = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => scrollToSection(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group ${activeTab === id
        ? "bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-white"
        }`}
    >
      {Icon && <Icon size={18} className={activeTab === id ? "text-white" : "text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-white"} />}
      <span className="text-sm">{label}</span>
    </button>
  );

  return (
    <div className="h-full w-full bg-white dark:bg-[#030712] text-slate-900 dark:text-white overflow-hidden flex flex-col md:flex-row font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-500">

      {/* Global Styles for Docs */}
      <style>{`
                 ::-webkit-scrollbar { width: 8px; }
                 ::-webkit-scrollbar-track { background: transparent; }
                 ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                 .dark ::-webkit-scrollbar-thumb { background: #334155; }
                 ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                 .dark ::-webkit-scrollbar-thumb:hover { background: #475569; }
                 
                 h2 {
                     margin-top: 3rem; margin-bottom: 1.5rem; font-size: 1.875rem; font-weight: 800; letter-spacing: -0.025em;
                 }
                 .dark h2 {
                     background: linear-gradient(to right, #ffffff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                 }
                 h3 {
                     font-size: 1.25rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; color: #1e293b;
                 }
                 .dark h3 { color: #e2e8f0; }
                 
                 p { margin-bottom: 1.5rem; line-height: 1.75; font-size: 1.05rem; }
                 .card-glow:hover { box-shadow: 0 0 30px rgba(99, 102, 241, 0.15); border-color: rgba(99, 102, 241, 0.5); }
                 
                 ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.5rem; }
                 li { margin-bottom: 0.5rem; color: #475569; }
                 .dark li { color: #94a3b8; }
                 
                 .badge { display: inline-flex; align-items: center; padding: 0.125rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
             `}</style>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-[#0B0F19] border-b border-slate-200 dark:border-white/5 z-50">
        <div className="flex items-center gap-2">
          <img src="/chttrix-logo.jpg" alt="Logo" className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-lg">Docs</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="p-2 text-slate-500">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-500">
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-0 z-40 bg-slate-50 dark:bg-[#0B0F19] border-r border-slate-200 dark:border-white/5 w-72 transform transition-transform duration-300 md:relative md:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-full flex flex-col overflow-y-auto custom-scrollbar p-6">
          <div className="flex items-center justify-between mb-10 px-2 mt-2">
            <div className="flex items-center gap-3">
              <img src="/chttrix-logo.jpg" alt="Logo" className="w-10 h-10 rounded-xl shadow-md" />
              <div>
                <h1 className="font-bold text-lg leading-tight text-slate-900 dark:text-white">Chttrix</h1>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">Docs</p>
              </div>
            </div>
          </div>

          <div className="space-y-8 flex-1">
            <div>
              <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Essentials</p>
              <div className="space-y-1">
                <NavItem id="overview" label="Overview" icon={BookOpen} />
                <NavItem id="personal" label="Personal Space" icon={Users} />
                <NavItem id="company" label="Company HQ" icon={Building2} />
              </div>
            </div>

            <div>
              <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Roles & Governance</p>
              <div className="space-y-1">
                <NavItem id="roles" label="Roles & Permissions" icon={UserCheck} />
                <NavItem id="channels" label="Channels & Access" icon={Lock} />
                <NavItem id="search" label="Universal Search" icon={Search} />
              </div>
            </div>

            <div>
              <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Features</p>
              <div className="space-y-1">
                <NavItem id="ai" label="Chttrix AI" icon={Sparkles} />
                <NavItem id="updates" label="Updates & Goals" icon={BellRing} />
                <NavItem id="productivity" label="Tasks & Notes" icon={CheckSquare} />
              </div>
            </div>

            <div>
              <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Admin</p>
              <div className="space-y-1">
                <NavItem id="plans" label="Plans & Billing" icon={CreditCard} />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-white/5 space-y-4">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              <span className="text-sm font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <Link to="/" className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors px-4">
              <ArrowRight size={16} className="rotate-180" /> Back to App
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto scroll-smooth bg-white dark:bg-[#030712] relative">
        <div className="max-w-4xl mx-auto px-8 py-20 pb-40 text-slate-600 dark:text-slate-400">

          {/* Hero */}
          <section id="overview" className="mb-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-8">
              Complete Manual
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white mb-8 leading-tight">
              The Chttrix <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">Operating System.</span>
            </h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              A deep dive into the features, governance, and architecture of the platform. Designed for individual power users and enterprise teams.
            </p>
          </section>

          <div className="h-px w-full bg-slate-200 dark:bg-white/5 mb-16"></div>

          <div className="prose-slate dark:prose-invert">

            {/* Personal Space */}
            <section id="personal" className="scroll-mt-20 mb-20">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-blue-100 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400"><Users size={28} /></div>
                <h2 className="!m-0 text-slate-900 dark:text-white">Personal Space</h2>
              </div>
              <p>
                Every user gets a Personal Workspace out of the box. This is your private sandbox for productivity and organization.
              </p>

              <div className="grid md:grid-cols-2 gap-6 not-prose mt-8">
                <div className="p-6 bg-slate-50 dark:bg-[#0F1623] rounded-2xl border border-slate-200 dark:border-white/5">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">Workspace Aware AI</h4>
                  <p className="text-sm">Chttrix AI acts as your PA. It can draft personal notes, schedule meetings, and organize your tasks based on your chat context.</p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-[#0F1623] rounded-2xl border border-slate-200 dark:border-white/5">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">Task Management</h4>
                  <p className="text-sm">Create personal tasks that are only visible to you. Assign tasks to others only if they are invited to your workspace.</p>
                </div>
              </div>
            </section>

            {/* Company HQ */}
            <section id="company" className="scroll-mt-20 mb-20">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400"><Building2 size={28} /></div>
                <h2 className="!m-0 text-slate-900 dark:text-white">Company HQ</h2>
              </div>
              <p>
                For organizations, Chttrix offers a hierarchical structure designed for scale. It starts with the **Company Layer**, which governs all workspaces, departments, and users.
              </p>

              <div className="space-y-8 mt-8">
                <div>
                  <h3 className="text-slate-900 dark:text-white">Multi-Tenancy Structure</h3>
                  <p>Your company is isolated with its own domain verification and breakdown:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Departments:</strong> (e.g., Engineering, Sales) act as containers for people and policies.</li>
                    <li><strong>Workspaces:</strong> Projects live here. Workspaces are <strong>department-scoped</strong> but can include cross-functional members.</li>
                    <li><strong>Locations:</strong> Assign physical or virtual locations to departments and employees.</li>
                  </ul>
                </div>

                <div className="bg-amber-50 dark:bg-amber-500/10 p-6 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                  <h4 className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-400 mb-2">
                    <AlertTriangle size={18} /> Strict Workspace Creation Policy
                  </h4>
                  <p className="text-sm text-amber-900 dark:text-amber-200 m-0">
                    Employees cannot create workspaces freely. They must request approval from a <strong>Manager</strong>. Once approved, the Manager is automatically involved in oversight.
                  </p>
                </div>
              </div>
            </section>

            {/* Roles & Governance */}
            <section id="roles" className="scroll-mt-20 mb-20">
              <h2 className="text-slate-900 dark:text-white">Roles & Governance</h2>
              <p>The system enforces a strict hierarchy to maintain order and security.</p>

              <div className="overflow-hidden border border-slate-200 dark:border-white/10 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white font-bold">
                    <tr>
                      <th className="p-4">Role</th>
                      <th className="p-4">Key Capabilities</th>
                      <th className="p-4">Limits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    <tr>
                      <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">Owner</td>
                      <td className="p-4">Total control. Create HQ, manage billing, allocate Admins.</td>
                      <td className="p-4">Max 3 per Company.</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-BOLD text-blue-600 dark:text-blue-400">Admin</td>
                      <td className="p-4">Monitor entire system. Verify domains, onboard/offboard users, view analytics.</td>
                      <td className="p-4">Cannot delete Company.</td>
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-green-600 dark:text-green-400">Manager</td>
                      <td className="p-4">Lead Departments. Approve workspaces. Monitor employee performance.</td>
                      <td className="p-4">Scoped to Departments.</td>
                    </tr>
                    <tr>
                      <td className="p-4">Employee</td>
                      <td className="p-4">Join workspaces, chat, create content.</td>
                      <td className="p-4">Cannot create WS without approval.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Channels & Access */}
            <section id="channels" className="scroll-mt-20 mb-20">
              <h2 className="text-slate-900 dark:text-white">Channel Architecture</h2>
              <p>Channels are the heart of a workspace. Chttrix enforces specific rules to ensure information flows correctly.</p>

              <div className="grid gap-6 mt-6">
                <div className="bg-white dark:bg-[#0F1623] p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                  <h3 className="mt-0 text-slate-900 dark:text-white">Default Channels</h3>
                  <p className="text-sm">
                    Every workspace comes with <strong>#general</strong> and <strong>#announcements</strong>.
                    <br />
                    <span className="text-red-500 font-bold">• Cannot be deleted.</span>
                    <br />
                    <span className="text-green-500 font-bold">• Auto-Join:</span> All workspace members are automatically added. They cannot leave.
                  </p>
                </div>

                <div className="bg-white dark:bg-[#0F1623] p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                  <h3 className="mt-0 text-slate-900 dark:text-white">Visibility Rules</h3>
                  <ul className="text-sm space-y-2">
                    <li><strong>Public Channels:</strong> Name is visible to everyone in workspace. Content only to joined members.</li>
                    <li><strong>Private Channels:</strong> Totally invisible to non-members. Only Creator/Admin/Owner can delete.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Universal Search */}
            <section id="search" className="scroll-mt-20 mb-20">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-fuchsia-100 dark:bg-fuchsia-500/10 rounded-xl text-fuchsia-600 dark:text-fuchsia-400"><Search size={28} /></div>
                <h2 className="!m-0 text-slate-900 dark:text-white">Universal Search</h2>
              </div>
              <p>
                Press <kbd className="px-2 py-1 bg-slate-200 dark:bg-white/10 rounded mx-1 text-sm font-mono">Cmd + K</kbd> anywhere.
              </p>
              <div className="bg-slate-50 dark:bg-[#0F1623] p-6 rounded-2xl border border-slate-200 dark:border-white/5">
                <p className="m-0 text-sm">
                  <strong>Scope: Company-Wide.</strong> You can search for any employee across any department.
                  <br />
                  However, content search is restricted to workspaces and channels you have access to.
                </p>
              </div>
            </section>

            {/* Chttrix AI */}
            <section id="ai" className="scroll-mt-20 mb-20">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-purple-100 dark:bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400"><Sparkles size={28} /></div>
                <h2 className="!m-0 text-slate-900 dark:text-white">Chttrix AI</h2>
              </div>
              <p>
                The AI is integrated into the core, but privacy is paramount.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 border border-purple-200 dark:border-purple-500/30 rounded-xl bg-purple-50 dark:bg-purple-900/5">
                  <Shield className="text-purple-600 dark:text-purple-400 shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Privacy by Default</h4>
                    <p className="text-sm">The AI <strong>only</strong> reads messages when:</p>
                    <ul className="text-sm m-0 pl-4 list-disc">
                      <li>You explicitly mention <code className="text-purple-600">@ChttrixAI</code>.</li>
                      <li>You click "Analyze Chat" (User Grant required).</li>
                    </ul>
                    <p className="text-sm mt-2">It does NOT scan background history without permission.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-200 dark:border-white/5 rounded-xl">
                    <h4 className="font-bold">Real-time Canvases</h4>
                    <p className="text-sm">Generate live documents and widgets inside any channel.</p>
                  </div>
                  <div className="p-4 border border-slate-200 dark:border-white/5 rounded-xl">
                    <h4 className="font-bold">Automated Support</h4>
                    <p className="text-sm">Raise tickets via the Help section. AI triages them to the right admin.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Updates */}
            <section id="updates" className="scroll-mt-20 mb-20">
              <h2 className="text-slate-900 dark:text-white">Company Updates</h2>
              <p>
                Think of this as a "Private Social Network" for your company.
              </p>
              <div className="bg-slate-50 dark:bg-[#0F1623] p-6 rounded-2xl border border-slate-200 dark:border-white/5">
                <p className="m-0">
                  <strong>Company-Level Scope.</strong> Updates are <strong>not</strong> bound to a workspace.
                  <br />
                  Any employee can post an update (like "Weekly Goals" or "Big Win"). It is visible to the entire organization, fostering cross-department transparency.
                </p>
              </div>
            </section>

            {/* Plans */}
            <section id="plans" className="scroll-mt-20 mb-20">
              <h2 className="text-slate-900 dark:text-white">Plans & Billing</h2>
              <div className="grid md:grid-cols-3 gap-6 not-prose mt-8">
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/5">
                  <h3 className="mt-0 text-xl font-bold">Free</h3>
                  <p className="text-sm text-slate-500 mb-4">For Personal Use</p>
                  <ul className="text-sm space-y-2">
                    <li>1 Personal Workspace</li>
                    <li>Basic AI</li>
                    <li>Community Support</li>
                  </ul>
                </div>
                <div className="p-6 rounded-2xl border-2 border-indigo-500 relative">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-bl-xl rounded-tr-lg">POPULAR</div>
                  <h3 className="mt-0 text-xl font-bold text-indigo-600">Pro</h3>
                  <p className="text-sm text-slate-500 mb-4">For Growing Teams</p>
                  <ul className="text-sm space-y-2">
                    <li>Auto Domain Verification</li>
                    <li>Unlimited History</li>
                    <li>Advanced AI Models</li>
                  </ul>
                </div>
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/5">
                  <h3 className="mt-0 text-xl font-bold">Enterprise</h3>
                  <p className="text-sm text-slate-500 mb-4">For Large Orgs</p>
                  <ul className="text-sm space-y-2">
                    <li>SAML / SSO</li>
                    <li>Dedicated Success Manager</li>
                    <li>Audit Logs</li>
                  </ul>
                </div>
              </div>
            </section>

            <footer className="mt-32 pt-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-600 text-sm">
              <p>© 2025 Chttrix Inc. Documentation v2.1</p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChttrixDocs;

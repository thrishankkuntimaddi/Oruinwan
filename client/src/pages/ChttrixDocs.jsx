import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import {
  BookOpen, MessageSquare, Hash, GitBranch, Users, CheckSquare, FileText,
  Shield, Search, Sparkles, BellRing, Settings, Sun, Moon, Building2,
  Lock, UserCheck, CreditCard, AlertTriangle, Check, Menu, X, ArrowRight,
  Key, Video, Mail, Workflow, Globe, Cpu, Zap, Layers, Command
} from "lucide-react";

const ChttrixDocs = () => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("intro");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Manual Scroll Spy Logic with Auto-Scroll Sidebar
  useEffect(() => {
    const handleScroll = () => {
      // Offset (200px) ensures we highlight the section *before* it hits the very top
      const scrollPosition = window.scrollY + 200;

      const sections = ['intro', 'getting-started', 'workspaces', 'channels', 'messaging',
        'tasks', 'notes', 'ai', 'search', 'updates', 'security', 'roles', 'settings'];

      for (const id of sections) {
        const element = document.getElementById(id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            if (activeTab !== id) {
              setActiveTab(id);
              // Auto-scroll sidebar to active item if needed
              const sidebarItem = document.getElementById(`nav-${id}`);
              if (sidebarItem) {
                sidebarItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  const scrollToSection = (id) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -24;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const NavItem = ({ id, label, icon: Icon }) => (
    <button
      id={`nav-${id}`}
      onClick={() => scrollToSection(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group ${activeTab === id
        ? "bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/50"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-white"
        }`}
    >
      {Icon && <Icon size={18} className={`transition-colors ${activeTab === id ? "text-indigo-200" : "text-slate-400 group-hover:text-indigo-500"}`} />}
      <span className="text-sm font-medium">{label}</span>
      {activeTab === id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
    </button>
  );

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-white flex flex-col md:flex-row font-sans transition-colors duration-500 selection:bg-indigo-500/30 selection:text-indigo-200">

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="/chttrix-logo.jpg" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className="font-bold text-lg tracking-tight">Docs</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Sidebar - GENUINELY FIXED POSITION */}
      <aside className={`fixed top-0 left-0 h-screen z-40 bg-white dark:bg-[#0B0F19] border-r border-slate-200 dark:border-white/5 w-80 transform transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}`}>
        <div className="h-full flex flex-col overflow-y-auto custom-scrollbar p-6">
          <div className="mb-8 px-2 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img src="/chttrix-logo.jpg" alt="Logo" className="w-10 h-10 rounded-xl shadow-md group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div>
                <h1 className="font-extrabold text-xl leading-none tracking-tight text-slate-900 dark:text-white">Chttrix</h1>
                <p className="text-xs text-slate-500 font-medium mt-1">Collaboration OS</p>
              </div>
            </Link>
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-amber-400 transition-colors">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          <div className="space-y-10 flex-1">
            <SectionGroup title="Start Here">
              <NavItem id="intro" label="Introduction" icon={BookOpen} />
              <NavItem id="getting-started" label="Installation & Setup" icon={Zap} />
            </SectionGroup>

            <SectionGroup title="Core Platform">
              <NavItem id="workspaces" label="Workspaces & Teams" icon={Building2} />
              <NavItem id="channels" label="Channels & Organization" icon={Hash} />
              <NavItem id="messaging" label="Messaging & Threads" icon={MessageSquare} />
            </SectionGroup>

            <SectionGroup title="Productivity Suite">
              <NavItem id="tasks" label="Tasks & Workflows" icon={CheckSquare} />
              <NavItem id="notes" label="Notes & Docs" icon={FileText} />
              <NavItem id="ai" label="Chttrix Intelligence" icon={Sparkles} />
              <NavItem id="search" label="Universal Search" icon={Search} />
              <NavItem id="updates" label="Company Updates" icon={BellRing} />
            </SectionGroup>

            <SectionGroup title="Admin & Security">
              <NavItem id="security" label="Security & E2EE" icon={Shield} />
              <NavItem id="roles" label="Roles & Governance" icon={UserCheck} />
              <NavItem id="settings" label="Settings" icon={Settings} />
            </SectionGroup>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5">
            <div className="flex justify-center items-center px-2">
              <p className="text-xs font-medium text-slate-400">© 2026 Chttrix</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area - OFFSET FOR FIXED SIDEBAR */}
      <main className="flex-1 min-w-0 md:pl-80 relative">
        {/* Top Right Back Button - Sticky or Fixed? Fixed is better for persistent access */}
        <div className="fixed top-6 right-8 z-30 hidden md:block">
          <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-black/50 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-full text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 hover:border-indigo-200 dark:hover:border-white/20 transition-all shadow-sm">
            <ArrowRight size={16} className="rotate-180" /> Back to Home
          </Link>
        </div>

        <div className="max-w-5xl mx-auto px-8 md:px-12 py-20 pb-40">

          {/* Hero Section */}
          <section id="intro" className="mb-32 pt-10 scroll-mt-32 relative">
            {/* Decorative background blur */}
            <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute top-40 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 backdrop-blur-sm text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider mb-8">
                <FileText size={14} className="text-indigo-500" /> Official Documentation
              </div>
              <h1 className="text-6xl md:text-7xl font-black mb-8 leading-tight tracking-tight text-slate-900 dark:text-white">
                The Chttrix <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 animate-gradient-x">
                  Collaboration OS
                </span>
              </h1>
              <p className="text-2xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl font-medium">
                The complete guide to the secure, AI-powered platform that unifies messaging, project management, and knowledge sharing.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-16">
              <HeroCard icon={Lock} title="End-to-End Encrypted" desc="Zero-knowledge architecture means we can't read your data." />
              <HeroCard icon={Sparkles} title="AI Native" desc="Gemini integration with strict privacy controls built-in." />
              <HeroCard icon={Layers} title="Unified Workflow" desc="Chat, Tasks, and Docs in a single fluid interface." />
            </div>
          </section>

          {/* Getting Started */}
          <section id="getting-started" className="mb-32 scroll-mt-24">
            <SectionHeader title="Getting Started" subtitle="Set up your environment in minutes." />

            <div className="grid md:grid-cols-2 gap-8">
              <BentoCard icon={Video} title="Installation" className="bg-gradient-to-br from-indigo-50 to-white dark:from-[#0F1623] dark:to-[#111827]">
                <ul className="space-y-4 mt-4">
                  <InstallOption platform="Web Browser" desc="Access via chttrix.app — no install needed." />
                  <InstallOption platform="Desktop (Mac/Win/Linux)" desc="Native notifications and offline support." />
                  <InstallOption platform="Mobile (iOS/Android)" desc="Stay connected on the go." />
                </ul>
              </BentoCard>

              <div className="space-y-6">
                <StepCard num="01" title="Create Account" desc="Sign up with your work email. We'll automatically verify your domain." />
                <StepCard num="02" title="Setup MFA" desc="Enable Multi-Factor Authentication for enhanced account security." />
                <StepCard num="03" title="Join Workspace" desc="Accept an invite or request to join your team's workspace." />
              </div>
            </div>
          </section>

          {/* Workspaces */}
          <section id="workspaces" className="mb-32 scroll-mt-24">
            <SectionHeader title="Workspaces & Teams" subtitle="How Chttrix organizes your company." />

            <div className="p-8 bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-white/5 shadow-xl relative overflow-hidden mb-8">
              <div className="relative z-10 grid md:grid-cols-3 gap-8 text-center">
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl">
                  <Building2 size={32} className="mx-auto text-indigo-500 mb-4" />
                  <h3 className="font-bold text-lg mb-2">1. The Company</h3>
                  <p className="text-sm text-slate-500">The top-level container for all users, billing, and policies.</p>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight size={32} className="text-slate-300 dark:text-slate-600 rotate-90 md:rotate-0" />
                </div>
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl">
                  <Layers size={32} className="mx-auto text-purple-500 mb-4" />
                  <h3 className="font-bold text-lg mb-2">2. Workspaces</h3>
                  <p className="text-sm text-slate-500">Project or team-specific environments (e.g., "Designing", "Dev Ops").</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <BentoCard title="Personal Workspace" icon={Users}>
                <p className="text-slate-600 dark:text-slate-400 mt-2">
                  Every user gets a private sandbox. Use it for personal tasks, notes, and drafting content before sharing.
                </p>
              </BentoCard>
              <BentoCard title="Creation Policy" icon={AlertTriangle} accent="amber">
                <p className="text-slate-600 dark:text-slate-400 mt-2">
                  To prevent fragmentation, <strong>Employees cannot create workspaces</strong> freely. They must request approval from a Manager.
                </p>
              </BentoCard>
            </div>
          </section>

          {/* Channels */}
          <section id="channels" className="mb-32 scroll-mt-24">
            <SectionHeader title="Channels" subtitle="The heartbeat of your communication." />

            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2 p-8 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl text-white shadow-2xl">
                <Hash size={48} className="mb-6 opacity-80" />
                <h3 className="text-2xl font-bold mb-4">Core Principles</h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-bold mb-2 opacity-90">#general & #announcements</h4>
                    <p className="text-sm opacity-75">Mandatory default channels in every workspace. Members cannot leave these.</p>
                  </div>
                  <div>
                    <h4 className="font-bold mb-2 opacity-90">Smart Tabs</h4>
                    <p className="text-sm opacity-75">Every channel can have custom tabs (Files, Canvas, Links) to organize resources.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <FeatureRow icon={Globe} title="Public Channels" desc="Open to all workspace members." />
                <FeatureRow icon={Lock} title="Private Channels" desc="Invite-only. Hidden from search." />
                <FeatureRow icon={Search} title="Recall" desc="Search history instantly." />
              </div>
            </div>
          </section>

          {/* Messaging & Threads */}
          <section id="messaging" className="mb-32 scroll-mt-24">
            <SectionHeader title="Messaging & Threads" subtitle="Structured conversations that flow." />

            <div className="grid md:grid-cols-2 gap-8">
              <BentoCard title="Contextual Threads" icon={GitBranch}>
                <div className="my-4 p-4 bg-slate-100 dark:bg-black/20 rounded-xl border-l-4 border-indigo-500">
                  <div className="flex gap-2 items-center mb-2">
                    <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700" />
                    <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                  <div className="mt-3 pl-4 border-l border-slate-300 dark:border-slate-600">
                    <span className="text-xs font-bold text-indigo-500">Reply in thread...</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Don't clutter the main feed. Click bubble icon on any message to start a side-discussion.
                </p>
              </BentoCard>

              <BentoCard title="Secure DMs" icon={MessageSquare}>
                <div className="my-4 grid gap-2">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                    <Lock size={16} className="text-emerald-500" />
                    <span className="text-sm font-medium">End-to-End Encrypted</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                    <Users size={16} className="text-blue-500" />
                    <span className="text-sm font-medium">Group DMs (up to 9)</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                    <Search size={16} className="text-purple-500" />
                    <span className="text-sm font-medium">Full History Search</span>
                  </div>
                </div>
              </BentoCard>
            </div>
          </section>

          {/* Tasks */}
          <section id="tasks" className="mb-32 scroll-mt-24">
            <SectionHeader title="Tasks & Workflows" subtitle="Built-in project management." />

            <div className="bg-[#1e1e2e] rounded-3xl p-8 border border-white/10 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-20"><CheckSquare size={120} /></div>

              <div className="relative z-10 grid md:grid-cols-2 gap-12">
                <div>
                  <h3 className="text-2xl font-bold mb-6">Native Kanban Power</h3>
                  <ul className="space-y-4">
                    <li className="flex gap-3">
                      <div className="mt-1 w-5 h-5 rounded-full border-2 border-indigo-500 bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold">1</div>
                      <span><strong>Assign & Track:</strong> Assign tasks to teammates with due dates and priority labels.</span>
                    </li>
                    <li className="flex gap-3">
                      <div className="mt-1 w-5 h-5 rounded-full border-2 border-indigo-500 bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold">2</div>
                      <span><strong>Workflows:</strong> Request task transfers or approvals directly in the chat.</span>
                    </li>
                    <li className="flex gap-3">
                      <div className="mt-1 w-5 h-5 rounded-full border-2 border-indigo-500 bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold">3</div>
                      <span><strong>Subtasks:</strong> Break down complex work into manageable steps.</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/10">
                  <div className="flex justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">To Do</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">In Progress</span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 bg-white/10 rounded-lg text-sm border-l-4 border-red-500">Q4 Reports</div>
                    <div className="p-3 bg-white/10 rounded-lg text-sm border-l-4 border-yellow-500">Update API Docs</div>
                    <div className="ml-auto w-1/2 p-3 bg-indigo-600 rounded-lg text-sm shadow-lg">Deploy v2.1</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Notes */}
          <section id="notes" className="mb-32 scroll-mt-24">
            <SectionHeader title="Notes & Docs" subtitle="Multi-player document collaboration." />
            <div className="grid md:grid-cols-3 gap-6">
              <BentoCard icon={Zap} title="Real-Time" desc="See others' cursors as they type. Zero latency." />
              <BentoCard icon={Command} title="Markdown" desc="Use slash commands and markdown shortcuts for speed." />
              <BentoCard icon={Layers} title="Embedded" desc="Attach notes directly to channels or tasks." />
            </div>
          </section>

          {/* AI */}
          <section id="ai" className="mb-32 scroll-mt-24">
            <SectionHeader title="Chttrix Intelligence" subtitle="Powered by Gemini. Protected by Privacy." />

            <div className="grid gap-6">
              <div className="p-8 rounded-3xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 border border-purple-200 dark:border-purple-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-600 text-white rounded-lg"><Sparkles size={24} /></div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Privacy-First Design</h3>
                </div>
                <p className="text-lg text-slate-700 dark:text-slate-300 mb-6">
                  Chttrix AI provides powerful assistance without compromising your data security.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#0B0F19] rounded-xl border border-purple-100 dark:border-white/5">
                    <Check size={20} className="text-green-500" />
                    <span className="font-medium text-sm">Explicit Opt-In Only (@ChttrixAI)</span>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#0B0F19] rounded-xl border border-purple-100 dark:border-white/5">
                    <Check size={20} className="text-green-500" />
                    <span className="font-medium text-sm">No Background Training</span>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <AICapabilityCard title="Summarize" desc="Catch up on long threads instantly." />
                <AICapabilityCard title="Generate Tasks" desc="Turn chat discussions into actionable items." />
                <AICapabilityCard title="Answer Queries" desc="Ask questions about your workspace data." />
              </div>
            </div>
          </section>

          {/* Updates */}
          <section id="updates" className="mb-32 scroll-mt-24">
            <SectionHeader title="Company Updates" subtitle="A private social feed for your organization." />
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
              Share wins, weekly goals, or major announcements in a feed visible to everyone. Breaks down silos between departments.
            </p>
          </section>

          {/* Search */}
          <section id="search" className="mb-32 scroll-mt-24">
            <div className="p-8 bg-slate-900 text-white rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                <h3 className="text-2xl font-bold mb-2">Universal Search</h3>
                <p className="text-slate-400 mb-6">Find anything. Files, messages, people, or tasks.</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg border border-white/10 font-mono text-sm">
                  <Command size={14} /> K
                </div>
              </div>
              <div className="w-full md:w-1/2 p-4 bg-black/30 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-3 text-slate-400 border-b border-white/10 pb-3 mb-3">
                  <Search size={18} /> <span className="text-sm">Search for "Q3 Design"...</span>
                </div>
                <div className="space-y-2">
                  <div className="h-8 bg-white/5 rounded w-3/4"></div>
                  <div className="h-8 bg-white/5 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          </section>

          {/* Security */}
          <section id="security" className="mb-32 scroll-mt-24">
            <SectionHeader title="Security & Compliance" subtitle="Your data, your keys." />

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <BentoCard title="Zero Knowledge" icon={Key}>
                <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
                  We use client-side key management. We literally <strong>cannot</strong> read your encrypted messages, even if subpoenaed.
                </p>
              </BentoCard>
              <BentoCard title="Enterprise Controls" icon={Shield}>
                <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
                  Admins get full audit logs, device management, and domain verification tools.
                </p>
              </BentoCard>
            </div>
            <Link to="/security" className="inline-flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400 hover:gap-3 transition-all">
              Visit Security Center <ArrowRight size={16} />
            </Link>
          </section>

          {/* Settings */}
          <section id="settings" className="mb-32 scroll-mt-24">
            <SectionHeader title="Settings" subtitle="Customize your experience." />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SettingCard icon={UserCheck} label="Profile" />
              <SettingCard icon={BellRing} label="Notifications" />
              <SettingCard icon={Lock} label="Privacy" />
              <SettingCard icon={Globe} label="Language" />
            </div>
          </section>

          <footer className="mt-20 border-t border-slate-200 dark:border-white/10 pt-12 text-center text-slate-500 text-sm">
            <p className="mb-4">© 2026 Chttrix Inc.</p>
            <div className="flex justify-center gap-6 font-medium">
              <Link to="/privacy" className="hover:text-indigo-500 transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-indigo-500 transition-colors">Terms</Link>
              <Link to="/security" className="hover:text-indigo-500 transition-colors">Security</Link>
            </div>
          </footer>

        </div>
      </main>
    </div>
  );
};

// --- Premium Components ---

const SectionGroup = ({ title, children }) => (
  <div className="mb-2">
    <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</p>
    <div className="space-y-0.5">{children}</div>
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-8">
    <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">{title}</h2>
    <p className="text-xl text-slate-500 dark:text-slate-400">{subtitle}</p>
  </div>
);

const HeroCard = ({ icon: Icon, title, desc }) => (
  <div className="p-6 rounded-2xl bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-white/5 shadow-xl hover:-translate-y-1 transition-transform duration-300">
    <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-white/5 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
      <Icon size={24} />
    </div>
    <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">{title}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
  </div>
);

const BentoCard = ({ icon: Icon, title, children, className, accent }) => (
  <div className={`p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-300 group bg-white dark:bg-[#0B0F19] ${className}`}>
    <div className="flex items-center gap-3 mb-4">
      {Icon && (
        <div className={`p-2 rounded-lg ${accent === 'amber' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-indigo-50 dark:bg-white/5 text-indigo-600 dark:text-indigo-400'}`}>
          <Icon size={20} />
        </div>
      )}
      <h3 className="font-bold text-lg text-slate-900 dark:text-white">{title}</h3>
    </div>
    <div>{children}</div>
  </div>
);

const InstallOption = ({ platform, desc }) => (
  <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-default">
    <div className="mt-1 w-2 h-2 rounded-full bg-green-500 shrink-0" />
    <div>
      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{platform}</h4>
      <p className="text-xs text-slate-500">{desc}</p>
    </div>
  </div>
);

const StepCard = ({ num, title, desc }) => (
  <div className="flex gap-4">
    <div className="font-black text-3xl text-slate-200 dark:text-slate-800">{num}</div>
    <div>
      <h4 className="font-bold text-lg text-slate-900 dark:text-white">{title}</h4>
      <p className="text-sm text-slate-600 dark:text-slate-400">{desc}</p>
    </div>
  </div>
);

const FeatureRow = ({ icon: Icon, title, desc }) => (
  <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
    <Icon size={20} className="text-slate-400" />
    <div>
      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{title}</h4>
      <p className="text-xs text-slate-500">{desc}</p>
    </div>
  </div>
);

const AICapabilityCard = ({ title, desc }) => (
  <div className="p-4 bg-white dark:bg-[#0B0F19] rounded-xl border border-slate-200 dark:border-white/5 text-center hover:border-purple-300 dark:hover:border-purple-500/50 transition-colors">
    <Sparkles size={20} className="mx-auto text-purple-500 mb-2" />
    <h4 className="font-bold text-sm mb-1">{title}</h4>
    <p className="text-xs text-slate-500">{desc}</p>
  </div>
);

const SettingCard = ({ icon: Icon, label }) => (
  <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center gap-3 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white">
    <Icon size={24} />
    <span className="font-bold text-sm">{label}</span>
  </div>
);

export default ChttrixDocs;

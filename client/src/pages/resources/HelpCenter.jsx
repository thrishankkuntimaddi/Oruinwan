import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ChevronDown, ChevronUp, X } from 'lucide-react';

const HelpCenter = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedArticles, setExpandedArticles] = useState({});

    // Comprehensive help articles organized by category
    const helpCategories = useMemo(() => [
        {
            id: 'getting-started',
            title: 'Getting Started with Chttrix',
            icon: '🚀',
            color: 'blue',
            articles: [
                {
                    id: 'what-is-chttrix',
                    question: 'What is Chttrix?',
                    answer: `Chttrix is a secure collaboration platform that brings messaging, channels, direct messages, threads, tasks, notes, and AI together — all protected with end-to-end encryption.

Chttrix is designed so that:
• Your conversations stay private
• Teams stay organized
• Work happens in real time`
                },
                {
                    id: 'creating-account',
                    question: 'Creating Your Account',
                    answer: `1. Visit the Chttrix website or open the app
2. Click Get Started
3. Sign up using your email address
4. Verify your email
5. Create your first workspace

Once your workspace is created, you can invite teammates and start communicating immediately.`
                },
                {
                    id: 'joining-workspace',
                    question: 'Joining a Workspace',
                    answer: `You can join a workspace by:
• Accepting an email invitation
• Using an invite link shared by a workspace member

After joining, you'll see the workspace channels and can start messaging right away.`
                }
            ]
        },
        {
            id: 'messaging',
            title: 'Messaging & Channels',
            icon: '💬',
            color: 'indigo',
            articles: [
                {
                    id: 'what-are-channels',
                    question: 'What Are Channels?',
                    answer: `Channels are shared spaces where teams communicate around specific topics, projects, or teams. They help keep conversations organized and searchable.`
                },
                {
                    id: 'channel-types',
                    question: 'Types of Channels',
                    answer: `Public Channels:
• Visible to all workspace members
• Best for announcements and open discussions

Private Channels:
• Invite-only
• Used for confidential or focused discussions

All channels are end-to-end encrypted.`
                },
                {
                    id: 'sending-messages',
                    question: 'Sending Messages',
                    answer: `To send a message:
1. Open a channel or direct message
2. Type your message in the input box
3. Press Enter to send

Messages are delivered securely and instantly.`
                },
                {
                    id: 'editing-deleting',
                    question: 'Editing or Deleting Messages',
                    answer: `1. Hover over your message
2. Select Edit or Delete
3. Edited messages are marked accordingly
4. Deleted messages are removed permanently where supported.`
                }
            ]
        },
        {
            id: 'threads',
            title: 'Threads',
            icon: '🧵',
            color: 'purple',
            articles: [
                {
                    id: 'what-are-threads',
                    question: 'What Are Threads?',
                    answer: `Threads allow you to reply to a specific message without interrupting the main conversation. This keeps channels clean and easy to follow.`
                },
                {
                    id: 'starting-thread',
                    question: 'Starting a Thread',
                    answer: `1. Hover over a message
2. Click "Reply in Thread"
3. Continue the discussion in the thread panel

Only participants in the thread receive thread notifications.`
                }
            ]
        },
        {
            id: 'direct-messages',
            title: 'Direct Messages (DMs)',
            icon: '✉️',
            color: 'green',
            articles: [
                {
                    id: 'what-are-dms',
                    question: 'What Are Direct Messages?',
                    answer: `Direct Messages are private conversations between two or more users. DMs are fully end-to-end encrypted and visible only to participants.`
                },
                {
                    id: 'starting-dm',
                    question: 'Starting a Direct Message',
                    answer: `1. Click "New Message"
2. Select one or more users
3. Start chatting

You can also create small group DMs for focused collaboration.`
                }
            ]
        },
        {
            id: 'huddles',
            title: 'Voice & Video (Huddles)',
            icon: '🎥',
            color: 'yellow',
            articles: [
                {
                    id: 'what-are-huddles',
                    question: 'What Are Huddles?',
                    answer: `Huddles are quick voice or video calls that let you collaborate instantly — no scheduling required.`
                },
                {
                    id: 'starting-huddle',
                    question: 'Starting a Huddle',
                    answer: `1. Open a channel or DM
2. Click the Huddle icon
3. Others can join instantly

Features include:
• Voice & video
• Screen sharing
• Live reactions`
                },
                {
                    id: 'audio-video-issues',
                    question: 'Audio & Video Issues',
                    answer: `If your microphone or camera isn't working:
• Check browser or app permissions
• Verify correct input/output devices
• Restart the app`
                }
            ]
        },
        {
            id: 'tasks-notes',
            title: 'Tasks & Notes',
            icon: '✅',
            color: 'orange',
            articles: [
                {
                    id: 'using-tasks',
                    question: 'Using Tasks',
                    answer: `Tasks help you track work directly inside Chttrix.

You can:
• Create tasks
• Assign owners
• Set due dates
• Track progress on Kanban boards`
                },
                {
                    id: 'using-notes',
                    question: 'Using Notes',
                    answer: `Notes are collaborative documents stored alongside your conversations.

They are ideal for:
• Meeting notes
• Specifications
• Team documentation

Notes support formatting and auto-save.`
                }
            ]
        },
        {
            id: 'chttrix-ai',
            title: 'Chttrix AI',
            icon: '🤖',
            color: 'pink',
            articles: [
                {
                    id: 'ai-capabilities',
                    question: 'What Can Chttrix AI Do?',
                    answer: `Chttrix AI helps with:
• Summarizing conversations
• Creating tasks from messages
• Answering questions based on provided context`
                },
                {
                    id: 'ai-privacy',
                    question: 'AI & Privacy',
                    answer: `Chttrix AI:
• Cannot read encrypted messages by default
• Only processes content you explicitly provide
• Never trains on private conversations

You stay in control of what AI can access.`
                }
            ]
        },
        {
            id: 'security',
            title: 'Security & Privacy',
            icon: '🔒',
            color: 'red',
            articles: [
                {
                    id: 'data-protection',
                    question: 'How Is My Data Protected?',
                    answer: `Chttrix uses end-to-end encryption so that only message participants can read conversations.

Chttrix servers never store encryption keys or plaintext messages.`
                },
                {
                    id: 'compromised-account',
                    question: 'Lost Device or Compromised Account',
                    answer: `If you believe your account is compromised:
1. Change your password immediately
2. Log out of all active sessions
3. Enable multi-factor authentication
4. Contact support if needed`
                }
            ]
        },
        {
            id: 'notifications',
            title: 'Notifications',
            icon: '🔔',
            color: 'teal',
            articles: [
                {
                    id: 'managing-notifications',
                    question: 'Managing Notifications',
                    answer: `You can control notifications at:
• Workspace level
• Channel level
• Device level

Options include:
• All messages
• Mentions only
• Do Not Disturb schedules`
                }
            ]
        },
        {
            id: 'troubleshooting',
            title: 'Troubleshooting',
            icon: '🔧',
            color: 'slate',
            articles: [
                {
                    id: 'messages-not-loading',
                    question: 'Messages Not Loading or Syncing',
                    answer: `If messages are not appearing, loading slowly, or seem out of sync:
• Check your internet connection
• Refresh the page or restart the app
• Make sure you are logged into the correct workspace
• Log out and log back in
• Check if Chttrix services are temporarily unavailable

Because Chttrix uses end-to-end encryption, message delivery depends on active and stable connections. Messages are not lost due to encryption.`
                },
                {
                    id: 'notifications-not-working',
                    question: 'Notifications Not Working',
                    answer: `If you are not receiving notifications:
• Check workspace notification settings
• Check channel-specific notification overrides
• Ensure Do Not Disturb mode is disabled
• Verify browser or device notification permissions
• On mobile, allow background notifications for Chttrix`
                },
                {
                    id: 'login-issues',
                    question: 'Login Issues',
                    answer: `If you cannot log in:
• Double-check your email and password
• Ensure your email address is verified
• Use the "Forgot Password" option if needed
• Check for extra spaces or incorrect capitalization

If multi-factor authentication is enabled, make sure you have access to your authentication device.`
                },
                {
                    id: 'account-security',
                    question: 'Account Access or Security Issues',
                    answer: `If you believe your account has been compromised or you cannot access it:
• Change your password immediately
• Log out of all active sessions
• Enable or reset multi-factor authentication
• Contact Chttrix support if access cannot be restored

Chttrix cannot recover encrypted messages if account keys are lost.`
                },
                {
                    id: 'huddle-issues',
                    question: 'Audio or Video Not Working (Huddles)',
                    answer: `If your microphone, camera, or screen sharing does not work:
• Check browser or app permissions
• Select the correct audio and video devices
• Close other applications using the microphone or camera
• Restart the app or browser

Using the latest version of a supported browser is recommended.`
                },
                {
                    id: 'file-upload',
                    question: 'File Upload Problems',
                    answer: `If files fail to upload:
• Check the file size limit
• Ensure a stable internet connection
• Try uploading a different file
• Refresh the app and retry`
                },
                {
                    id: 'tasks-notes-updating',
                    question: 'Tasks or Notes Not Updating',
                    answer: `If tasks or notes are not updating correctly:
• Refresh the page
• Ensure you have edit permissions
• Check for connectivity issues
• Avoid editing the same note from multiple devices simultaneously`
                },
                {
                    id: 'ai-not-responding',
                    question: 'Chttrix AI Not Responding',
                    answer: `If Chttrix AI is not working as expected:
• Confirm AI is enabled in your workspace
• Ensure you explicitly provided content for AI processing
• Check usage limits or temporary availability issues

Chttrix AI does not automatically read encrypted conversations.`
                },
                {
                    id: 'still-need-help',
                    question: 'Still Need Help?',
                    answer: `If the issue persists:
• Visit the Community page to ask questions
• Contact Chttrix support through the Help Center
• Include screenshots or error messages when possible

We're here to help you get the best experience with Chttrix.`
                }
            ]
        }
    ], []);

    // Toggle article expansion
    const toggleArticle = (articleId) => {
        setExpandedArticles(prev => ({
            ...prev,
            [articleId]: !prev[articleId]
        }));
    };

    // Filter articles based on search query
    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return helpCategories;

        const query = searchQuery.toLowerCase();
        return helpCategories.map(category => ({
            ...category,
            articles: category.articles.filter(article =>
                article.question.toLowerCase().includes(query) ||
                article.answer.toLowerCase().includes(query)
            )
        })).filter(category => category.articles.length > 0);
    }, [searchQuery, helpCategories]);

    const colorClasses = {
        blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
        indigo: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
        purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
        green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20',
        yellow: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20',
        orange: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20',
        pink: 'bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-500/20',
        red: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
        teal: 'bg-teal-100 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/20',
        slate: 'bg-slate-100 dark:bg-slate-900/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/20'
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-white transition-colors duration-500">
            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
                        <img src="/chttrix-logo.jpg" alt="Logo" className="w-10 h-10 rounded-xl shadow-md" />
                        <span className="font-black text-2xl tracking-tighter">Chttrix</span>
                    </div>
                    <button onClick={() => navigate("/")} className="text-sm font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-white transition-colors flex items-center gap-2">
                        <ArrowLeft size={16} /> Back to Home
                    </button>
                </div>
            </nav>

            {/* Header with Search */}
            <header className="pt-40 pb-20 bg-gradient-to-b from-white to-slate-50 dark:from-[#0B0F19] dark:to-[#030712] text-center px-6 border-b border-slate-200 dark:border-white/5">
                <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                    How can we help?
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 mb-10">
                    Search our knowledge base or browse by category
                </p>
                <div className="max-w-2xl mx-auto relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
                    <input
                        type="text"
                        placeholder="Search for articles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-14 pr-12 py-5 rounded-2xl border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg transition-all shadow-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
                {searchQuery && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                        Found {filteredCategories.reduce((acc, cat) => acc + cat.articles.length, 0)} result{filteredCategories.reduce((acc, cat) => acc + cat.articles.length, 0) !== 1 ? 's' : ''}
                    </p>
                )}
            </header>

            {/* Help Articles */}
            <section className="py-16 container mx-auto px-6 max-w-5xl">
                {filteredCategories.length > 0 ? (
                    <div className="space-y-8">
                        {filteredCategories.map((category) => (
                            <div key={category.id} className="bg-white dark:bg-[#0B0F19] rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {/* Category Header */}
                                <div className={`px-8 py-6 border-b border-slate-200 dark:border-white/5 ${colorClasses[category.color]}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{category.icon}</span>
                                        <h2 className="text-2xl font-bold">{category.title}</h2>
                                        <span className="ml-auto text-sm font-bold px-3 py-1 rounded-full bg-white/50 dark:bg-black/20">
                                            {category.articles.length} {category.articles.length === 1 ? 'article' : 'articles'}
                                        </span>
                                    </div>
                                </div>

                                {/* Articles */}
                                <div className="divide-y divide-slate-200 dark:divide-white/5">
                                    {category.articles.map((article) => (
                                        <div key={article.id}>
                                            <button
                                                onClick={() => toggleArticle(article.id)}
                                                className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                                            >
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {article.question}
                                                </h3>
                                                {expandedArticles[article.id] ? (
                                                    <ChevronUp className="text-slate-400 group-hover:text-indigo-500 transition-colors flex-shrink-0" size={20} />
                                                ) : (
                                                    <ChevronDown className="text-slate-400 group-hover:text-indigo-500 transition-colors flex-shrink-0" size={20} />
                                                )}
                                            </button>
                                            {expandedArticles[article.id] && (
                                                <div className="px-8 pb-6 text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                                    {article.answer}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-6">🔍</div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">No results found</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">
                            We couldn't find any articles matching "{searchQuery}"
                        </p>
                        <button
                            onClick={() => setSearchQuery('')}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors"
                        >
                            Clear Search
                        </button>
                    </div>
                )}
            </section>

            {/* Footer CTA */}
            <section className="py-16 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl font-black mb-4">Still need help?</h2>
                    <p className="text-lg mb-8 opacity-90">
                        Our support team is here to assist you
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => navigate('/community')}
                            className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-lg"
                        >
                            Visit Community
                        </button>
                        <button
                            onClick={() => navigate('/contact')}
                            className="px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-all"
                        >
                            Contact Support
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-200 dark:border-white/5 text-center text-slate-500 dark:text-slate-400">
                <p>© 2026 Chttrix Inc. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default HelpCenter;

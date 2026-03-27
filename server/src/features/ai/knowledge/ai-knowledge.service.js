// server/src/features/ai/knowledge/ai-knowledge.service.js
'use strict';

const aiCore        = require('../ai-core.service');
const Message       = require('../../messages/message.model');
const KnowledgePage = require('../../knowledge/KnowledgePage');
const ScheduledMeeting = require('../../../models/ScheduledMeeting');

// ─── Semantic Search ──────────────────────────────────────────────────────────

/**
 * Combined keyword + semantic search across messages and knowledge pages.
 * Step 1: MongoDB text-style regex search (first pass)
 * Step 2: AI semantic re-ranking (second pass)
 *
 * @param {string} query
 * @param {string} workspaceId
 * @returns {Promise<{ results: Array, cached: boolean }>}
 */
async function search(query, workspaceId) {
    if (!query || !workspaceId) return { results: [], cached: false };

    const regex = new RegExp(query.split(/\s+/).join('|'), 'i');

    // --- First pass: keyword candidates ---
    const [messages, pages] = await Promise.all([
        Message.find({
            workspace:            workspaceId,
            isDeleted:            { $ne: true },
            isDeletedUniversally: { $ne: true },
            type:                 { $in: ['message', 'checklist'] },
            text:                 { $regex: regex },
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .select('text createdAt channel sender')
            .populate('sender', 'username')
            .lean(),

        KnowledgePage.find({
            workspaceId,
            $or: [
                { title:   { $regex: regex } },
                { content: { $regex: regex } },
            ],
        })
            .limit(15)
            .select('title content updatedAt')
            .lean(),
    ]);

    // --- Build candidate docs ---
    const docs = [
        ...messages.map(m => ({
            id:      m._id.toString(),
            title:   `Message by ${m.sender?.username || 'User'}`,
            snippet: m.text.substring(0, 300),
            type:    'message',
            source:  m,
        })),
        ...pages.map(p => ({
            id:      p._id.toString(),
            title:   p.title || 'Knowledge Page',
            snippet: (p.content || '').replace(/#|\*|`|>/g, '').substring(0, 300),
            type:    'knowledge',
            source:  p,
        })),
    ];

    if (!docs.length) return { results: [], cached: false };

    // --- Second pass: semantic re-ranking ---
    const { results, cached } = await aiCore.semanticSearch(query, docs, { topK: 10 });

    return {
        results: results.map(r => ({
            id:      r.id,
            title:   r.title,
            snippet: r.snippet,
            type:    r.type,
            score:   r.score,
        })),
        cached,
    };
}

// ─── AI Q&A ───────────────────────────────────────────────────────────────────

/**
 * Answer a workspace question using knowledge pages + recent meeting summaries as context.
 * @param {string} question
 * @param {string} workspaceId
 * @returns {Promise<{ answer: string, references: Array, fallback: boolean }>}
 */
async function askQuestion(question, workspaceId) {
    if (!question) return { answer: 'Please provide a question.', references: [], fallback: true };

    // Fetch top 5 knowledge pages (relevance: regex match or most recent)
    const regex = new RegExp(question.split(/\s+/).slice(0, 5).join('|'), 'i');
    const [pages, meetings] = await Promise.all([
        KnowledgePage.find({
            workspaceId,
            $or: [
                { title:   { $regex: regex } },
                { content: { $regex: regex } },
                { title: { $exists: true } }, // fallback: any page
            ],
        }).limit(5).select('title content updatedAt').lean(),

        ScheduledMeeting.find({
            workspaceId,
            status: 'completed',
            summary: { $exists: true, $ne: '' },
        }).sort({ startTime: -1 }).limit(3).select('title summary startTime').lean(),
    ]);

    const contextDocs = [
        ...pages.map(p => ({
            title:   p.title || 'Knowledge Page',
            content: (p.content || '').substring(0, 2_000),
        })),
        ...meetings.map(m => ({
            title:   `Meeting: ${m.title}`,
            content: m.summary || '',
        })),
    ];

    const { answer, fallback } = await aiCore.answerQuestion(question, contextDocs);

    const references = [
        ...pages.slice(0, 3).map(p => ({ type: 'knowledge', title: p.title, id: p._id })),
        ...meetings.slice(0, 2).map(m => ({ type: 'meeting', title: m.title, id: m._id })),
    ];

    return { answer, references, fallback };
}

// ─── Meeting Query ────────────────────────────────────────────────────────────

/**
 * Query past meetings using natural language.
 * @param {string} question
 * @param {string} workspaceId
 * @returns {Promise<{ meetings: Array, answer: string, fallback: boolean }>}
 */
async function queryMeetings(question, workspaceId) {
    const regex = new RegExp(question.split(/\s+/).slice(0, 5).join('|'), 'i');

    const meetings = await ScheduledMeeting.find({
        workspaceId,
        $or: [
            { title:    { $regex: regex } },
            { summary:  { $regex: regex } },
            { transcript: { $regex: regex } },
        ],
    })
        .sort({ startTime: -1 })
        .limit(10)
        .populate('createdBy', 'username firstName lastName')
        .lean();

    const allMeetings = meetings.length
        ? meetings
        : await ScheduledMeeting.find({ workspaceId, status: 'completed' })
            .sort({ startTime: -1 })
            .limit(5)
            .populate('createdBy', 'username firstName lastName')
            .lean();

    const contextDocs = allMeetings.map(m => ({
        title:   m.title,
        content: [m.summary, m.transcript, m.sharedNotes].filter(Boolean).join('\n').substring(0, 2_000),
    }));

    const { answer, fallback } = await aiCore.answerQuestion(question, contextDocs);

    return {
        meetings: allMeetings.map(m => ({
            _id:       m._id,
            title:     m.title,
            startTime: m.startTime,
            status:    m.status,
            summary:   m.summary || null,
            createdBy: m.createdBy,
        })),
        answer,
        fallback,
    };
}

module.exports = { search, askQuestion, queryMeetings };

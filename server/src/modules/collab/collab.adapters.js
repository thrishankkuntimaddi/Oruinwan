'use strict';

/**
 * Per document type: who may open it, where its plain content lives, and how a
 * saved Y.Doc is written back to the owning record.
 *
 *   authorize(docId, userId) -> { workspaceId, canWrite }   (throws HttpError 400/403/404)
 *   loadContent(docId)       -> value handed to schema.seed when no Yjs state exists yet
 *   persist(docId, value, { userId }) -> writes the plain content to the owning record
 *
 * Access rules are the same as the REST APIs:
 *   note        view: owner / sharedWith / isPublic (active workspace members); edit: owner, or sharedWith when allowEditing;
 *               a meeting's note (Note.meeting): also anyone who may open that meeting, read and edit
 *   knowledge   any active member of the page's workspace reads and edits
 *   whiteboard  any active member of the meeting's workspace reads and draws (docId = meetingId)
 */

const { HttpError, isValidId } = require('../../shared/utils/workspaceAccess');

const KNOWLEDGE_VERSION_EVERY_MS = 10 * 60 * 1000;

/** True when the user passes the meeting's access check (meetingAccess.loadMeetingForUser). */
async function canOpenMeeting(meetingId, userId) {
    try {
        await require('../../features/meetings/meetingAccess').loadMeetingForUser(meetingId, userId);
        return true;
    } catch {
        return false;
    }
}

const note = {
    async authorize(docId, userId) {
        if (!isValidId(docId)) throw new HttpError(400, 'Invalid note id');
        const Note = require('../../../models/Note');
        const policy = require('../../features/notes/notes.policy');
        const doc = await Note.findById(docId).select('owner workspace isPublic sharedWith allowEditing meeting').lean();
        if (!doc) throw new HttpError(404, 'Note not found');
        try {
            await policy.assertNoteAccess(doc, userId, 'view');
        } catch (err) {
            // A meeting's notes: anyone who may open the meeting reads and edits them.
            if (doc.meeting && err instanceof HttpError && err.status === 403 && (await canOpenMeeting(String(doc.meeting), userId))) {
                return { workspaceId: String(doc.workspace), canWrite: true };
            }
            throw err;
        }
        const canWrite = policy.canEdit(doc, userId, true) || (!!doc.meeting && (await canOpenMeeting(String(doc.meeting), userId)));
        return { workspaceId: String(doc.workspace), canWrite };
    },
    async loadContent(docId) {
        const Note = require('../../../models/Note');
        const doc = await Note.findById(docId).select('content').lean();
        return doc ? doc.content || '' : '';
    },
    async persist(docId, value) {
        const Note = require('../../../models/Note');
        const { sanitizeNoteContent } = require('../../features/notes/notes.sanitize');
        await Note.updateOne({ _id: docId }, { $set: { content: sanitizeNoteContent(value || '') } });
    },
};

const knowledge = {
    async authorize(docId, userId) {
        if (!isValidId(docId)) throw new HttpError(400, 'Invalid page id');
        const KnowledgePage = require('../../features/knowledge/KnowledgePage');
        const { getWorkspaceMembership } = require('../../shared/utils/workspaceAccess');
        const page = await KnowledgePage.findById(docId).select('workspaceId isDeleted').lean();
        if (!page || page.isDeleted) throw new HttpError(404, 'Page not found');
        const access = await getWorkspaceMembership(String(page.workspaceId), userId);
        // Same as REST: pages outside the caller's workspaces answer "not found".
        if (!access || !access.member) throw new HttpError(404, 'Page not found');
        return { workspaceId: String(page.workspaceId), canWrite: true };
    },
    async loadContent(docId) {
        const KnowledgePage = require('../../features/knowledge/KnowledgePage');
        const page = await KnowledgePage.findById(docId).select('content').lean();
        return page ? page.content || '' : '';
    },
    /** Writes content; snapshots the previous content as a version at most every 10 minutes. */
    async persist(docId, value, { userId, now = Date.now() } = {}) {
        const KnowledgePage = require('../../features/knowledge/KnowledgePage');
        const page = await KnowledgePage.findById(docId);
        if (!page || page.isDeleted) return;
        const next = typeof value === 'string' ? value : '';
        if (page.content === next) return;
        const last = page.versions && page.versions[0];
        if (!last || now - new Date(last.savedAt).getTime() >= KNOWLEDGE_VERSION_EVERY_MS) {
            page.versions = [{ content: page.content, savedBy: userId || page.createdBy, savedAt: new Date(now) }, ...(page.versions || [])].slice(0, 50);
        }
        page.content = next;
        await page.save();
    },
};

// A whiteboard page: docId is the meeting (page 1) or a WhiteboardPage (pages 2+).
const boardPage = (docId) => require('../../features/collaboration/whiteboardPage.model').findById(docId).select('meetingId').lean();

const whiteboard = {
    async authorize(docId, userId) {
        const { loadMeetingForUser } = require('../../features/meetings/meetingAccess');
        const page = isValidId(docId) ? await boardPage(docId) : null;
        const { meeting } = await loadMeetingForUser(page ? String(page.meetingId) : docId, userId);
        return { workspaceId: String(meeting.workspaceId), canWrite: true };
    },
    async loadContent(docId) {
        const WhiteboardPage = require('../../features/collaboration/whiteboardPage.model');
        const page = await WhiteboardPage.findById(docId).select('strokes').lean();
        if (page) return page.strokes || [];
        const Whiteboard = require('../../features/collaboration/whiteboard.model');
        const wb = await Whiteboard.findOne({ meetingId: docId }).select('strokes').lean();
        return wb ? wb.strokes || [] : [];
    },
    async persist(docId, value, { workspaceId } = {}) {
        const strokes = Array.isArray(value) ? value : [];
        const WhiteboardPage = require('../../features/collaboration/whiteboardPage.model');
        const page = await WhiteboardPage.findByIdAndUpdate(docId, { $set: { strokes } });
        if (page) return;
        const Whiteboard = require('../../features/collaboration/whiteboard.model');
        await Whiteboard.findOneAndUpdate(
            { meetingId: docId },
            { $set: { strokes }, $setOnInsert: { meetingId: docId, workspaceId } },
            { upsert: true }
        );
    },
};

const ADAPTERS = { note, knowledge, whiteboard };

module.exports = { ADAPTERS, KNOWLEDGE_VERSION_EVERY_MS };

'use strict';

/**
 * A task's discussion (MongoDB, for tasks on either store; task ids are 24-hex on both).
 *
 *   TaskDiscussion   one per task: people added to the discussion by the creator / an assignee
 *                    (they may open the task even when it is private) and the counters.
 *   TaskComment      the stream: comments (`kind: 'comment'`) and automatic entries
 *                    (`kind: 'event'`: status, assignees, due date, priority, resolved / reopened,
 *                    people added, task created from a thread).
 *
 * Task content (title, description) is stored in plaintext on the server, not end-to-end
 * encrypted, so the discussion follows the task's model and is plaintext too.
 */

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const TaskDiscussionSchema = new mongoose.Schema({
    task: { type: ObjectId, required: true, unique: true },
    workspace: { type: ObjectId, default: null },
    // Added explicitly (not creator/assignee/watcher by role). Grants view access to the task.
    participants: [{ type: ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: null },
}, { timestamps: true });

TaskDiscussionSchema.index({ participants: 1 });

const AttachmentSchema = new mongoose.Schema({
    url: { type: String, required: true },
    name: { type: String, default: '' },
    type: { type: String, default: 'file' },
    size: { type: Number, default: null },
    mimeType: { type: String, default: null },
}, { _id: false });

const TaskCommentSchema = new mongoose.Schema({
    task: { type: ObjectId, required: true },
    workspace: { type: ObjectId, default: null },
    kind: { type: String, enum: ['comment', 'event'], default: 'comment' },
    // The person who wrote the comment or caused the event (null for automations).
    author: { type: ObjectId, ref: 'User', default: null },
    text: { type: String, default: '', maxlength: 10000 },
    mentions: [{ type: ObjectId, ref: 'User' }],
    attachments: { type: [AttachmentSchema], default: [] },
    event: {
        type: {
            type: String,
            enum: ['status', 'assignee_added', 'assignee_removed', 'reassigned', 'due_date', 'priority',
                'resolved', 'reopened', 'participant_added', 'participant_removed', 'thread_linked'],
        },
        from: { type: mongoose.Schema.Types.Mixed, default: null },
        to: { type: mongoose.Schema.Types.Mixed, default: null },
        meta: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
}, { timestamps: true });

TaskCommentSchema.index({ task: 1, createdAt: 1 });

const TaskDiscussion = mongoose.models.TaskDiscussion || mongoose.model('TaskDiscussion', TaskDiscussionSchema);
const TaskComment = mongoose.models.TaskComment || mongoose.model('TaskComment', TaskCommentSchema);

module.exports = { TaskDiscussion, TaskComment };

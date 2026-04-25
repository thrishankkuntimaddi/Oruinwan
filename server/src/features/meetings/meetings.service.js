'use strict';

const ScheduledMeeting = require('../../models/ScheduledMeeting');
const { summarizeDocument } = require('../ai/ai.summarizer.service');

const POPULATE_CREATED_BY = { path: 'createdBy', select: 'username firstName lastName avatarUrl' };
const POPULATE_PARTICIPANTS = { path: 'participants', select: 'username firstName lastName avatarUrl' };
const POPULATE_ACTION_ASSIGNED = { path: 'actionItems.assignedTo', select: 'username firstName lastName avatarUrl' };

async function populateMeeting(meeting) {
    return ScheduledMeeting
        .findById(meeting._id)
        .populate(POPULATE_CREATED_BY)
        .populate(POPULATE_PARTICIPANTS)
        .populate(POPULATE_ACTION_ASSIGNED)
        .lean();
}

async function getMeetings({ workspaceId, userId, companyId, limit = 20, includeCompleted = true }) {
    const query = { workspaceId };
    if (companyId) query.companyId = companyId;
    if (!includeCompleted) {
        query.status = { $in: ['scheduled', 'live'] };
    }
    return ScheduledMeeting
        .find(query)
        .sort({ startTime: -1 })
        .limit(Number(limit))
        .populate(POPULATE_CREATED_BY)
        .lean();
}

async function getMeeting(meetingId, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    return ScheduledMeeting
        .findOne(query)
        .populate(POPULATE_CREATED_BY)
        .populate(POPULATE_PARTICIPANTS)
        .populate(POPULATE_ACTION_ASSIGNED)
        .lean();
}

async function joinMeeting(meetingId, userId, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const meeting = await ScheduledMeeting.findOneAndUpdate(
        query,
        {
            status: 'live',
            $addToSet: { participants: userId },
        },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

async function endMeeting(meetingId, { companyId, recordingUrl } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const update = { status: 'completed' };
    if (recordingUrl) update.recordingUrl = recordingUrl;

    const meeting = await ScheduledMeeting.findOneAndUpdate(query, update, { new: true });
    if (!meeting) return null;
    return populateMeeting(meeting);
}

async function updateAgenda(meetingId, agenda, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const meeting = await ScheduledMeeting.findOneAndUpdate(
        query,
        { $set: { agenda } },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

async function updateTranscript(meetingId, transcript, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const meeting = await ScheduledMeeting.findOneAndUpdate(
        query,
        { $set: { transcript } },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

async function updateSharedNotes(meetingId, sharedNotes, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    await ScheduledMeeting.findOneAndUpdate(query, { $set: { sharedNotes } });
}

async function summarizeMeeting(meetingId, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const meeting = await ScheduledMeeting.findOne(query).lean();
    if (!meeting) return null;

    const text = meeting.transcript || meeting.sharedNotes || '';
    const { summary } = await summarizeDocument(text, {
        title: meeting.title,
        type: 'generic',
        noCache: true,
    });

    await ScheduledMeeting.findByIdAndUpdate(meetingId, { $set: { summary } });
    return summary;
}

async function suggestTime({ participantIds, durationMinutes = 30 }) {
    const now = new Date();
    
    const next = new Date(now);
    next.setHours(now.getHours() + 1, 0, 0, 0);
    const end = new Date(next.getTime() + durationMinutes * 60 * 1000);
    return {
        suggestedStart: next.toISOString(),
        suggestedEnd: end.toISOString(),
        durationMinutes,
        note: 'Next available slot (placeholder — integrate calendar API for real availability)',
    };
}

async function addActionItem(meetingId, { text, assignedTo, status = 'pending' }, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const item = { text, assignedTo: assignedTo || null, status };
    const meeting = await ScheduledMeeting.findOneAndUpdate(
        query,
        { $push: { actionItems: item } },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

async function updateActionItem(meetingId, actionItemId, updates, { companyId } = {}) {
    const query = { _id: meetingId };
    if (companyId) query.companyId = companyId;

    const setPayload = {};
    if (updates.text !== undefined) setPayload['actionItems.$.text'] = updates.text;
    if (updates.status !== undefined) setPayload['actionItems.$.status'] = updates.status;
    if (updates.assignedTo !== undefined) setPayload['actionItems.$.assignedTo'] = updates.assignedTo;
    if (updates.taskId !== undefined) setPayload['actionItems.$.taskId'] = updates.taskId;

    const meeting = await ScheduledMeeting.findOneAndUpdate(
        { ...query, 'actionItems._id': actionItemId },
        { $set: setPayload },
        { new: true }
    );
    if (!meeting) return null;
    return populateMeeting(meeting);
}

module.exports = {
    getMeetings,
    getMeeting,
    joinMeeting,
    endMeeting,
    updateAgenda,
    updateTranscript,
    updateSharedNotes,
    summarizeMeeting,
    suggestTime,
    addActionItem,
    updateActionItem,
};

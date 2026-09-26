'use strict';

/**
 * Support tickets as the platform (Chttrix) admins see them.
 *
 * Company users create tickets through /api/platform/support, which stores the
 * ticket in SupportTicket and every message in SupportMessage. The admin views
 * read and reply through here so both sides work on the same records.
 */

const SupportTicket = require('../../../models/SupportTicket');
const SupportMessage = require('../../../models/SupportMessage');

const LIVE_CHAT_SUBJECT = 'Live Chat Support';
const STATUSES = ['open', 'in-progress', 'resolved', 'closed'];

function idOf(value) {
  return value && String(value._id || value);
}

/** Thread in the shape the admin UI renders: { _id, sender, message, senderRole, createdAt }. */
function buildThread(ticket, supportMessages) {
  const fromCollection = supportMessages.map((m) => ({
    _id: m._id,
    sender: m.sender,
    message: m.content,
    senderRole: m.senderRole,
    createdAt: m.createdAt,
  }));
  // Messages saved on the ticket document by older code paths.
  const embedded = (ticket.messages || []).map((m) => ({
    _id: m._id,
    sender: m.sender,
    message: m.content || m.message,
    senderRole: m.isFromAdmin ? 'platform' : 'company',
    createdAt: m.createdAt,
  }));
  const thread = [...fromCollection, ...embedded].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  // Ticket creation stores the description as the first message; it is already shown as the description.
  if (thread[0] && thread[0].message === ticket.description && idOf(thread[0].sender) === idOf(ticket.creatorId)) {
    thread.shift();
  }
  return thread;
}

async function withThreads(tickets) {
  if (!tickets.length) return [];
  const messages = await SupportMessage.find({ ticket: { $in: tickets.map((t) => t._id) }, deletedAt: null })
    .populate('sender', 'username email roles')
    .sort({ createdAt: 1 })
    .lean();
  const byTicket = new Map();
  for (const m of messages) {
    const key = String(m.ticket);
    if (!byTicket.has(key)) byTicket.set(key, []);
    byTicket.get(key).push(m);
  }
  return tickets.map((t) => ({ ...t, messages: buildThread(t, byTicket.get(String(t._id)) || []) }));
}

function baseQuery(query) {
  return query
    .populate('companyId', 'name domain')
    .populate('creatorId', 'username email')
    .populate('messages.sender', 'username email roles')
    .lean();
}

async function listTickets({ status, priority, companyId } = {}) {
  const filter = {};
  if (typeof status === 'string' && status) filter.status = status;
  if (typeof priority === 'string' && priority) filter.priority = priority;
  if (typeof companyId === 'string' && companyId) filter.companyId = companyId;
  const tickets = await baseQuery(SupportTicket.find(filter).sort({ createdAt: -1 }));
  return withThreads(tickets);
}

async function getTicket(id) {
  const ticket = await baseQuery(SupportTicket.findById(id));
  if (!ticket) return null;
  const [withThread] = await withThreads([ticket]);
  return withThread;
}

function countOpenTickets() {
  return SupportTicket.countDocuments({ status: { $in: ['open', 'in-progress'] } });
}

/**
 * Apply an admin's status change and/or reply. Returns the refreshed ticket, or null if not found.
 * Throws { statusCode: 400 } for an invalid status.
 */
async function adminUpdate(id, { status, message, adminId, io }) {
  if (status !== undefined && !STATUSES.includes(status)) {
    const err = new Error(`Invalid status "${status}"`);
    err.statusCode = 400;
    throw err;
  }
  const ticket = await SupportTicket.findById(id);
  if (!ticket) return null;

  if (status) {
    ticket.status = status;
    if (status === 'resolved') ticket.resolvedAt = new Date();
    if (status === 'closed') ticket.closedAt = new Date();
  }

  let reply = null;
  const text = typeof message === 'string' ? message.trim() : '';
  if (text) {
    reply = await SupportMessage.create({
      ticket: ticket._id,
      company: ticket.companyId,
      sender: adminId,
      senderRole: 'platform',
      content: text,
    });
    await reply.populate('sender', 'username email profilePicture');
    if (!status && ticket.status === 'open') ticket.status = 'in-progress';
  }

  await ticket.save();

  if (io) {
    const companyRoom = `company_${ticket.companyId}`;
    if (reply) {
      io.to(companyRoom).emit('support-message', { ticketId: String(ticket._id), message: reply });
      // The "Contact admin" chat tab shows the live-chat ticket and listens for platform-message.
      if (ticket.subject === LIVE_CHAT_SUBJECT) {
        io.to(`user-support:${ticket.creatorId}`).emit('platform-message', reply);
      }
    }
    if (status) {
      io.to(companyRoom).emit('support-ticket-updated', { ticketId: String(ticket._id), status: ticket.status });
    }
  }

  return getTicket(ticket._id);
}

module.exports = { listTickets, getTicket, adminUpdate, countOpenTickets, buildThread, STATUSES, LIVE_CHAT_SUBJECT };

// Live adapter part: design reviews, /api/v2/design-reviews (docs/api/design-review.md).
// Merged into liveAdapter (adapter.js), so screens call these through api().
// Realtime: emit design-review:join / :leave; the server sends design-review:{annotation,updated,
// deleted,presence,pointer} to the room (screens read them from the bus's 'socket' event).
import { ApiError, NETWORK_MESSAGE, absolute, accessToken, api, refreshSession, serverUrl } from './http.js';
import { socketEmit, socketRequest } from './realtime.js';
import { clientPlatform } from '../../native/index.js';

const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : null);

function person(u) {
  if (!u) return null;
  if (typeof u !== 'object') return { id: String(u), name: null, avatarUrl: null };
  return { id: idOf(u), name: u.profile?.name || u.name || u.username || null, avatarUrl: absolute(u.profilePicture) || null };
}

export const reviewKindOf = (mimeType = '') =>
  mimeType.startsWith('image/') ? 'image' : mimeType === 'application/pdf' ? 'pdf' : mimeType.startsWith('video/') ? 'video' : null;

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function mapAnnotation(a) {
  if (!a) return null;
  return {
    id: idOf(a),
    reviewId: idOf(a.reviewId),
    versionNumber: a.versionNumber ?? null,
    page: num(a.page, 1) || 1,
    x: num(a.x),
    y: num(a.y),
    w: num(a.w),
    h: num(a.h),
    timeMs: a.timeMs == null ? null : num(a.timeMs),
    author: person(a.authorId),
    body: a.body || '',
    resolved: Boolean(a.resolved),
    resolvedBy: person(a.resolvedBy),
    resolvedAt: a.resolvedAt || null,
    replies: (a.replies || []).map((r) => ({ id: idOf(r), author: person(r.authorId), body: r.body || '', at: r.createdAt || null })),
    at: a.createdAt || null,
  };
}

export function mapReview(r) {
  if (!r) return null;
  const file = r.file || null;
  const version = r.version || null;
  return {
    id: idOf(r),
    workspaceId: idOf(r.workspaceId),
    fileId: idOf(r.fileId) || idOf(file),
    title: r.title || file?.name || 'Design review',
    description: r.description || '',
    versionNumber: r.versionNumber ?? version?.versionNumber ?? 1,
    rounds: (r.rounds || []).map((x) => ({ versionNumber: x.versionNumber, at: x.startedAt || null })),
    creator: person(r.createdBy),
    reviewers: (r.reviewers || []).map((x) => ({ user: person(x.user), decision: x.decision || 'pending', note: x.note || '', at: x.decidedAt || null })),
    status: ['open', 'changes_requested', 'approved'].includes(r.status) ? r.status : 'open',
    due: r.dueDate || null,
    updatedAt: r.updatedAt || r.createdAt || null,
    counts: r.annotationCounts ? { total: r.annotationCounts.total || 0, open: r.annotationCounts.open || 0 } : null,
    file: file ? { id: idOf(file), name: file.name || 'File', mimeType: file.mimeType || '', kind: file.kind || reviewKindOf(file.mimeType), currentVersion: file.currentVersion || 1 } : null,
    // The displayed version: `url` goes through /api/v2/uploads/file (sign it with mediaUrl).
    version: version ? { versionNumber: version.versionNumber, url: version.url || null, mimeType: version.mimeType || file?.mimeType || '', current: Boolean(version.current) } : null,
    permissions: { canManage: Boolean(r.permissions?.canManage), canDecide: Boolean(r.permissions?.canDecide) },
  };
}

function mapLibraryFile(f) {
  return { id: idOf(f), name: f.name || 'File', mimeType: f.mimeType || '', kind: reviewKindOf(f.mimeType || ''), version: f.currentVersion || 1, url: f.url || null, gcsPath: f.gcsPath || null, updatedAt: f.updatedAt || f.createdAt || null };
}

async function postMultipart(path, form) {
  const send = async () => {
    let res;
    try {
      res = await fetch(`${serverUrl()}/api${path}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'x-client-platform': clientPlatform, ...(accessToken() ? { Authorization: `Bearer ${accessToken()}` } : {}) },
        body: form,
      });
    } catch {
      throw new ApiError(NETWORK_MESSAGE, 0, null);
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { res, data };
  };
  let { res, data } = await send();
  if (res.status === 401) {
    await refreshSession();
    ({ res, data } = await send());
  }
  if (!res.ok) throw new ApiError(data?.message || `Upload failed (${res.status})`, res.status, data);
  return data;
}

export const designAdapter = {
  /** Reviews in the workspace, newest activity first. `mine`: I created it or review it. */
  async designReviews(ws, { status, mine } = {}) {
    const data = await api.get('/v2/design-reviews', { workspaceId: ws, ...(status ? { status } : {}), ...(mine ? { mine: 'true' } : {}) });
    return (data.reviews || []).map(mapReview);
  },
  /** { review, annotations } — review carries file, version (with url) and permissions. */
  async designReview(id) {
    const data = await api.get(`/v2/design-reviews/${id}`);
    return { review: mapReview(data.review), annotations: (data.annotations || []).map(mapAnnotation) };
  },
  async createDesignReview({ fileId, title, description, reviewers, dueDate }) {
    const data = await api.post('/v2/design-reviews', { fileId, ...(title ? { title } : {}), ...(description ? { description } : {}), reviewers: reviewers || [], ...(dueDate ? { dueDate } : {}) });
    return mapReview(data.review);
  },
  async updateDesignReview(id, patch) {
    const data = await api.patch(`/v2/design-reviews/${id}`, patch);
    return mapReview(data.review);
  },
  async deleteDesignReview(id) {
    await api.del(`/v2/design-reviews/${id}`);
  },
  async decideDesignReview(id, decision, note) {
    const data = await api.post(`/v2/design-reviews/${id}/decision`, { decision, ...(note ? { note } : {}) });
    return mapReview(data.review);
  },
  async newDesignRound(id, versionNumber) {
    const data = await api.post(`/v2/design-reviews/${id}/rounds`, versionNumber ? { versionNumber } : {});
    return mapReview(data.review);
  },
  async addAnnotation(id, { x, y, w, h, page, timeMs, body }) {
    const data = await api.post(`/v2/design-reviews/${id}/annotations`, { x, y, ...(w ? { w } : {}), ...(h ? { h } : {}), ...(page ? { page } : {}), ...(timeMs != null ? { timeMs } : {}), body });
    return mapAnnotation(data.annotation);
  },
  async updateAnnotation(id, annotationId, patch) {
    const data = await api.patch(`/v2/design-reviews/${id}/annotations/${annotationId}`, patch);
    return mapAnnotation(data.annotation);
  },
  async deleteAnnotation(id, annotationId) {
    await api.del(`/v2/design-reviews/${id}/annotations/${annotationId}`);
  },
  async resolveAnnotation(id, annotationId, resolved = true) {
    const data = await api.post(`/v2/design-reviews/${id}/annotations/${annotationId}/resolve`, { resolved });
    return mapAnnotation(data.annotation);
  },
  async replyAnnotation(id, annotationId, body) {
    const data = await api.post(`/v2/design-reviews/${id}/annotations/${annotationId}/replies`, { body });
    return mapAnnotation(data.annotation);
  },
  /** Library files that can be reviewed (images, PDFs, videos), newest first. */
  async reviewableFiles(ws) {
    const data = await api.get('/v2/files', { workspaceId: ws });
    return (data.files || [])
      .map(mapLibraryFile)
      .filter((f) => f.kind)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  },
  /** Puts a photo or file from the phone into the workspace library (to start a review on it). */
  async uploadReviewFile(ws, file) {
    const form = new FormData();
    form.append('workspaceId', ws);
    form.append('file', file, file.name || 'design');
    const data = await postMultipart('/v2/files', form);
    return mapLibraryFile(data.file || data);
  },
  /** Joins the review's live room; resolves with the viewer ids (or null when offline / refused). */
  async joinDesignReview(reviewId) {
    const ack = await socketRequest('design-review:join', { reviewId });
    return ack?.ok ? (ack.viewers || []).map(String) : null;
  },
  leaveDesignReview(reviewId) {
    socketEmit('design-review:leave', { reviewId });
  },
  mapAnnotation,
  mapReview,
};

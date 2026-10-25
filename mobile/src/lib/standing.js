// Someone who left the workspace, was removed or suspended, or closed their account keeps their
// name on everything they wrote; a small tag says they're no longer active (server: standing).

const LABELS = { former: 'Former member', deactivated: 'Deactivated', suspended: 'Suspended' };

/** The tag for a person, or null when they're active. */
export function standingLabel(person) {
  return LABELS[person?.standing] || null;
}

/** Only people who can be messaged, mentioned or added (pickers). */
export function activePeople(list) {
  return (list || []).filter((u) => !u.standing || u.standing === 'active');
}

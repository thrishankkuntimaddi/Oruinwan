// Starting points for new notes; they mirror the web client's template picker.
export const TEMPLATES = [
  { id: 'blank', emoji: '📝', label: 'Blank', hint: 'Start from scratch', type: 'note', title: '', content: '' },
  {
    id: 'meeting', emoji: '🗓️', label: 'Meeting notes', hint: 'Agenda, decisions, actions', type: 'meeting', title: 'Meeting notes',
    content: '<p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><h2>Agenda</h2><ul><li></li></ul><h2>Decisions</h2><ul><li></li></ul><h2>Action items</h2><ul data-type="checklist"><li data-checked="false"></li></ul>',
  },
  {
    id: 'spec', emoji: '🎯', label: 'Project spec', hint: 'Goals, scope, milestones', type: 'projectspec', title: 'Project spec',
    content: '<h2>Problem</h2><p></p><h2>Goals</h2><ul><li></li></ul><h2>Out of scope</h2><ul><li></li></ul><h2>Milestones</h2><ol><li></li></ol>',
  },
  {
    id: 'tech', emoji: '🛠️', label: 'Tech design', hint: 'Context, approach, risks', type: 'techdesign', title: 'Tech design',
    content: '<h2>Context</h2><p></p><h2>Approach</h2><p></p><h2>Alternatives considered</h2><ul><li></li></ul><h2>Risks</h2><ul><li></li></ul>',
  },
  {
    id: 'brainstorm', emoji: '💡', label: 'Brainstorm', hint: 'Ideas, then next steps', type: 'brainstorm', title: 'Brainstorm',
    content: '<h2>Question</h2><p></p><h2>Ideas</h2><ul><li></li></ul><h2>Next steps</h2><ul data-type="checklist"><li data-checked="false"></li></ul>',
  },
  {
    id: 'sop', emoji: '📋', label: 'SOP', hint: 'Step-by-step procedure', type: 'sop', title: 'Procedure',
    content: '<h2>Purpose</h2><p></p><h2>Steps</h2><ol><li></li></ol><h2>Checklist</h2><ul data-type="checklist"><li data-checked="false"></li></ul>',
  },
  {
    id: 'announce', emoji: '📣', label: 'Announcement', hint: 'Share news with the team', type: 'announcement', title: 'Announcement',
    content: '<h2>What’s happening</h2><p></p><h2>Why it matters</h2><p></p><h2>What you need to do</h2><ul><li></li></ul>',
  },
];

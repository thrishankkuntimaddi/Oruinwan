// Huddles: calls, the in-call workspace, wrap-up, meetings.
export default {
    id: 'huddles',
    title: 'Huddles & meetings',
    icon: 'Headphones',
    blurb: 'Voice and video calls with screen sharing, shared notes and tasks while you talk, and an AI wrap-up afterwards.',
    pages: [
        {
            id: 'start',
            title: 'Start or join a huddle',
            summary: 'Voice or video calls from any conversation or the Huddles page, with screen sharing.',
            keywords: 'huddle call voice video start join screen share mute camera participants',
            blocks: [
                { h: 'Start one' },
                { list: [
                    'In a channel or DM, use the call buttons in the header, or type `/call` (voice) or `/video`.',
                    'Or open **Huddles** and choose **Start a huddle**.',
                ] },
                'If a huddle is already running in that conversation, the same buttons join it.',
                { h: 'In the call' },
                { list: [
                    '**Mute** / unmute, camera on or off, and **share your screen**.',
                    'Huddles are peer-to-peer (WebRTC) and hold up to **6 people** by default (a server setting).',
                ] },
                { h: 'The “in huddle” pill' },
                'Move around the app while you talk: a small **In huddle** pill stays on screen whenever you are in a call that the page you are on is not showing. Use it to go back to the call, open the huddle workspace, mute, or leave.',
                { figure: 'huddle', caption: 'In a huddle: the pill, the tiles, and the shared notes filling in.' },
            ],
        },
        {
            id: 'workspace-panel',
            title: 'The huddle workspace: notes, tasks, chat',
            summary: 'A side panel in every call with shared notes, the tasks that matter, and the conversation.',
            keywords: 'huddle workspace panel notes tasks chat action items shared live',
            blocks: [
                'Open the huddle workspace from the call or the pill. It has four tabs:',
                { table: { caption: 'Huddle workspace tabs', head: ['Tab', 'What it does'], rows: [
                    ['Notes', 'Shared notes everyone in the call types into at the same time, plus **Action items** (“Bob: send the draft by Friday”). Each action item can become a task with one click. The notes are a normal note that stays in Notes after the call.'],
                    ['Tasks', 'Tasks created in this huddle, linked to it, mentioned by key in the notes, or belonging to the channel. Link or unlink tasks here.'],
                    ['Chat', 'The conversation the huddle belongs to, so you can read and post without leaving the call.'],
                    ['Wrap-up', 'Build and post a summary when you are done. See [Huddle wrap-up](/docs/huddles/wrap-up).'],
                ] } },
                { callout: 'note', text: 'People typing in different paragraphs never overwrite each other. If two people edit the same paragraph at the same moment, the last save wins.' },
            ],
        },
        {
            id: 'wrap-up',
            title: 'Huddle wrap-up',
            summary: 'Post the outcome of a call to the channel: summary, action items, tasks and a link to the notes.',
            keywords: 'wrap up wrapup summary huddle ai post channel action items',
            blocks: [
                { steps: [
                    'Open the **Wrap-up** tab in the huddle workspace.',
                    'Choose **Summarise with Oruinwan AI** for 3–5 bullets: decisions made, open questions and who owns what next.',
                    'Check the message. It includes the huddle title, duration, participants, the summary, the **Action items** checklist, the **Tasks** and a link to the notes. Edit it freely, or rebuild it from the notes and tasks.',
                    'Pick the channel (or DM) and post it.',
                ] },
                'The wrap-up is posted like any message (end-to-end encrypted), and the people who were in the call are notified.',
            ],
        },
        {
            id: 'meetings',
            title: 'Meetings and huddle history',
            summary: 'Schedule meetings, and see what is live, scheduled and recent.',
            keywords: 'meeting schedule scheduled history recent live calendar meet zoom',
            blocks: [
                { list: [
                    'Open **Huddles** to see what is **Live now**, **Scheduled** and **Recent**. Select a live huddle to join it.',
                    'Choose **Schedule a meeting**, or type `/meet` in a conversation to schedule one and post it there.',
                    'With Zoom connected, `/zoom [topic]` creates a Zoom meeting and posts the join link. See [Jira and Zoom](/docs/integrations/jira-zoom).',
                ] },
            ],
        },
    ],
};

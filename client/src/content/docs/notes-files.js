// Notes, files, knowledge base and the Updates feed.
export default {
    id: 'notes',
    title: 'Notes, files & knowledge',
    icon: 'NotebookPen',
    blurb: 'Write with blocks, share notes, find every file, build the knowledge base, and post updates.',
    pages: [
        {
            id: 'notes',
            title: 'Write notes with blocks',
            summary: 'Type / for headings, checklists, tables, code, media and more; templates, history and PDF export.',
            keywords: 'note notes write blocks slash heading checklist table code template favorite pdf history version',
            blocks: [
                'Open **Notes** in the sidebar and create a note, or start from a template.',
                { h: 'Blocks' },
                'On an empty line type [[/]] to insert a block: **text**, **headings**, **code**, **checklist**, **toggle**, **callout**, **divider**, **table**, **image**, **video**, **audio** or **file**.',
                { h: 'Around the note' },
                { list: [
                    'Star notes as **favorites**, **duplicate** them, **copy a link**, or **download as PDF**.',
                    'Open the **history** to see earlier versions and restore one.',
                    'Use the AI tools: summarize, extract action items, expand bullets, rewrite professionally, proofread, shorten or continue writing.',
                ] },
            ],
        },
        {
            id: 'share-notes',
            title: 'Share a note',
            summary: 'Keep it private, share with people, or open it to the workspace.',
            keywords: 'share note permission view edit workspace private collaborate',
            blocks: [
                { steps: [
                    'As the owner, choose **Share** on a note.',
                    'Set visibility to **Private** or **Workspace** (every member can view).',
                    'Add specific people, and decide whether each can **View** or **Edit**.',
                ] },
                'Changes appear for others as they are saved.',
                { callout: 'tip', text: 'Workspace-visible notes are what Oruinwan AI can use when answering in shared conversations. Private notes are only used in your own AI panel.' },
            ],
        },
        {
            id: 'files',
            title: 'Find and manage files',
            summary: 'Every file shared in the workspace, with details, comments and versions.',
            keywords: 'files upload attachment document search version comment tags size',
            blocks: [
                'Open **Files** to search everything shared in the workspace. Open a file to see its size, type, tags and upload date, leave comments, and view its version history.',
                { list: [
                    'Files come from conversations (attachments) and from uploads.',
                    'Each file can be up to **100 MB**; programs and installers are refused.',
                    'Files are stored on Oruinwan’s servers and are not end-to-end encrypted.',
                ] },
            ],
        },
        {
            id: 'knowledge',
            title: 'Build the knowledge base',
            summary: 'Linked Markdown pages with an AI summary and a graph view.',
            keywords: 'knowledge base wiki page markdown graph link docs tags summary',
            blocks: [
                { steps: [
                    'Open **Knowledge** and choose **New page**.',
                    'Write in Markdown (with a preview) and add tags.',
                    'Use **Link a page** to connect related pages.',
                ] },
                { list: [
                    '**AI summary** gives a quick recap of a page.',
                    'The **Knowledge graph** shows how pages connect.',
                    'Oruinwan AI searches these pages when you ask about your workspace. See [Ask about your workspace](/docs/ai/knowledge).',
                ] },
            ],
        },
        {
            id: 'updates',
            title: 'Updates feed',
            summary: 'A company feed for announcements, wins and progress posts.',
            keywords: 'updates feed post announcement company news share',
            blocks: [
                '**Updates** (in the icon sidebar of company accounts) is a feed for sharing news with your colleagues: launches, wins, progress, announcements.',
                { steps: [
                    'Open **Updates**.',
                    'Write in **What would you like to share with your team?**, add an optional title, emoji or an image.',
                    'Post it. Use the search box to find older updates, and refresh to see new ones.',
                ] },
                'You can delete your own posts. Deleting cannot be undone.',
            ],
        },
    ],
};

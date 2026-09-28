// Tasks: statuses, views, from conversations, linked PRs.
export default {
    id: 'tasks',
    title: 'Tasks',
    icon: 'CheckSquare',
    blurb: 'Plan work on a list, board, sprint or timeline, turn messages into tasks, and link pull requests.',
    pages: [
        {
            id: 'basics',
            title: 'Create and track tasks',
            summary: 'Titles, assignees, priorities and due dates; statuses from Backlog to Done; task keys like ENG-41.',
            keywords: 'task tasks create new status priority backlog todo in progress review blocked done cancelled assign due date key issue',
            blocks: [
                { steps: [
                    'Open **Tasks** in the sidebar and create a task.',
                    'Give it a title, and optionally a description, assignees, priority and due date.',
                    'Pick a type: **Task**, **Bug**, **Epic** or **Subtask**.',
                ] },
                'Every task gets a **key** made from the workspace name and a number, like `ENG-41`. Use it to refer to the task in chat, in pull requests and in branch names.',
                { h: 'Statuses' },
                { table: { caption: 'Task statuses', head: ['Status', 'Meaning'], rows: [
                    ['Backlog', 'Captured, not planned yet.'],
                    ['To do', 'Planned and ready to start.'],
                    ['In progress', 'Someone is working on it.'],
                    ['In review', 'Waiting for review (a linked pull request moves it here automatically).'],
                    ['Blocked', 'Cannot move until something else happens.'],
                    ['Done', 'Finished (merging a linked pull request moves it here).'],
                    ['Cancelled', 'Will not be done.'],
                ] } },
                'Priorities go from **Lowest** to **Highest**.',
                { h: 'Your task lists' },
                'The Tasks sidebar lists **My issues**, **Incoming**, **Given**, **All issues**, **Completed** and **Trash**.',
                { callout: 'tip', text: 'Open a task and use the AI buttons to write a description, suggest subtasks, draft acceptance criteria or estimate effort. See [AI across the app](/docs/ai/everywhere).' },
            ],
        },
        {
            id: 'views',
            title: 'List, board, sprint, timeline and workload',
            summary: 'See the same tasks in the view that fits the job.',
            keywords: 'board kanban sprint timeline gantt workload list view columns drag',
            blocks: [
                'Switch views at the top of Tasks:',
                { table: { caption: 'Task views', head: ['View', 'Best for'], rows: [
                    ['List', 'Scanning, sorting and bulk changes.'],
                    ['Board', 'Kanban columns by status; drag a card to change its status.'],
                    ['Sprint', 'Planning and running a time-boxed sprint.'],
                    ['Timeline', 'Dates and overlaps across weeks.'],
                    ['Workload', 'Who has what, so nobody is overloaded.'],
                ] } },
                { figure: 'board', caption: 'A card moving across the board from To do to Done.' },
            ],
        },
        {
            id: 'from-conversations',
            title: 'Tasks from conversations',
            summary: 'Convert a message to a task, use /task, and see each channel’s tasks in its Tasks tab.',
            keywords: 'convert message task create from chat channel tasks tab slash task',
            blocks: [
                { h: 'Convert a message' },
                { steps: [
                    'Open **More → Convert to task** on a message.',
                    'Fill in the title, description, priority and an optional due date.',
                    'Create it. The message now shows a badge linking to the task.',
                ] },
                { h: 'Other ways' },
                { list: [
                    'Type `/task <title>` in a conversation to create a task there.',
                    'Each channel has a **Tasks** tab (with its own board) for the tasks that belong to it.',
                    'In a huddle, action items in the shared notes can become tasks with one click. See [The huddle workspace](/docs/huddles/workspace-panel).',
                    'In the AI panel, ask “add a task to…” or use **Action items**.',
                ] },
            ],
        },
        {
            id: 'linked-prs',
            title: 'Linked pull requests',
            summary: 'Put a task key in a PR title, branch or description and the task follows the PR.',
            keywords: 'pull request pr github link linked task key status sync review done branch',
            blocks: [
                'When [GitHub is connected](/docs/integrations/github), put the task key in the pull request **title**, **branch** or **description**, for example branch `feature/eng-41-invite-expiry`. The PR is linked to `ENG-41`.',
                { table: { caption: 'Status sync', head: ['On GitHub', 'The linked task'], rows: [
                    ['PR opened (not a draft), reopened or marked ready for review', 'Moves to **In review** (from Backlog, To do or In progress).'],
                    ['PR opened as a draft', 'Moves to **In progress** (from Backlog or To do).'],
                    ['PR merged', 'Moves to **Done**.'],
                    ['PR closed without merging, or converted to draft', 'Stays put; a note is added.'],
                ] } },
                'Linked pull requests (and Jira issues) are listed in the task’s detail panel. Open **View changes** to read the diff next to the task.',
                { callout: 'note', text: 'Status sync is a GitHub setting (**Sync task status**) that an admin turns on. Keys are only linked when they match a real task in the workspace.' },
            ],
        },
    ],
};

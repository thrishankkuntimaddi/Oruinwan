/**
 * automation.templates.js
 *
 * Predefined automation templates for quick-start.
 * Returned by GET /api/v2/automations/templates — no DB needed.
 */

const AUTOMATION_TEMPLATES = [
    {
        id: 'task_completed_notify_manager',
        name: 'Task completed → Notify manager',
        description: 'When a task is completed, send a notification to workspace admins.',
        category: 'Tasks',
        icon: '✅',
        trigger: { type: 'task.completed', config: {} },
        conditions: [],
        actions: [
            {
                type: 'send_notification',
                config: {
                    title: 'Task completed',
                    body: 'A task was just completed in your workspace.'
                }
            }
        ]
    },
    {
        id: 'task_created_notify_team',
        name: 'New task → Notify channel',
        description: 'When a new task is created, post a message in a specified channel.',
        category: 'Tasks',
        icon: '📋',
        trigger: { type: 'task.created', config: {} },
        conditions: [],
        actions: [
            {
                type: 'send_message',
                config: {
                    channelId: '',
                    text: '📋 New task created: {{task.title}}'
                }
            }
        ]
    },
    {
        id: 'meeting_ended_create_action_items',
        name: 'Meeting ended → Create action items task',
        description: 'When a meeting ends, automatically create a follow-up task for action items.',
        category: 'Meetings',
        icon: '📅',
        trigger: { type: 'meeting.completed', config: {} },
        conditions: [],
        actions: [
            {
                type: 'create_task',
                config: {
                    title: 'Action items from meeting: {{meeting.title}}',
                    priority: 'high'
                }
            }
        ]
    },
    {
        id: 'pr_merged_post_engineering',
        name: 'PR merged → Post in #engineering',
        description: 'When a GitHub PR is merged, post a message in the engineering channel.',
        category: 'Integrations',
        icon: '🔀',
        trigger: { type: 'github.pr_merged', config: {} },
        conditions: [],
        actions: [
            {
                type: 'send_message',
                config: {
                    channelId: '',
                    text: '🚀 PR merged: {{event.title}} by {{event.actor}}'
                }
            }
        ]
    },
    {
        id: 'pr_merged_create_deploy_task',
        name: 'PR merged → Create deployment task',
        description: 'When a GitHub PR is merged, create a deployment task automatically.',
        category: 'Integrations',
        icon: '🚀',
        trigger: { type: 'github.pr_merged', config: {} },
        conditions: [{ field: 'repo', operator: 'equals', value: 'frontend' }],
        actions: [
            {
                type: 'create_task',
                config: {
                    title: 'Release deployment — {{event.repo}}',
                    priority: 'high'
                }
            }
        ]
    },
    {
        id: 'file_uploaded_create_review_task',
        name: 'File uploaded → Create review task',
        description: 'When a file is uploaded, automatically create a task to review it.',
        category: 'Files',
        icon: '📁',
        trigger: { type: 'file.uploaded', config: {} },
        conditions: [],
        actions: [
            {
                type: 'create_task',
                config: {
                    title: 'Review uploaded file: {{event.fileName}}',
                    priority: 'medium'
                }
            }
        ]
    },
    {
        id: 'daily_standup_reminder',
        name: 'Daily standup reminder',
        description: 'Post a daily standup reminder message at a set interval.',
        category: 'Scheduled',
        icon: '⏰',
        trigger: { type: 'scheduled', config: {} },
        conditions: [],
        schedule: { type: 'interval', expression: '24h' },
        actions: [
            {
                type: 'send_message',
                config: {
                    channelId: '',
                    text: '⏰ Daily standup time! Share your updates in the thread.'
                }
            }
        ]
    },
    {
        id: 'webhook_received_notify',
        name: 'Webhook received → Notify team',
        description: 'When an inbound webhook is received, notify the team with a message.',
        category: 'Integrations',
        icon: '🔗',
        trigger: { type: 'webhook.received', config: {} },
        conditions: [],
        actions: [
            {
                type: 'send_notification',
                config: {
                    title: 'Webhook received',
                    body: 'An external event triggered a webhook for your workspace.'
                }
            }
        ]
    }
];

module.exports = AUTOMATION_TEMPLATES;

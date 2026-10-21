# Mobile app: work, admin and offline features (client side)

No new server endpoints. The phone/tablet app (`mobile/`) calls existing routes through
`mobile/src/data/live/adapter.work.js`, merged into the live adapter, so screens use `api().<method>`.

## Adapter methods → server routes

| Area | Method | Route |
|---|---|---|
| Tasks | `planningTask(id)`, `planningTasks(ws)` | `GET /api/v2/tasks/:id`, `GET /api/v2/tasks?workspaceId&includeSubtasks=true` |
| | `addSubtask(id, {title, priority, assigneeIds})` | `POST /api/v2/tasks/:id/subtasks` |
| | `setTaskStatus(id, status, blockedReason)` | `PUT /api/v2/tasks/:id` |
| | `addDependency(id, otherId)` | `POST /api/v2/tasks/:id/dependency` |
| | `linkTask(id, otherId, type)`, `unlinkTask(id, linkId)` | `POST/DELETE /api/v2/tasks/:id/links` |
| | `startTimer(id)`, `stopTimer(id)` | `POST /api/v2/tasks/:id/time/{start,stop}` |
| | `workload(ws)` | `GET /api/v2/tasks/workload` |
| Planning | `sprints`, `createSprint`, `updateSprint` | `/api/sprints` |
| | `milestones`, `createMilestone`, `updateMilestone` | `/api/milestones` |
| | `taskTemplates`, `createTaskTemplate`, `deleteTaskTemplate`, `createTaskFromTemplate` | `/api/task-templates` (+ task and subtask creation) |
| Meetings | `meetingsList`, `meeting` | `GET /api/v2/meetings`, `GET /api/v2/meetings/:id` |
| | `scheduleMeeting`, `cancelMeeting` | `POST /api/scheduled-meetings`, `PATCH /api/scheduled-meetings/:id` |
| | `saveAgenda`, `summarizeMeeting`, `addActionItem`, `updateActionItem`, `actionItemToTask` | `/api/v2/meetings/:id/{agenda,summarize,action-items}` |
| | `suggestTimes({participantIds, minutes})` | `POST /api/v2/meetings/suggest-time` (single slot or a list) |
| | `brainstorm`, `addSticky`, `deleteSticky`, `joinMeetingRoom` | `/api/v2/collaboration/brainstorm/:meetingId`, socket `meeting:join` → `brainstorm:update` |
| Files | `fileDetail`, `setFileTags`, `fileVersions`, `uploadFileVersion`, `restoreFileVersion`, `fileComments`, `addFileComment`, `shareFile` | `/api/v2/files/:id/...` |
| Knowledge | `pageMeta`, `backlinks`, `outgoingLinks`, `linkPage`, `unlinkPage`, `knowledgeCategories`, `createKnowledgeCategory`, `setPageCategory`, `summarizePage` | `/api/v2/knowledge/...` |
| Admin | `workspaceTemplates`, `createWorkspaceFromTemplate` | `/api/workspace-templates`, `POST /api/workspaces/create` |
| | `cloneWorkspace`, `exportWorkspace`, `importWorkspace`, `workspaceAnalytics` | `/api/workspace-os/...` |
| | `workspacePermissions`, `saveWorkspacePermissions`, `workspaceFeatures`, `saveWorkspaceFeatures` | `/api/workspaces/:id/{permissions,features}` |
| | `channelPolicy`, `setChannelPosting`, `setChannelMentions` | `/api/channels/:id/{mute,posting-policy,mention-policy}` |
| | `memberDirectory`, `employees`, `orgChart`, `departments`, `teams`, `createDepartment`, `createTeam` | workspace members, `/api/companies/:id/{employees,org-chart}`, `/api/departments`, `/api/teams` |
| | `permissionMatrix`, `savePermissionRow` | `/api/permissions/matrix` |
| | `auditLogs`, `complianceLogs`, `legalHold`, `setLegalHold` | `/api/v2/audit/:companyId`, `/api/compliance-logs`, `/api/compliance/legal-hold/:userId` |
| Account | `twoFactorSetup`, `twoFactorEnable`, `twoFactorDisable` | `/api/auth/2fa/{setup,verify-setup,disable}` |
| | `exportMyData`, `retentionPolicy`, `setRetentionPolicy` | `/api/compliance/{export-user,retention-policy}` |
| | `devices`, `revokeDevice` | `/api/v2/devices`, `/api/v2/devices/revoke` |
| Messages | `prepareMessage`, `sendPrepared`, `readPrepared` | the normal send routes, body carries `clientMessageId` |
| | `markConversationRead(conv)` | `POST /api/chat/reset-unread` + socket `mark-chat-read` |

## What the client relies on from the server

- **Offline queue:** every message send body (queued or not) carries `clientMessageId` (equal to
  `clientTempId`). The server is expected to deduplicate on it, so a retry after a lost response
  never posts twice.
- **Quick reply on iPhone/iPad:** the app registers the notification category `oru.message`
  (actions `reply` with text input, `read`). APNs payloads must set `aps.category: "oru.message"`
  for message pushes (server/src/features/push/push.service.js) for the actions to appear.
- **Quick reply on Android:** Firebase shows background pushes itself (the `notification`
  payload), so they have no actions. While the app runs, message pushes are re-posted with the
  actions. Actions on background pushes need data-only FCM messages plus native display code.

## Gaps in the server API (shown read-only or not offered in the app)

- Task recurrence (`recurring`) can't be set through `PUT /api/v2/tasks/:id`; the app shows it.
- `sprintId` / `milestoneId` aren't writable; the sprint board moves tasks between statuses.
- Dependencies (`dependencies[]`) can be added but not removed; links (`linkedIssues`) can.
- File sharing can add or change access but not remove it; file comments can't be deleted.
- Meetings can't be edited after scheduling (only status); `suggest-time` returns one slot.
- Passkeys: the WebAuthn relying party is the web origin, so the app links to the web for them.

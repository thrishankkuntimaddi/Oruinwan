# Mobile app: work, admin and offline features (client side)

One new server endpoint (`POST /api/auth/sso/app/exchange`, see security.md). The phone/tablet app (`mobile/`) calls existing routes through
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
| Tasks (v2) | `setTaskStatus(id, status, reason, { ignoreBlockers })`, `blockersOf(err)` | `PUT /api/v2/tasks/:id`; 409 `TASK_BLOCKED` → blockers sheet, "Complete anyway" resends `ignoreBlockers: true` |
| | `taskBlockers(id)` | `GET /api/v2/tasks/:id/blockers` |
| | `setTaskPlanning(id, { sprintId, milestoneId })`, `setTaskRecurring(id, recurring)` | `PUT /api/v2/tasks/:id` (`null` removes / turns off) |
| | `removeDependency(id, depId)` | `DELETE /api/v2/tasks/:id/dependency/:depId` |
| | `taskTime(id)`, `logTime(id, { minutes, note, start })` | `GET /api/v2/tasks/:id/time`, `POST /api/v2/tasks/:id/time/log` |
| Files (v2) | `shareFile(id, permissions, { remove, access })`, `revokeFileAccess(id, userIds)` | `POST /api/v2/files/:id/share` |
| Threads | thread replies send `mentionText` | `POST /api/threads/:messageId` |
| Roadmap | `roadmap(ws, {quarter, status})`, `roadmapItem`, `createRoadmapItem`, `updateRoadmapItem`, `deleteRoadmapItem`, `reorderRoadmap` | `/api/v2/roadmap[/:id]`, `/api/v2/roadmap/reorder`; socket `roadmap:updated`, `milestone:updated` |
| Design review | `designReviews`, `designReview`, `createDesignReview`, `updateDesignReview`, `deleteDesignReview`, `decideDesignReview`, `newDesignRound` | `/api/v2/design-reviews[/:id]`, `/:id/decision`, `/:id/rounds` |
| | `addAnnotation`, `updateAnnotation`, `deleteAnnotation`, `resolveAnnotation`, `replyAnnotation` | `/api/v2/design-reviews/:id/annotations[/:aid][/resolve,/replies]` |
| | `reviewableFiles`, `uploadReviewFile`, `joinDesignReview`, `leaveDesignReview` | `GET/POST /api/v2/files`; socket `design-review:join` / `design-review:leave` |
| Calls | `uploadRecording`, `callRecording`, `deleteRecording` | `/api/v2/{meetings/:id,huddles/:huddleId}/recording` |
| | `addTranscriptSegments`, `callTranscript` | `/api/v2/{meetings/:id,huddles/:huddleId}/transcript[/segments]` |
| | `askAboutMeeting({ workspaceId, title, transcript, question })` | `POST /api/ai/chat` (transcript as `context.note`; meetings.md has no meeting-AI route) |
| Collab | `lib/collab/*` (copy of `docs/api/collab-provider.js`) | socket `collab:*` on the app socket (docs/api/collab.md) |
| Automations | `automations`, `automation`, `setAutomationActive`, `runAutomation(ws, id, { dryRun })`, `automationRuns` | `/api/v2/automations[/:id][/run,/runs]` |
| Devices | `deviceList`, `renameDevice`, `signOutDevice`, `signOutOtherDevices` | `GET /api/v2/devices`, `PATCH/DELETE /api/v2/devices/:id`, `POST /api/v2/devices/revoke-others` |
| Notifications | `accountNotificationPrefs`, `saveDigestFrequency`; `aiSuggestions` in `notificationPrefs` | `/api/auth/me/preferences/notifications`, `/api/notifications/preferences` |
| SSO | `ssoDiscover({ server, email })`, `ssoSignIn` | `GET /api/auth/sso/discover`, `POST /api/auth/sso/app/exchange` (docs/api/security.md) |

## What the client relies on from the server

- **Offline queue:** every message send body (queued or not) carries `clientMessageId` (equal to
  `clientTempId`). The server is expected to deduplicate on it, so a retry after a lost response
  never posts twice.
- **Quick reply on iPhone/iPad:** the app registers the notification category `oru.message`
  (actions `reply` with text input, `read`). The push service sets `aps.category: "oru.message"`
  (and `category` in the data) on message, DM, mention and thread-reply pushes.
- **Requests carry `X-Device-Id`** (a random id kept per install), so the phone shows under Devices.
- **Quick reply on Android:** Firebase shows background pushes itself (the `notification`
  payload), so they have no actions. While the app runs, message pushes are re-posted with the
  actions. Actions on background pushes need data-only FCM messages plus native display code.

## Gaps in the server API (shown read-only or not offered in the app)

- File comments can't be deleted from the app yet (the server allows it).
- Meetings can't be edited after scheduling (only status).
- Passkeys: the WebAuthn relying party is the web origin, so the app links to the web for them.
- Recording state has no socket event; the app announces start/stop as transcript lines
  (`[Recording started]` / `[Recording stopped]`), which everyone receives live. A
  `huddle:recording_state` relay would be cleaner.
- Building or editing automations stays on the web/desktop app (the phone lists, toggles and runs them).

## Device notes

- Live captions: Android uses `@capacitor-community/speech-recognition` (continuous restarts).
  The plugin ships only a CocoaPods podspec and the iOS app uses Capacitor 8 Swift Package Manager,
  so iOS captions rely on WKWebView's `webkitSpeechRecognition` and otherwise say they're unavailable.
- PDF design reviews draw pages with the pdf.js legacy build (loaded on first use).
- Live notes/pages: read-only offline until the first sync; after that, edits merge on reconnect
  while the app stays open (not persisted to disk).

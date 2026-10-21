# Analytics API (company insights)

Company-wide insights for owners, admins and co-owners of the caller's company
(`requireCompanyAdmin`; others get `403`). Everything is aggregate counts built
from people's sign-in activity, workspaces, channels and **tasks** only.

Privacy rule: no message counts or content, and nothing about who talks to whom.
Messages are end-to-end encrypted and are never read or counted here.

## Removed

`GET /api/dashboard/admin` and `GET /api/dashboard/workspace/:workspaceId` returned
`501 Not implemented` and had no callers; they are gone (now `404`). Admin views use
`/api/admin-dashboard/*` and the endpoints below.

## Existing (unchanged)

`GET /api/dashboard/analytics/{summary,users,workspaces,channels,tasks,engagement}?period=`
and `GET /api/analytics/insights/{productivity,workload,engagement}?period=` — see the
Insights page (`client/src/pages/dashboards/InsightsDashboard.jsx`).

## `GET /api/dashboard/analytics/teams?weeks=8` (new)

Team workload & delivery. `weeks` 1–26 (default 8). Weeks are Monday-based UTC weeks,
oldest first; the last one is the current (partial) week.

A task counts for a team when at least one assignee is a team member (a task shared by
two teams counts once for each). Tasks with no assignee in any team are in `unassigned`;
`total` counts every task once.

```json
{
  "weeks": ["2026-09-07", "…", "2026-10-19"],
  "teams": [{
    "teamId": "…", "name": "Platform", "memberCount": 5,
    "completedPerWeek": [3, 5, 2, …],          // tasks completed in each week
    "overduePerWeek":   [1, 0, 2, …],          // open past due at the end of each week (now for the current week)
    "completed": 21,
    "avgCycleHours": 30.5, "medianCycleHours": 24,   // created → completed, tasks completed in the window; null if none
    "open": 7, "openOverdue": 2                // current workload
  }],
  "unassigned": { …same fields without teamId/name/memberCount },
  "total":      { …same },
  "truncated": false                            // true if more than 20 000 tasks were read
}
```

Sorted by `completed` (most first). No per-person rows.

## `GET /api/dashboard/analytics/active-members?period=30` (new)

Members active per day and per week, counts only. `period` 1–365 days (default 30).

```json
{
  "daily":  [{ "date": "2026-10-21", "active": 12 }, …],      // one entry per day, zeros included
  "weekly": [{ "weekStart": "2026-10-19", "active": 18 }, …], // distinct members per Monday-based UTC week
  "summary": { "avgDailyActive": 10, "peakDailyActive": 15, "daysWithData": 30 }
}
```

Source: a `MemberActiveDay` record (company, member, UTC day) written at most once per
member per day when the app connects or goes idle (`presence.service` →
`analytics/activeDays.markActive`). It is only ever read back as counts and expires after
400 days. Recording starts with this release, so `daysWithData` is small at first; the web
page then falls back to the older last-activity trend.

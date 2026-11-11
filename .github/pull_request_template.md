## What changed

<!-- One or two sentences. Link the issue: Fixes #123 -->

## Why

## How I tested it

<!-- Commands you ran (server jest, client vitest, mobile npm test, e2e) and what you checked by hand. -->

## Checklist

- [ ] Tests added or updated, and they pass
- [ ] Works on web, desktop and phone, or the PR says which platforms are left
- [ ] Light and dark theme checked for UI changes
- [ ] No per-person tracking, and copy says "encrypted on the device" (never "end-to-end")
- [ ] New PostgreSQL changes are in a new numbered migration
- [ ] Connector changes: `cd server && yarn integrations:check --probe` passes

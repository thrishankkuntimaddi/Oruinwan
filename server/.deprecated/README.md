# Deprecated Legacy Code

This directory contains legacy controllers and routes that have been migrated to the new v2 modular architecture.

## ⚠️ DO NOT USE THESE FILES

These files are kept for historical reference only and should **NOT** be imported or used in any new code.

---

## 📦 Archived Files

### Controllers (Migrated to `src/features/`)

| Legacy File | New Location | Lines | Endpoints | Migrated Date |
|-------------|--------------|-------|-----------|---------------|
| `taskController.js` | `src/features/tasks/` | 1,309 | 12 | 2026-02-01 |
| `noteController.js` | `src/features/notes/` | 477 | 8 | 2026-02-01 |
| `favoriteController.js` | `src/features/favorites/` | 105 | 3 | 2026-02-01 |
| `statusController.js` | `src/features/status/` | 114 | 1 | 2026-02-01 |
| `adminController.js` | `src/features/admin/` | 82 | 2 | 2026-02-01 |
| `auditController.js` | `src/features/audit/` | 85 | 2 | 2026-02-01 |

**Total**: 2,172 lines migrated

### Routes (Migrated to `src/features/*/routes.js`)

| Legacy File | New Location | Migrated Date |
|-------------|--------------|---------------|
| `tasks.js` | `src/features/tasks/tasks.routes.js` | 2026-02-01 |
| `notes.js` | `src/features/notes/notes.routes.js` | 2026-02-01 |
| `favorites.js` | `src/features/favorites/favorites.routes.js` | 2026-02-01 |
| `statusRoutes.js` | `src/features/status/status.routes.js` | 2026-02-01 |
| `audit.js` | `src/features/audit/audit.routes.js` | 2026-02-01 |

---

## 🗑️ Deleted Dead Code

The following files were **deleted** (not archived) because they were never referenced anywhere in the codebase:

| File | Lines | Reason |
|------|-------|--------|
| `favoritesController.js` | 69 | Never imported or used |
| `workspacePermissionsController.js` | 48 | Never imported or used |

**Total dead code removed**: 117 lines

---

## 🔄 Migration Details

### V1 → V2 Endpoint Mapping

| V1 Endpoint | V2 Endpoint | Status |
|-------------|-------------|--------|
| `/api/tasks` | `/api/v2/tasks` | ✅ Migrated |
| `/api/notes` | `/api/v2/notes` | ✅ Migrated |
| `/api/favorites` | `/api/v2/favorites` | ✅ Migrated |
| `/api/status` | `/api/v2/status/health` | ✅ Migrated |
| `/api/admin/analytics/stats` | `/api/v2/admin/analytics/stats` | ✅ Migrated |
| `/api/admin/departments` | `/api/v2/admin/departments` | ✅ Migrated |
| `/api/audit/:companyId` | `/api/v2/audit/:companyId` | ✅ Migrated |
| `/api/audit/:companyId/export` | `/api/v2/audit/:companyId/export` | ✅ Migrated |

### Architecture Improvements

The new v2 architecture provides:

- ✅ **Clean Separation**: Service → Controller → Routes
- ✅ **Input Validation**: Dedicated validator layers
- ✅ **Permission Abstraction**: Policy layers
- ✅ **Better Testing**: Pure service functions
- ✅ **Comprehensive Docs**: Full JSDoc coverage
- ✅ **Zero Legacy Coupling**: No imports from old code

---

## 📅 Deletion Timeline

**IMPORTANT**: These files should be **permanently deleted** after the following milestones are reached:

### Phase 1: Dual-Run (Current - Week 1)
- ✅ V2 routes active and tested
- ✅ Server runs without v1 routes
- ⏳ Client still using v1 endpoints

### Phase 2: Client Migration (Week 2-3)
- ⏳ Frontend updated to use v2 endpoints
- ⏳ Monitor v1 traffic (should approach zero)
- ⏳ Address any edge cases

### Phase 3: Zero V1 Traffic (Week 4)
- ⏳ Confirm zero v1 traffic for 7 consecutive days
- ⏳ No production incidents related to migration
- ⏳ All clients confirmed using v2

### Phase 4: Permanent Deletion (Week 5+)
- ⏳ Delete entire `.deprecated/` directory
- ⏳ Remove v1 route comments from `server.js`
- ⏳ Update documentation to remove v1 references

**Target deletion date**: ~2026-03-01 (30 days after migration)

---

## 🚨 If You Need to Rollback

In case of critical issues with v2, you can temporarily restore v1 by:

1. **Uncomment v1 routes** in `server.js`:
   ```javascript
   app.use("/api/tasks", require("./.deprecated/routes/tasks"));
   app.use("/api/notes", require("./.deprecated/routes/notes"));
   // etc.
   ```

2. **Restart the server**

3. **Investigate v2 issues** while v1 handles production traffic

4. **Fix v2 issues** and switch back as soon as possible

**NOTE**: This should be a temporary emergency measure only. Do not leave v1 routes active long-term.

---

## 📊 Code Metrics

### Before Migration
- **Total legacy code**: 2,172 lines (controllers only)
- **Scattered business logic**: Mixed with HTTP concerns
- **No input validation**: Edge cases caused bugs
- **Hard to test**: Coupled to Express req/res
- **Poor documentation**: Minimal comments

### After Migration
- **Total v2 code**: 4,932 lines (more comprehensive)
- **Clean architecture**: Service/Controller/Routes separation
- **Input validation**: All endpoints validated
- **Easy to test**: Pure service functions
- **Full documentation**: JSDoc on all methods
- **Code expansion**: 2.27x (quality over quantity)

---

## 🎓 Lessons Learned

### What Worked Well
1. **Forensic analysis first** - Understanding legacy before coding
2. **Phased approach** - Service → Policy → Controller → Routes
3. **Behavior preservation** - Exact replication, no redesign
4. **Immediate testing** - Caught issues early
5. **Clean commits** - Easy to track progress

### What Could Improve
1. **Write tests sooner** - Don't defer to "later"
2. **Dead code detection** - Should have caught earlier
3. **Route conflict checking** - Automated tooling needed

---

*Archived: 2026-02-01*  
*Migration complete: 6 features, 28 endpoints*  
*Safe to delete after: 2026-03-01*

# Production Deployment Guide

## Quick Setup

### 1. Set Vercel Environment Variable

**CRITICAL**: This must be done before the frontend can work in production.

1. Go to https://vercel.com/dashboard
2. Select your **Chttrix** project
3. Navigate to **Settings** → **Environment Variables**
4. Click **Add New**
5. Enter:
   - **Name**: `REACT_APP_BACKEND_URL`
   - **Value**: `https://chttrix-api-dcj2qvm4xa-uc.a.run.app`
   - **Environments**: Check all three (Production, Preview, Development)
6. Click **Save**

### 2. Trigger Redeploy

After adding the environment variable, you **must** redeploy:

**Option A - From Vercel Dashboard**:
- Go to **Deployments** tab
- Click the **⋯** menu on the latest deployment
- Select **Redeploy**
- ✅ Mark "Use existing Build Cache" (faster)

**Option B - From Terminal**:
```bash
git commit --allow-empty -m "chore: trigger redeploy with env vars"
git push origin main
```

### 3. Wait for Build

- Build takes ~2-3 minutes
- Watch progress at https://vercel.com/dashboard
- Wait until status shows "Ready"

---

## Fix Messaging Issues

If you see `403 KEY_NOT_DISTRIBUTED` errors after deployment:

### Option 1: Automated Repair (Recommended)

Run the repair script to fix key distribution:

```bash
# Get your access token from browser DevTools:
# Application → Local Storage → accessToken

# Run repair script
cd /Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab
ACCESS_TOKEN=your_token_here node scripts/repair-conversation-keys.js
```

### Option 2: Manual API Call

```bash
curl -X POST https://chttrix-api-dcj2qvm4xa-uc.a.run.app/api/v2/conversations/repair-access \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

### Option 3: Fresh Start

If repair doesn't work, recreate channels:

```bash
# Nuke database (preserves admin)
cd server
node scripts/nukeDbPreserveAdmin.js

# Then login to https://chttrix.vercel.app and:
# 1. Create workspace
# 2. Create channels
# 3. Test messaging
```

---

## Verification Checklist

After deployment, verify everything works:

### ✅ Environment Variables
- [ ] `REACT_APP_BACKEND_URL` set in Vercel
- [ ] Vercel deployment completed successfully
- [ ] No build errors

### ✅ API Connectivity
Open browser DevTools Network tab:
- [ ] All `/api/*` requests go to `https://chttrix-api-dcj2qvm4xa-uc.a.run.app`
- [ ] No requests to `https://chttrix.vercel.app/api/*`
- [ ] No `<!doctype` HTML parsing errors

### ✅ Messaging System
- [ ] Can send messages in channels
- [ ] Can send DMs
- [ ] No "Message encryption failed" errors
- [ ] Console shows: `✅ [PHASE 1] Identity keys ready`

### ✅ Invite System
- [ ] "Invite People" modal opens
- [ ] Pending invites load (no errors)
- [ ] Can generate invite links
- [ ] Can send email invites

### ✅ Channels
- [ ] Channel list loads in sidebar
- [ ] Can create new channels
- [ ] Can join channels
- [ ] Channel messages load

---

## Troubleshooting

### Environment variable not working?

1. **Check it was saved**:
   - Vercel Dashboard → Settings → Environment Variables
   - Should show `REACT_APP_BACKEND_URL`

2. **Force rebuild**:
   ```bash
   # Delete .vercel cache
   rm -rf .vercel
   # Push again
   git commit --allow-empty -m "chore: force rebuild"
   git push
   ```

3. **Verify build logs**:
   - Vercel Dashboard → Deployments → Click latest
   - Check "Building" logs for environment variable injection

### Still getting 403 errors?

The conversation key wasn't distributed properly. Solutions:

1. **Run repair script** (see above)
2. **Check backend logs** for channel creation errors
3. **Recreate the channel** (delete and create new)

### Messages still not sending?

1. **Clear browser cache**: Hard refresh (Cmd+Shift+R)
2. **Check identity keys**: Console should show "Identity keys ready"
3. **Re-login**: Logout and login again
4. **Check backend**: `curl https://chttrix-api-dcj2qvm4xa-uc.a.run.app/api/health`

---

## Production URLs

- **Frontend**: https://chttrix.vercel.app
- **Backend**: https://chttrix-api-dcj2qvm4xa-uc.a.run.app
- **Health Check**: https://chttrix-api-dcj2qvm4xa-uc.a.run.app/api/health

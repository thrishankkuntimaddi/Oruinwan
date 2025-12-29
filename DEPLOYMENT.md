# Chttrix Production Deployment Guide

This guide will walk you through deploying the Chttrix collaboration platform to production using modern cloud platforms.

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup (MongoDB Atlas)](#database-setup-mongodb-atlas)
4. [Backend Deployment (Railway)](#backend-deployment-railway)
5. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
6. [Post-Deployment Configuration](#post-deployment-configuration)
7. [Security Hardening](#security-hardening)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Code Preparation ✅

- [x] **Console.log statements removed** - 132+ debug logs removed from backend, frontend auto-stripped in production build
- [x] **Production logger implemented** - `server/utils/logger.js` respects NODE_ENV
- [x] **Environment-based configuration** - Rate limiting, CORS, and security settings adapt to NODE_ENV
- [x] **Secure JWT secrets generated** - 128-character random secrets ready for production

### What You Need

- [ ] **MongoDB Atlas account** (free tier available)
- [ ] **Railway account** (for backend hosting)
- [ ] **Vercel account** (for frontend hosting)
- [ ] **Custom domain** (optional but recommended)
- [ ] **Gmail with App Password** (for email invitations - optional)

---

## Environment Configuration

### Backend Environment Variables

Copy `server/.env.production.template` to `server/.env` and configure:

```bash
# Production environment
NODE_ENV=production
PORT=5000

# MongoDB Atlas connection string
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/chttrix?retryWrites=true&w=majority

# Secure JWT secrets (already generated - DO NOT CHANGE)
ACCESS_TOKEN_SECRET=fb6e9ddfc68572d7fc5f45ffe6a0549c29a53e66d02b14a23806eeb4932aa2420155dbb7395a649f7e0dde06e5c876fd8b75f6655a1f6f67fa0befec97877c64
REFRESH_TOKEN_SECRET=d4d2c38b0f8e6583cd13dfd4d787a406485533b16037454b086a5a156b1d3f79d0c67b0c3a25b7fdf73c30d5aa1c22271f23499595d244483a96ec019e794315

# Frontend URL (update after Vercel deployment)
FRONTEND_URL=https://your-app.vercel.app

# Email configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=Chttrix <noreply@yourdomain.com>

# File uploads
MAX_FILE_SIZE=52428800
```

### Frontend Environment Variables

Copy `client/.env.production.template` to `client/.env.production`:

```bash
# Backend API URL (update after Railway deployment)
REACT_APP_BACKEND_URL=https://your-backend.railway.app
```

---

## Database Setup (MongoDB Atlas)

### Step 1: Create MongoDB Atlas Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up or log in
3. Click **"Build a Database"**
4. Choose **FREE** (M0 Sandbox) tier
5. Select your preferred **Cloud Provider** and **Region**
6. Name your cluster (e.g., `chttrix-cluster`)
7. Click **"Create Cluster"**

### Step 2: Create Database User

1. Go to **Database Access** → **Add New Database User**
2. Choose **Password** authentication
3. Create username and strong password (save these!)
4. Set privileges to **"Read and write to any database"**
5. Click **"Add User"**

### Step 3: Configure Network Access

1. Go to **Network Access** → **Add IP Address**
2. Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - ⚠️ For production, restrict to your backend server's IP
3. Click **"Confirm"**

### Step 4: Get Connection String

1. Go to **Database** → Click **"Connect"** on your cluster
2. Choose **"Connect your application"**
3. Copy the connection string (looks like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<username>` and `<password>` with your database user credentials
5. Add `/chttrix` before `?retryWrites` to specify database name:
   ```
   mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/chttrix?retryWrites=true&w=majority
   ```
6. Add this to your `server/.env` as `MONGO_URI`

---

## Backend Deployment (Railway)

### Option 1: Deploy via GitHub

1. Go to [Railway.app](https://railway.app/) and sign in
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your Chttrix repository
4. Railway will auto-detect the server directory
5. Set **Root Directory** to `server`
6. Go to **Variables** tab and add all environment variables from `server/.env.production.template`
7. Click **"Deploy"**
8. Railway will provide a URL like `https://your-backend.railway.app`

### Option 2: Deploy via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd server
railway init

# Link to your project
railway link

# Add environment variables
railway variables set NODE_ENV=production
railway variables set PORT=5000
railway variables set MONGO_URI="your-mongodb-uri"
railway variables set ACCESS_TOKEN_SECRET="your-access-token-secret"
railway variables set REFRESH_TOKEN_SECRET="your-refresh-token-secret"
# ... add all other variables

# Deploy
railway up
```

### Configure Production Settings

After deployment, get your backend URL and update:
1. **Frontend .env**: Set `REACT_APP_BACKEND_URL` to your Railway URL
2. **Backend .env on Railway**: Update `FRONTEND_URL` environment variable

---

## Frontend Deployment (Vercel)

### Option 1: Deploy via Vercel Dashboard

1. Go to [Vercel.com](https://vercel.com/) and sign in
2. Click **"Add New Project"**
3. Import your Chttrix repository from GitHub
4. Configure the project:
   - **Root Directory**: `client`
   - **Framework Preset**: Create React App
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
5. Add environment variables:
   - `REACT_APP_BACKEND_URL`: Your Railway backend URL
6. Click **"Deploy"**
7. Vercel will provide a URL like `https://your-app.vercel.app`

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy from client directory
cd client
vercel

# Follow prompts:
# - Setup and deploy: Yes
# - Which scope: Your account
# - Link to existing project: No
# - Project name: chttrix
# - Directory: ./
# - Override settings: No

# Set production environment variables
vercel env add REACT_APP_BACKEND_URL production
# Enter your Railway backend URL when prompted

# Deploy to production
vercel --prod
```

---

## Post-Deployment Configuration

### 1. Update Environment Variables

Now that both backend and frontend are deployed, update the cross-references:

**On Railway (Backend)**:
- Update `FRONTEND_URL` to your Vercel URL

**On Vercel (Frontend)**:
- Confirm `REACT_APP_BACKEND_URL` points to Railway URL

### 2. Redeploy if Needed

- **Railway**: Redeployments happen automatically on env var changes
- **Vercel**: May need to trigger a new deployment via dashboard

### 3. Test Critical Flows

- [ ] User registration
- [ ] User login
- [ ] Workspace creation
- [ ] Channel creation and messaging
- [ ] Direct messages
- [ ] Real-time updates (Socket.io)
- [ ] Task management
- [ ] Notes creation
- [ ] Universal search
- [ ] Workspace invitations

### 4. Configure Custom Domain (Optional)

**For Vercel (Frontend)**:
1. Go to your project → Settings → Domains
2. Add your custom domain (e.g., `app.yourdomain.com`)
3. Configure DNS records as instructed

**For Railway (Backend)**:
1. Go to your service → Settings → Networking
2. Click "Generate Domain" or add custom domain
3. Update CORS settings if using custom domain

---

## Security Hardening

### Production Security Features ✅

Your deployment now includes:

1. **Environment-based rate limiting**
   - Development: 100 requests/minute
   - Production: 20 requests/minute on auth endpoints

2. **CORS Configuration**
   - Only allows your frontend domain
   - Blocks localhost in production

3. **Secure JWT tokens**
   - 128-character random secrets
   - Separate access and refresh tokens

4. **Helmet.js security headers**
   - XSS protection
   - Content security policy
   - Other security headers

### Additional Recommendations

1. **Enable HTTPS Only**
   - Both Railway and Vercel provide SSL by default
   - Never allow HTTP in production

2. **Set up monitoring**
   - Use Railway logs for backend
   - Use Vercel Analytics for frontend
   - Consider Sentry for error tracking

3. **Database Security**
   - Use strong passwords
   - Restrict IP access in MongoDB Atlas
   - Enable encryption at rest

4. **Secrets Management**
   - Never commit `.env` files to Git
   - Use Railway/Vercel environment variables
   - Rotate JWT secrets periodically

5. **Backup Strategy**
   - Enable MongoDB Atlas automated backups
   - Export data regularly

---

## Troubleshooting

### Common Issues

#### Backend won't start on Railway
- **Check logs**: Railway Dashboard → Deployments → View Logs
- **Verify environment variables**: All required vars set?
- **Port configuration**: Railway uses `PORT` env var, should be 5000

#### Frontend can't connect to backend
- **CORS error**: Check `FRONTEND_URL` in backend env matches your Vercel URL
- **Wrong API URL**: Verify `REACT_APP_BACKEND_URL` in Vercel
- **Mixed content**: Ensure both frontend and backend use HTTPS

#### MongoDB connection fails
- **Connection string**: Verify username, password, and database name
- **Network access**: Check MongoDB Atlas network settings allow Railway IP
- **Timeout**: Atlas may take a few minutes after creating cluster

#### Socket.io not connecting
- **WebSocket support**: Railway and Vercel both support WebSockets
- **CORS for Socket.io**: Verify `FRONTEND_URL` env var is set correctly
- **Token authentication**: Check JWT secrets match between frontend and backend

#### Rate limiting too aggressive
- **Adjust limits**: Modify `server/server.js` line 51 (currently 20 req/min)
- **Skip endpoints**: Add paths to skip array if needed
- **Monitor logs**: Check if legitimate users are being rate-limited

### Debugging Tips

**Backend Logs (Railway)**:
```bash
railway logs
```

**Frontend Build Logs (Vercel)**:
```bash
vercel logs <deployment-url>
```

**Test API Connection**:
```bash
curl https://your-backend.railway.app/api/auth/health
```

---

## Architecture Diagram

```
┌─────────────────┐
│   Cloudflare    │  ← CDN + SSL + DDoS Protection (Optional)
│   (Optional)    │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼───┐  ┌───▼────┐
│Vercel │  │Railway │
│React  │  │Node.js │
│Client │  │Express │
│       │  │Socket  │
└───────┘  └───┬────┘
               │
          ┌────▼─────┐
          │ MongoDB  │
          │  Atlas   │
          └──────────┘
```

---

## Support & Resources

- **Chttrix Repo**: Your GitHub repository
- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com

---

## Quick Reference

### Production URLs (Update these!)
- **Frontend**: https://your-app.vercel.app
- **Backend**: https://your-backend.railway.app
- **Database**: MongoDB Atlas Cluster

### Environment Files
- Backend: `server/.env.production.template` → `server/.env`
- Frontend: `client/.env.production.template` → `client/.env.production`

### Security Settings
- **Rate Limit**: 20 req/min (auth endpoints)
- **JWT Expiry**: Configured in backend
- **CORS**: Restricted to production frontend URL
- **Console Logs**: Stripped in production builds

---

**Congratulations! 🎉** Your Chttrix platform is now production-ready!

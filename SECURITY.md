# 🔒 Environment Variables Security Guide

## Overview
This project uses environment variables to store sensitive configuration data. These files are protected from being committed to Git.

## Protected Files
The following files are **automatically ignored** by Git and will never be committed:
- `.env`
- `.env.local`
- `.env.development`
- `.env.test`
- `.env.production`
- `.env.staging`
- Any `.env` file in subdirectories

## Setup Instructions

### For New Developers
1. Copy the example environment file:
   ```bash
   cp server/.env.example server/.env
   ```

2. Edit `server/.env` with your actual credentials:
   ```bash
   nano server/.env
   # or use your preferred editor
   ```

3. **Never commit** the actual `.env` file to Git!

### What to Store in .env
- Database credentials
- API keys and secrets
- JWT secrets
- Email service credentials
- Third-party service tokens
- Any sensitive configuration data

### What NOT to Store in .env
- Public configuration (use config files instead)
- Non-sensitive settings
- Default values that are safe to share

## Security Best Practices

### ✅ DO:
- Keep `.env` files local only
- Use strong, unique secrets for production
- Rotate secrets regularly
- Use different `.env` files for different environments
- Share `.env.example` as a template
- Document required environment variables in `.env.example`

### ❌ DON'T:
- Commit `.env` files to Git
- Share `.env` files via email or chat
- Use the same secrets across environments
- Hardcode secrets in your code
- Leave default/weak secrets in production

## Verification

### Check if .env is protected:
```bash
git status
```
Your `.env` file should **NOT** appear in the list of changes.

### Check if .env is tracked:
```bash
git ls-files | grep .env
```
Should only show `.env.example`, not `.env`

### View what's ignored:
```bash
git check-ignore -v server/.env
```
Should show that it's ignored by `.gitignore`

## Emergency: If .env Was Committed

If you accidentally committed a `.env` file:

1. **Remove from Git** (keeps local file):
   ```bash
   git rm --cached server/.env
   git commit -m "Remove .env from version control"
   ```

2. **Rotate all secrets immediately** - assume they are compromised

3. **Clean Git history** (if secrets were pushed):
   ```bash
   # Use git-filter-repo or BFG Repo-Cleaner
   # This is complex - consider creating a new repo if needed
   ```

4. **Update all team members** about the security incident

## Environment Variables Template

The `server/.env.example` file contains a template of all required environment variables. Keep this file updated when adding new environment variables to your application.

## Additional Security Measures

### For Production:
- Use a secrets management service (AWS Secrets Manager, HashiCorp Vault, etc.)
- Enable environment variable encryption
- Implement secret rotation policies
- Use least-privilege access principles
- Monitor for unauthorized access

### For Development:
- Never use production credentials locally
- Use separate development databases
- Consider using Docker secrets for containerized apps

## Questions?
If you're unsure whether something should go in `.env`, ask yourself:
- "Would it be a security risk if this became public?" → Yes = `.env`
- "Is this different for each developer/environment?" → Yes = `.env`

---
**Remember:** When in doubt, keep it secret! 🔐

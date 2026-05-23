# 🚀 Deployment Setup Guide

This monorepo contains 5 Vercel projects that deploy automatically via GitHub Actions.

## Quick Start (5 minutes)

### 1. Install GitHub CLI
```bash
# macOS
brew install gh

# Linux
sudo apt install gh

# Or download from https://cli.github.com
```

### 2. Authenticate with GitHub
```bash
gh auth login
# Follow prompts, choose HTTPS, generate new token
```

### 3. Run Setup Script
```bash
chmod +x scripts/setup-gh-secrets.sh
./scripts/setup-gh-secrets.sh
```

The script will prompt you for:
- **VERCEL_TOKEN** - Get from https://vercel.com/account/tokens
- **VERCEL_ORG_ID** - From your Vercel dashboard URL (vercel.com/_os-projects-664da775/)
- **SUPABASE_URL** - Your Supabase project URL
- **SUPABASE_ANON_KEY** - From Supabase dashboard
- **SUPABASE_SERVICE_KEY** - From Supabase dashboard (server-only)

That's it! 🎉

## Manual Setup (if script doesn't work)

Go to: **GitHub Settings > Secrets and variables > Actions**

Add these secrets:

### Common Secrets
```
VERCEL_TOKEN = <your-token>
VERCEL_ORG_ID = <your-org-id>
NEXT_PUBLIC_SUPABASE_URL = <your-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <your-anon-key>
SUPABASE_SERVICE_ROLE_KEY = <your-service-key>
```

### Project IDs
```
VERCEL_ORLANDO_CORE_OS_PROJECT_ID = prj_PAV5DZeMuMBAgQ0zuVo1wsLViVy6
VERCEL_VASTGOED_CORE_FRONT_PROJECT_ID = prj_70Sa0OSAPDET0Esc6Jin65WP40kz
VERCEL_VASTGOEDSCANLER_SAAS_PROJECT_ID = prj_1t5Vto7JlNby4tH6KddktUam0ZfRV
VERCEL_STERKBOUW_SAAS_FRONT_PROJECT_ID = prj_15dPJdgoFUDZsKDNShspbBerFCky
VERCEL_STERKBOUW_CALC_PROJECT_ID = prj_VeM5TFIoCS0rJISm10ngEwriouF1F
```

## How It Works

### 🔄 Workflow Trigger
- **On every push** → Builds all projects
- **On PRs** → Runs build validation only
- **main branch** → Production deployment to Vercel
- **develop branch** → Preview deployment
- **claude/* branches** → Preview deployment

### 📊 Build Matrix
All 5 projects build in parallel:
1. `orlando-core-os` - YouTube operations dashboard
2. `vastgoed-core-front` - Real estate frontend
3. `vastgoedscanler-saas` - Scanner SaaS
4. `sterkbouw-saas-front` - Construction SaaS frontend
5. `sterkbouw-calc` - Calculation tool

### ✅ Deployment Logic
- Build fails → **Deployment blocked** 🛑
- Build succeeds → **Auto-deploy to Vercel** 🚀
- Each project deploys to **its own Vercel project**
- Environment variables are passed securely

## 🔍 Monitoring Deployments

### GitHub Actions
1. Go to **Actions** tab in GitHub
2. Watch the `Deploy to Vercel (Monorepo)` workflow
3. See real-time build logs and deployment status

### Vercel Dashboard
1. Visit each project in Vercel
2. See deployment history
3. View production vs preview URLs

## 🐛 Troubleshooting

### Build fails: "Module not found"
- Check that dependencies are installed
- Verify working directory in workflow
- Check for missing environment variables

### Deployment fails: "Project not found"
- Verify Project IDs in secrets match Vercel
- Check `VERCEL_ORG_ID` is correct
- Ensure `VERCEL_TOKEN` has correct permissions

### "Not authenticated"
- Run `gh auth login`
- Generate new GitHub token with `repo:write` scope

## 📝 Environment Variables

Each project can have **different environment variables**. Add them to:
- **GitHub Secrets** (for CI/CD) - shown above
- **Vercel Project Settings** (for runtime) - for production-only vars

## 🔐 Security Notes

- ✅ Secrets are encrypted in GitHub
- ✅ Secrets only visible to Actions
- ✅ Secrets not logged in build output
- ✅ Service role key never sent to browser
- ❌ Never commit `.env` files
- ❌ Never print secrets in workflow logs

## 📚 Useful Commands

```bash
# See all configured secrets
gh secret list

# Delete a secret
gh secret delete VERCEL_TOKEN

# Update a secret
gh secret set VERCEL_TOKEN --body "new-token"

# View workflow runs
gh run list

# View specific run
gh run view <run-id>

# View run logs
gh run view <run-id> --log
```

## 🚀 Next Steps

1. ✅ Run the setup script
2. ✅ Push your branch to trigger first deployment
3. ✅ Check GitHub Actions for build status
4. ✅ Verify deployments on Vercel
5. ✅ Share feedback!

---

For issues, check:
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Setup](https://supabase.com/docs/guides/getting-started)

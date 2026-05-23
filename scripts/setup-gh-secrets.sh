#!/bin/bash

# GitHub Secrets Setup Script for Orlando's Projects Monorepo
# This script sets up all required GitHub secrets for Vercel deployment

set -e

echo "🔐 GitHub Secrets Setup for Orlando's Projects"
echo "=============================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "Install from: https://cli.github.com"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub"
    echo "Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI authenticated"
echo ""

# Common secrets
echo "📝 Setting common secrets..."
echo ""

read -p "Enter VERCEL_TOKEN (from https://vercel.com/account/tokens): " VERCEL_TOKEN
gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN"
echo "✅ VERCEL_TOKEN set"

read -p "Enter VERCEL_ORG_ID (from Vercel dashboard URL): " VERCEL_ORG_ID
gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID"
echo "✅ VERCEL_ORG_ID set"

read -p "Enter NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "$SUPABASE_URL"
echo "✅ NEXT_PUBLIC_SUPABASE_URL set"

read -p "Enter NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "$SUPABASE_ANON_KEY"
echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY set"

read -p "Enter SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_KEY
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "$SUPABASE_SERVICE_KEY"
echo "✅ SUPABASE_SERVICE_ROLE_KEY set"

echo ""
echo "📦 Setting project-specific secrets..."
echo ""

# Project-specific secrets
declare -A projects=(
    ["orlando-core-os"]="prj_PAV5DZeMuMBAgQ0zuVo1wsLViVy6"
    ["vastgoed-core-front"]="prj_70Sa0OSAPDET0Esc6Jin65WP40kz"
    ["vastgoedscanler-saas"]="prj_1t5Vto7JlNby4tH6KddktUam0ZfRV"
    ["sterkbouw-saas-front"]="prj_15dPJdgoFUDZsKDNShspbBerFCky"
    ["sterkbouw-calc"]="prj_VeM5TFIoCS0rJISm10ngEwriouF1F"
)

for project in "${!projects[@]}"; do
    secret_name="VERCEL_$(echo ${project^^} | tr '-' '_')_PROJECT_ID"
    project_id="${projects[$project]}"
    gh secret set "$secret_name" --body "$project_id"
    echo "✅ $secret_name set"
done

echo ""
echo "🎉 All secrets configured successfully!"
echo ""
echo "Next steps:"
echo "1. Push your branch to trigger the workflow"
echo "2. Check GitHub Actions for build status"
echo "3. Verify deployments on Vercel dashboard"

#!/bin/bash
# Run once after: npm i -g vercel && vercel login
# Usage: bash scripts/setup-vercel.sh
set -e

FRONTEND="$(dirname "$0")/../frontend"
cd "$FRONTEND"

echo "==> Linking Vercel project (follow prompts — choose existing project or create new)"
vercel link

echo ""
echo "==> Adding environment variables..."

# ── Supabase ──────────────────────────────────────────────────────────────────
vercel env add SUPABASE_URL production <<< "https://yqjxcqpgapzbqeizjqns.supabase.co"
vercel env add SUPABASE_URL preview    <<< "https://yqjxcqpgapzbqeizjqns.supabase.co"
vercel env add SUPABASE_URL development <<< "https://yqjxcqpgapzbqeizjqns.supabase.co"

echo ""
echo "Enter your Supabase SERVICE ROLE key (Settings → API → service_role):"
read -rs SUPA_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY production    <<< "$SUPA_KEY"
vercel env add SUPABASE_SERVICE_ROLE_KEY preview       <<< "$SUPA_KEY"
vercel env add SUPABASE_SERVICE_ROLE_KEY development   <<< "$SUPA_KEY"

# ── JWT secrets ───────────────────────────────────────────────────────────────
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH=$(openssl rand -hex 32)

vercel env add JWT_SECRET production    <<< "$JWT_SECRET"
vercel env add JWT_SECRET preview       <<< "$JWT_SECRET"
vercel env add JWT_SECRET development   <<< "$JWT_SECRET"

vercel env add JWT_REFRESH_SECRET production    <<< "$JWT_REFRESH"
vercel env add JWT_REFRESH_SECRET preview       <<< "$JWT_REFRESH"
vercel env add JWT_REFRESH_SECRET development   <<< "$JWT_REFRESH"

echo ""
echo "==> All environment variables set."
echo ""
echo "JWT_SECRET        : $JWT_SECRET"
echo "JWT_REFRESH_SECRET: $JWT_REFRESH"
echo ""
echo "IMPORTANT: Save these JWT secrets — you need them if you ever re-deploy"
echo "to a different Vercel project (existing sessions will be invalidated)."
echo ""
echo "==> Triggering deployment..."
vercel --prod
echo ""
echo "Done. NEDB is live."

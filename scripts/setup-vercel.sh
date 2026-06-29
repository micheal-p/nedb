#!/bin/bash
# Run once after: npm i -g vercel && vercel login
# Usage: bash scripts/setup-vercel.sh
set -e

PROJECT_NAME="nedb"
SUPABASE_URL="https://yqjxcqpgapzbqeizjqns.supabase.co"
FRONTEND="$(dirname "$0")/../frontend"

cd "$FRONTEND"

echo "==> Creating / linking Vercel project as \"$PROJECT_NAME\"..."
vercel link --project "$PROJECT_NAME" --yes 2>/dev/null || \
  vercel link --yes

echo ""
echo "==> Adding environment variables..."

# ── Supabase URL (not secret) ──────────────────────────────────────────────
for env in production preview development; do
  vercel env rm SUPABASE_URL "$env" --yes 2>/dev/null || true
  echo "$SUPABASE_URL" | vercel env add SUPABASE_URL "$env"
done

# ── Supabase service role key (secret) ────────────────────────────────────
echo ""
echo "Paste your Supabase SERVICE ROLE key then press Enter"
echo "(supabase.com → project → Settings → API → service_role):"
read -rs SUPA_KEY
echo ""
for env in production preview development; do
  vercel env rm SUPABASE_SERVICE_ROLE_KEY "$env" --yes 2>/dev/null || true
  echo "$SUPA_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY "$env"
done

# ── JWT secrets (auto-generated) ──────────────────────────────────────────
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH=$(openssl rand -hex 32)

for env in production preview development; do
  vercel env rm JWT_SECRET "$env" --yes 2>/dev/null || true
  echo "$JWT_SECRET" | vercel env add JWT_SECRET "$env"

  vercel env rm JWT_REFRESH_SECRET "$env" --yes 2>/dev/null || true
  echo "$JWT_REFRESH" | vercel env add JWT_REFRESH_SECRET "$env"
done

echo ""
echo "==> Environment variables set."
echo ""
echo "   JWT_SECRET        : $JWT_SECRET"
echo "   JWT_REFRESH_SECRET: $JWT_REFRESH"
echo ""
echo "   Save these — existing sessions break if they change."
echo ""
echo "==> Deploying to production..."
vercel deploy --prod --name "$PROJECT_NAME" --yes

echo ""
echo "====================================================="
echo " NEDB is live at: https://$PROJECT_NAME.vercel.app"
echo "====================================================="
echo " Admin login:  admin / nedb2026"
echo " Change password at: /data-point/admin"
echo "====================================================="

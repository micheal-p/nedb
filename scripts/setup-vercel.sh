#!/bin/bash
# Run once: npm i -g vercel && vercel login && bash scripts/setup-vercel.sh
set -e

PROJECT_NAME="nedb"
SUPABASE_URL="https://yqjxcqpgapzbqeizjqns.supabase.co"
FRONTEND="$(dirname "$0")/../frontend"

cd "$FRONTEND"

# Read service role key from .env.local so it never touches git
SUPA_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2-)
if [[ -z "$SUPA_KEY" || "$SUPA_KEY" == "your-service-role-key" ]]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY not set in frontend/.env.local"
  exit 1
fi

# Generate JWT secrets
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH=$(openssl rand -hex 32)

echo "==> Linking project as \"$PROJECT_NAME\"..."
vercel link --project "$PROJECT_NAME" --yes 2>/dev/null || vercel link --yes

echo ""
echo "==> Setting environment variables..."

set_env() {
  local KEY=$1 VAL=$2
  for env in production preview development; do
    vercel env rm "$KEY" "$env" --yes 2>/dev/null || true
    printf '%s' "$VAL" | vercel env add "$KEY" "$env"
  done
}

set_env SUPABASE_URL              "$SUPABASE_URL"
set_env SUPABASE_SERVICE_ROLE_KEY "$SUPA_KEY"
set_env JWT_SECRET                "$JWT_SECRET"
set_env JWT_REFRESH_SECRET        "$JWT_REFRESH"

echo ""
echo "==> Deploying to production..."
vercel deploy --prod --yes

echo ""
echo "=================================================="
echo " Live at: https://$PROJECT_NAME.vercel.app"
echo "=================================================="
echo " Admin:   admin / nedb2026"
echo " Change password immediately at /data-point/admin"
echo "=================================================="
echo ""
echo " JWT_SECRET        : $JWT_SECRET"
echo " JWT_REFRESH_SECRET: $JWT_REFRESH"
echo " (save these — changing them logs everyone out)"
echo "=================================================="

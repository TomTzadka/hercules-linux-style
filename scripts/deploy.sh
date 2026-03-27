#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  deploy.sh — Commit, push to git, and deploy to Vercel.
#
#  Usage:
#    ./scripts/deploy.sh                    # prompts for commit message
#    ./scripts/deploy.sh "my commit msg"    # uses given message
#    ./scripts/deploy.sh --no-vercel        # git push only, skip Vercel
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*" >&2; }
step()  { echo -e "${CYAN}[deploy]${NC} $*"; }

# ── Parse flags ───────────────────────────────────────────────
SKIP_VERCEL=false
COMMIT_MSG=""

for arg in "$@"; do
  case "$arg" in
    --no-vercel) SKIP_VERCEL=true ;;
    *)           COMMIT_MSG="$arg" ;;
  esac
done

# ── Load .env for Vercel credentials ─────────────────────────
if [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
fi

# ── Commit message ────────────────────────────────────────────
if [ -z "$COMMIT_MSG" ]; then
  echo -n "Commit message: "
  read -r COMMIT_MSG
fi
if [ -z "$COMMIT_MSG" ]; then
  error "Commit message cannot be empty"
  exit 1
fi

# ── Git status check ──────────────────────────────────────────
if [ -z "$(git status --porcelain)" ]; then
  warn "Nothing to commit — working tree is clean"
else
  step "Staging all changes..."
  git add -A

  step "Committing: \"$COMMIT_MSG\""
  git commit -m "$COMMIT_MSG"
fi

# ── Git push ──────────────────────────────────────────────────
step "Pushing to origin/main..."
git push
info "Git push complete ✓"

# ── Vercel deploy ─────────────────────────────────────────────
if [ "$SKIP_VERCEL" = true ]; then
  warn "Skipping Vercel deploy (--no-vercel)"
  exit 0
fi

if [ -z "${VERCEL_TOKEN:-}" ]; then
  warn "VERCEL_TOKEN not set in .env — skipping Vercel deploy"
  warn "Vercel will auto-deploy from the git push if connected."
  exit 0
fi

if ! command -v vercel >/dev/null 2>&1; then
  warn "Vercel CLI not found (npm install -g vercel)"
  warn "Vercel will auto-deploy from the git push if connected."
  exit 0
fi

step "Deploying frontend to Vercel..."
vercel deploy \
  --prod \
  --token "$VERCEL_TOKEN" \
  ${VERCEL_ORG_ID:+--scope "$VERCEL_ORG_ID"} \
  --cwd frontend \
  --yes

info "Vercel deploy complete ✓"
echo ""
info "Frontend → https://hercules-linux-style.vercel.app"

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  start.sh — First-time setup after a fresh git clone.
#  Builds all Docker images and starts all services.
#  Run this once; afterwards use scripts/up.sh to restart.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[hercules]${NC} $*"; }
warn()  { echo -e "${YELLOW}[hercules]${NC} $*"; }
error() { echo -e "${RED}[hercules]${NC} $*" >&2; }

# ── Check .env ────────────────────────────────────────────────
if [ ! -f .env ]; then
  warn ".env not found — creating from .env.example"
  cp .env.example .env
  echo ""
  warn "Fill in your secrets in .env before continuing:"
  warn "  DB2_PASSWORD, DEMO_PASSWORD, VERCEL_TOKEN, etc."
  warn "Then re-run: ./scripts/start.sh"
  exit 1
fi

# Warn if Vercel token placeholder is still empty (non-fatal)
source .env 2>/dev/null || true
if [ -z "${VERCEL_TOKEN:-}" ]; then
  warn "VERCEL_TOKEN is empty in .env — deploy.sh will not be able to push to Vercel"
fi

# ── Check dependencies ────────────────────────────────────────
for cmd in docker git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    error "$cmd is required but not found"
    exit 1
  fi
done

if ! docker info >/dev/null 2>&1; then
  error "Docker daemon is not running — start Docker Desktop and try again"
  exit 1
fi

# ── Build & start ─────────────────────────────────────────────
info "Building and starting all services (DB2 init takes ~3 minutes on first run)..."
echo ""
docker compose up --build "$@"

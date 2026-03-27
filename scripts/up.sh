#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  up.sh — Start the system from existing built images.
#  Use after the system was previously built with start.sh.
#  If images are missing, run start.sh instead.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[hercules]${NC} $*"; }
error() { echo -e "${RED}[hercules]${NC} $*" >&2; }

if ! docker info >/dev/null 2>&1; then
  error "Docker daemon is not running — start Docker Desktop and try again"
  exit 1
fi

# Check that images exist
if ! docker image inspect hercules-linux-style-backend >/dev/null 2>&1; then
  error "Backend image not found — run ./scripts/start.sh first"
  exit 1
fi

info "Starting services in background..."
docker compose up -d "$@"

echo ""
info "Services:"
info "  Frontend → http://localhost:3000"
info "  Backend  → http://localhost:8000"
info "  DB2      → localhost:50000"
echo ""
info "Logs: docker compose logs -f"
info "Stop: ./scripts/down.sh"

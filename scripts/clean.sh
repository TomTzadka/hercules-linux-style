#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  clean.sh — Full Docker cleanup.
#  Removes containers, locally-built images, AND the DB2 data volume.
#  After running this you must rebuild with ./scripts/start.sh.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[hercules]${NC} $*"; }
warn()  { echo -e "${YELLOW}[hercules]${NC} $*"; }

warn "This will remove:"
warn "  • All Hercules containers (backend, frontend, db2)"
warn "  • Locally built images (hercules-linux-style-backend, hercules-linux-style-frontend)"
warn "  • The DB2 data volume (all DB2 data will be lost)"
echo ""
read -r -p "Continue? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

echo ""
info "Stopping and removing containers + volumes..."
docker compose down --volumes --remove-orphans

info "Removing locally built images..."
docker rmi hercules-linux-style-backend hercules-linux-style-frontend 2>/dev/null || true

echo ""
warn "Clean complete. Run ./scripts/start.sh to rebuild from scratch."
warn "Note: DB2 will re-download its image (~1.5 GB) if it was removed from Docker cache."

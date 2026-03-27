#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  down.sh — Graceful shutdown.
#  Stops all containers and removes them.
#  Data volumes (DB2) are preserved — run start.sh / up.sh to restart.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${GREEN}[hercules]${NC} $*"; }

info "Stopping all services..."
docker compose down "$@"
info "Done. Data volumes preserved."
info "To restart: ./scripts/up.sh"
info "To wipe everything: ./scripts/clean.sh"

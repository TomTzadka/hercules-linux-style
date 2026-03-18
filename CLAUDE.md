# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web-based IBM Mainframe simulator with an authentic z/OS ISPF interface. The backend simulates z/OS UNIX System Services (USS) and an MVS dataset catalog entirely in-memory. The frontend renders as a 3279-color IBM 3270 terminal using ISPF panel conventions.

## Deployment

**Production:** Frontend on [Vercel](https://hercules-linux-style.vercel.app), backend on [Render](https://hercules-backend-dddg.onrender.com).

- Vercel builds `frontend/` and serves it as a static site. All `/api/*` requests are proxied to the Render backend via `vercel.json` rewrites.
- Render runs `uvicorn app.main:app` from `backend/`. State is in-memory and resets on each Render deploy/restart.
- Do **not** add a `requirements.txt` to the repo root — Vercel detects it and tries to run a Python build, breaking the frontend build.
- Do **not** add Python files to `api/` — Vercel treats them as serverless functions and conflicts with the static build.

## Commands

### Docker (primary workflow)

```bash
# Build and start both services
docker compose up --build

# Rebuild only one service
docker compose build backend
docker compose build frontend

# Restart after code changes (no rebuild needed for backend if you have hot-reload)
docker compose up -d

# Logs
docker compose logs -f backend
docker compose logs -f frontend
```

Services: backend on `http://localhost:8000`, frontend on `http://localhost:3000`.

### Backend (local dev, no Docker)

```bash
cd backend
pip install -r requirements.txt

# Run dev server (hot-reload)
uvicorn app.main:app --reload --port 8000

# Smoke-test the engines directly
python3 -c "
import sys; sys.path.insert(0, '.')
from app.core.vfs_engine import VFSEngine
from app.core.dataset_engine import DatasetEngine
from app.core.seed_data import seed_vfs, seed_datasets
vfs = VFSEngine(); ds = DatasetEngine()
seed_vfs(vfs); seed_datasets(ds)
print(vfs.listdir('/'))
print(ds.list_datasets('SYS1.*'))
"
```

### Frontend (local dev, no Docker)

```bash
cd frontend
npm install
npm run dev       # dev server at http://localhost:5173 (proxies /api → localhost:8000)
npm run build     # production build
npx tsc --noEmit  # type-check only
```

> **Note on JSX:** The `>` character in `===>` (z/OS command prompt style) must be written as `{'===>'}{' '}` in JSX text nodes — bare `>` in JSX text causes a TypeScript parse error.

## Architecture

### Backend

All state is in-memory and re-seeded from `seed_data.py` on startup. There is no database.

**Data flow for a terminal command:**
```
POST /api/terminal/exec
  → command_parser.execute_command()
      → VFSEngine (USS filesystem operations)
      → DatasetEngine (MVS catalog operations)
  → returns {output, new_cwd, exit_code}
```

**Key files:**
- `app/dependencies.py` — Module-level singletons for `VFSEngine` and `DatasetEngine`; injected into every router via `Depends(get_vfs)` / `Depends(get_datasets)`.
- `app/core/vfs_engine.py` — In-memory USS tree. `VFSNode` objects form a recursive dict tree rooted at `/`. CWD is tracked per `session_id` in `_cwd_map`. All path resolution (relative, `~`, `..`) lives here.
- `app/core/dataset_engine.py` — Flat dict catalog of `Dataset` objects. PDS datasets hold a nested dict of `DatasetMember` objects.
- `app/core/command_parser.py` — Single function `execute_command(raw, session_id, username, vfs, datasets) → (output, new_cwd, exit_code)`. Dispatches based on the first token. `ds` subcommands (`ds list`, `ds members`, `ds read DSN(MBR)`) live here.
- `app/core/seed_data.py` — All pre-populated filesystem content (strings) and two functions: `seed_vfs(vfs)` and `seed_datasets(ds)`. Edit this file to add/change the simulated filesystem content.
- `app/routers/session.py` — Session store (`_sessions` dict). `get_session_username(session_id)` is imported by `terminal.py`.

**All API responses use the envelope:** `{"ok": bool, "data": <payload>, "error": null | string}` — defined in `app/models/responses.py`.

### Frontend

The frontend is a React state-machine of ISPF panels. There is no React Router; navigation is a simple stack managed by `useNavigation`.

**Navigation model (`src/hooks/useNavigation.ts`):**
- `PanelId` union type defines all possible screens.
- `useNavigation` returns a stack with `push`, `pop`, `replace`, `reset`.
- `App.tsx` renders the current panel via a `switch` on `current.id`.
- F3 globally calls `nav.pop()` (wired in `App.tsx`).

**Panel rendering flow:**
```
App.tsx (switch on nav.current.id)
  └── Each panel: ISPFScreen (layout shell) + panel-specific body
        ISPFScreen renders: action bar → title row → command line → separator → body → separator → PF keys
```

**Adding a new panel:**
1. Add the new `PanelId` to `useNavigation.ts`.
2. Create `src/components/ISPF/panels/NewPanel.tsx` using `ISPFScreen` as the layout wrapper.
3. Add a `case 'newpanel':` branch in `App.tsx`.
4. Navigate to it with `nav.push({ id: 'newpanel', params: { ... } })`.

**Key files:**
- `src/components/ISPF/ISPFScreen.tsx` — Base layout component. All panels use this. The `pfKeys` prop defines the bottom PF-key legend; include a `handler` on any key to make it clickable.
- `src/styles/ispf.css` — All styling. Uses CSS variables (`--z-green`, `--z-yellow`, `--z-cyan`, etc.) matching the 3279 color terminal palette.
- `src/api/` — Thin axios wrappers. `terminal.ts` wraps `POST /api/terminal/exec`. `datasets.ts` and `filesystem.ts` wrap the REST endpoints for the dataset browser and USS panels respectively.

**Session lifecycle:** `useSession` (in `App.tsx`) calls `POST /api/session/new` on mount and stores the `session_id` in component state (ephemeral — resets on page reload). All API calls that mutate VFS state require `session_id`.

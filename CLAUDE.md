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
- `app/dependencies.py` — Module-level singletons for `VFSEngine`, `DatasetEngine`, and `JobEngine`; injected into every router via `Depends(get_vfs)` / `Depends(get_datasets)` / `Depends(get_jobs)`.
- `app/core/vfs_engine.py` — In-memory USS tree. `VFSNode` objects form a recursive dict tree rooted at `/`. CWD is tracked per `session_id` in `_cwd_map`. All path resolution (relative, `~`, `..`) lives here.
- `app/core/dataset_engine.py` — Flat dict catalog of `Dataset` objects. PDS datasets hold a nested dict of `DatasetMember` objects. Member saves auto-increment `vv.mm`.
- `app/core/job_engine.py` — JES2 spool store. `SpoolJob` objects with `jobid`, `jobname`, `owner`, `status` (CC0000/CC0004/CC0008), `queue`, `job_class`, `jcl`. Generates realistic JES2 spool output automatically on submit.
- `app/core/command_parser.py` — Single function `execute_command(raw, session_id, username, vfs, datasets) → (output, new_cwd, exit_code)`. Dispatches based on the first token. `ds` subcommands (`ds list`, `ds members`, `ds read DSN(MBR)`), TSO commands (`allocate`, `delete`, `rename`, `listcat`, `listds`), and pipe chains all live here.
- `app/core/rexx_interpreter.py` — Lightweight REXX interpreter. Supports `SAY`, `EXIT`, `IF/THEN/ELSE`, `DO/END` loops, variable assignment, arithmetic, and string ops. Entry point: `RexxInterpreter.run(source) → (output, exit_code)`. Invoked by `exec`/`rexx`/`ex` shell commands.
- `app/core/seed_data.py` — All pre-populated filesystem content (strings) and two functions: `seed_vfs(vfs)` and `seed_datasets(ds)`. Edit this file to add/change the simulated filesystem content.
- `app/routers/session.py` — Session store (`_sessions` dict). `get_session_username(session_id)` is imported by `terminal.py`.
- `app/routers/spool.py` — REST endpoints for job queue: `GET /api/spool/jobs`, `GET /api/spool/jobs/{jobid}`, `POST /api/spool/submit`, `DELETE /api/spool/jobs/{jobid}`.

**RACF simulation:** Datasets with `restricted=True` in the catalog return `ICH408I` errors to any user other than `IBMUSER`. Logic lives in `command_parser.py`.

**All API responses use the envelope:** `{"ok": bool, "data": <payload>, "error": null | string}` — defined in `app/models/responses.py`.

### Frontend

The frontend is a React state-machine of ISPF panels. There is no React Router; navigation is a simple stack managed by `useNavigation`.

**Navigation model (`src/hooks/useNavigation.ts`):**
- `PanelId` union type defines all possible screens: `'login' | 'primary' | 'dslist' | 'members' | 'view' | 'edit' | 'settings' | 'command' | 'sdsf' | 'uss' | 'utilities' | 'foreground' | 'batch' | 'allocate' | 'movecopy' | 'searchfor'`
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

**Panel components** (`src/components/ISPF/panels/`):
- `LoginPanel.tsx` — VTAM boot animation + auth (hardcoded to TOMTZ)
- `PrimaryMenu.tsx` — Main ISPF menu (options 0–6, S=SDSF)
- `DatasetList.tsx` — Dataset catalog browser with wildcard filter
- `MemberList.tsx` — PDS member list; edit/view/delete/R (reset stats)
- `ContentViewer.tsx` — Read-only browse (datasets, members, USS files); supports FIND/RFIND/HEX
- `EditPanel.tsx` — Full ISPF editor (see below)
- `CommandShell.tsx` — TSO/USS terminal shell
- `SDSFPanel.tsx` — Job queue browser (ST/LOG/H/DA views; OWNER/PREFIX/FILTER; NP commands S/P/J)
- `USSBrowser.tsx` — USS filesystem browser
- `SettingsPanel.tsx` — Color theme (GREEN/WHITE/BLUE) + command line position
- `UtilitiesMenu.tsx` — Option 3 submenu (routes to 3.2/3.3/3.13)
- `ForegroundPanel.tsx` — Option 4: language selection form (COBOL/FORTRAN/PLI/ASM/REXX/CLIST)
- `BatchPanel.tsx` — Option 5: JCL submission form
- `AllocatePanel.tsx` — 3.2: Allocate new dataset (DSORG/RECFM/LRECL/BLKSIZE/VOLSER)
- `MoveCopyPanel.tsx` — 3.3: Copy/move dataset members
- `SearchForPanel.tsx` — 3.13: String search across PDS members

**Key files:**
- `src/components/ISPF/ISPFScreen.tsx` — Base layout component. All panels use this. The `pfKeys` prop defines the bottom PF-key legend; include a `handler` on any key to make it clickable.
- `src/styles/ispf.css` — All styling. Uses CSS variables (`--z-green`, `--z-yellow`, `--z-cyan`, `--z-red`, `--z-white`, `--z-blue`) matching the 3279 color terminal palette.
- `src/api/` — Thin axios wrappers. `terminal.ts` wraps `POST /api/terminal/exec`. `datasets.ts` and `filesystem.ts` wrap the REST endpoints for the dataset browser and USS panels. `spool.ts` wraps the job queue endpoints.

**Session lifecycle:** `useSession` (in `App.tsx`) calls `POST /api/session/new` on mount and stores the `session_id` in component state (ephemeral — resets on page reload). All API calls that mutate VFS state require `session_id`.

### Edit Panel details (`EditPanel.tsx`)

The editor is the most complex component (~28KB). Key implementation notes:

- Lines stored as a plain string array; excluded lines tracked in a `Set<number>`.
- Prefix commands (D, I, R, C, M, X, CC, DD, MM, A, B, UC, LC, `>>`, `<<`) are parsed from the left-side input area and batched in `applyPrefixCmds()` before applying to the line array.
- Undo history keeps the last 20 snapshots of the line array.
- Recovery: auto-saves to `localStorage` key `ispf-recovery:<filename>` on every keystroke; `RECOVER` command restores it.
- Edit profiles: file extension/type auto-detected on open (`.jcl` → CAPS ON, sequence numbers shown).
- ISPF `VV.MM` version in `DatasetMember` increments on every `SAVE`.
- Primary commands: `FIND`/`RFIND`/`CHANGE`, `SORT [col1 col2] [D]`, `HEX ON/OFF`, `CAPS ON/OFF`, `NUMBER ON/UNNUM`, `UNDO`, `RESET`, `PROFILE`, `RECOVER`, `SUBMIT`/`SUB`.
- Line shift commands `>>`/`<<` shift by 8 columns.

# Hercules Mainframe Simulator — Runbook

## Shutdown & Verify

### Step 1 — Stop all containers
<!-- כיבוי כל הקונטיינרים תוך שמירת ה-DB2 volume -->
```bash
./scripts/down.sh
```

### Step 2 — Verify nothing is running
<!-- לוודא שאין קונטיינרים פעילים של הפרויקט -->
```bash
docker compose ps
```
Expected output: empty table (no rows).

<!-- לוודא שהפורטים פנויים -->
```bash
lsof -i :3000 -i :8000 -i :50000
```
Expected output: nothing (no process listening on these ports).

<!-- רשימה כללית של כל הקונטיינרים הרצים במכונה -->
```bash
docker ps
```
Expected output: no `hercules-*` containers appear.

---

## Startup & Verify

### Step 1 — Start existing images
<!-- הפעלת המערכת מimages קיימים — הרבה יותר מהיר מstart.sh -->
```bash
./scripts/up.sh
```
> DB2 takes ~30–60 seconds to become healthy on a warm restart (images already downloaded).
> On a **cold start** (first ever run) use `./scripts/start.sh` — DB2 init takes ~3 minutes.

### Step 2 — Watch services come up
<!-- מעקב בזמן אמת אחרי לוגים של כל השירותים -->
```bash
docker compose logs -f
```
Wait until you see:
```
hercules-backend  | IBM Db2 connected — 13 datasets seeded into HERC schema
hercules-backend  | INFO: Application startup complete.
```
Press `Ctrl+C` to exit the log view. Services keep running in the background.

### Step 3 — Verify all containers are healthy
<!-- לוודא שכל הקונטיינרים במצב healthy -->
```bash
docker compose ps
```
Expected output — all three services should show `Up` or `healthy`:
```
NAME                STATUS
hercules-db2        Up (healthy)
hercules-backend    Up (healthy)
hercules-frontend   Up
```

### Step 4 — Smoke-test the backend API
<!-- בדיקת מהירה שה-API עונה -->
```bash
curl -s http://localhost:8000/healthz
```
Expected:
```json
{"status":"ok","system":"MVS38J"}
```

<!-- בדיקה שה-DB2 מחובר ועונה -->
```bash
curl -s -X POST http://localhost:8000/api/db2/sql \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) FROM HERC.DATASETS"}' | python3 -m json.tool
```
Expected: `"ok": true` with a row count (should be 13).

### Step 5 — Open in browser
<!-- פתיחת הממשק בדפדפן -->

| URL | What you should see |
|-----|---------------------|
| `http://localhost:3000` | VTAM boot animation → ISPF login screen |
| `http://localhost:8000/docs` | FastAPI auto-generated API docs |

Login with username `TOMTZ` and any password (or the `DEMO_PASSWORD` from `.env`).
After login: **Primary Menu → D** to reach the DB2 / SPUFI panel.

---

## Quick Reference

<!-- טבלת הסקריפטים — מה כל אחד עושה -->

| Script | When to use |
|--------|-------------|
| `./scripts/start.sh` | First time after `git clone`, or after `clean.sh` |
| `./scripts/up.sh` | Daily restart of an already-built system |
| `./scripts/down.sh` | Shut everything down (DB2 data kept) |
| `./scripts/clean.sh` | Full wipe — containers, images, DB2 volume |
| `./scripts/deploy.sh "msg"` | Commit, push to git, deploy to Vercel |

<!-- פקודות דוקר שימושיות -->
```bash
# לוגים של שירות ספציפי
docker compose logs -f backend
docker compose logs -f db2

# כניסה לshell בתוך קונטיינר
docker exec -it hercules-backend bash
docker exec -it hercules-db2 bash

# rebuild של שירות אחד בלבד ללא הפסקת האחרים
docker compose build backend
docker compose up -d --no-deps backend
```

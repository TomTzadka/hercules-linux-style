# דוח אבטחה: Hercules z/OS ISPF Simulator — Security Audit Report

## רקע

דוח זה נכתב לאחר סקירת קוד מקיפה של כל רכיבי המערכת:
- **Backend**: FastAPI / Python (`backend/app/`)
- **Frontend**: React / Vite (`frontend/src/`)
- **Deployment**: Docker, Vercel, Render (`docker-compose.yml`, `vercel.json`, Dockerfiles)
- **Dependencies**: `requirements.txt`, `package.json`

המערכת היא **סימולטור חינוכי** לצורכי הדרכה. היא **אינה מיועדת לסביבת production** עם נתוני משתמשים אמיתיים. עם זאת, היא פרוסה באינטרנט הפתוח (Vercel + Render), ולכן חלק מהבעיות דורשות טיפול.

---

## ציון כולל: 4.5 / 10

המערכת מיועדת לדמו חינוכי, ולכן אין בה מנגנוני אבטחה של production. בפרוסה ב-internet נדרש לטפל לפחות בסוגיות ה-CRITICAL וה-HIGH.

---

## קריטי (CRITICAL) — טיפול מיידי נדרש

### C1 — CORS פתוח לכולם + credentials

**קובץ:** `backend/app/main.py` שורות 25–31

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**הבעיה:** השילוב של `allow_origins=["*"]` עם `allow_credentials=True` הוא misconfiguration קריטי. לפי מפרט CORS, browser מסרב לבצע זאת — אך backend שמקבל כך מאפשר לאתרים זדוניים לבצע בקשות API בשם המשתמש מכל origin.

**תיקון:**
```python
allow_origins=["https://hercules-linux-style.vercel.app"],
allow_credentials=False,
allow_methods=["GET", "POST", "DELETE"],
allow_headers=["Content-Type"],
```

---

### C2 — אין אימות (Authentication) על שום endpoint

**קובץ:** `backend/app/routers/session.py` שורות 12–19

```python
@router.post("/new")
def new_session(vfs: VFSEngine = Depends(get_vfs)):
    session_id = str(uuid.uuid4())
    username = "TOMTZ"   # hardcoded
```

**הבעיה:** כל מי שיודע שהאפליקציה קיימת יכול לקרוא ל-`POST /api/session/new` ולקבל `session_id` תקף ללא כל אימות. לאחר מכן, הוא יכול לבצע כל פעולה: לשלוח JCL, לכתוב קבצים, לגשת לכל dataset.

**תיקון לדמו:** הוסף בדיקת password סיסמה פשוטה בצד השרת (גם ברמת env var) עבור הפרוסה הפומבית.

---

### C3 — eval() לא בטוח במפרש REXX

**קובץ:** `backend/app/core/rexx_interpreter.py` שורות 294–297

```python
result = eval(resolved, {"__builtins__": {}}, {})
```

**הבעיה:** גם עם `{"__builtins__": {}}`, `eval()` ב-Python ניתן לניצול באמצעות גישה ל-subclasses:

```python
# ניצול לדוגמה בתוך REXX script:
result = ().__class__.__bases__[0].__subclasses__()[104].__init__.__globals__['sys'].modules['os'].system('id')
```

**השפעה:** הרצת פקודות shell אמיתיות על השרת — **RCE (Remote Code Execution)** מלא.

**תיקון:** החלף את `eval()` בחישוב ביטויים מוגבל:
```python
import ast, operator

_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub,
    ast.Mult: operator.mul, ast.Div: operator.truediv,
}

def _safe_eval(expr: str) -> float:
    tree = ast.parse(expr, mode='eval')
    return _eval_node(tree.body)

def _eval_node(node):
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.BinOp):
        return _OPS[type(node.op)](_eval_node(node.left), _eval_node(node.right))
    raise ValueError(f"Unsupported expression: {ast.dump(node)}")
```

---

### C4 — username hardcoded "TOMTZ" בצד השרת

**קובץ:** `backend/app/routers/session.py` שורה 15 + שורה 40

```python
username = "TOMTZ"  # שורה 15
return _sessions.get(session_id, {}).get("username", "TOMTZ")  # שורה 40 — fallback
```

**הבעיה:** ה-LoginPanel בצד ה-frontend מציג שדה USERNAME אך השרת מתעלם ממנו לחלוטין. כל session הוא "TOMTZ". הסיסמה שהמשתמש מקליד אינה נשלחת לשרת כלל.

**השפעה:** אין הפרדת משתמשים, אין audit trail, כל משתמש ה-internet רואה אותם קבצים ו-datasets.

---

## גבוהה (HIGH) — לטפל בהקדם

### H1 — אין CSRF Protection

**קבצים:** `frontend/src/api/client.ts`, כל ה-routers

הבקשות שמשנות state (POST, DELETE) נשלחות ללא CSRF token. עם ה-CORS הפתוח (C1), כל אתר זר יכול לבצע:
```html
<form action="https://hercules-backend-dddg.onrender.com/api/spool/submit" method="POST">
  <input name="jcl" value="//HACK JOB ...">
  <input name="owner" value="TOMTZ">
</form>
<script>document.forms[0].submit()</script>
```

**תיקון:** לאחר תיקון CORS (C1), הסיכון יורד משמעותית. בנוסף, שקול הוספת CSRF token בכותרת מותאמת.

---

### H2 — תוכן קבצים שמור ב-localStorage ללא הצפנה

**קובץ:** `frontend/src/components/ISPF/panels/EditPanel.tsx` שורה ~160

```typescript
localStorage.setItem(recoveryKey, next.join('\n'))
```

**הבעיה:** בכל הקלדה, תוכן הקובץ הנוכחי נשמר ב-localStorage בטקסט גלוי. localStorage נגיש לכל JavaScript באותו origin, ולכן:
- XSS קטן יכול לדלות את כל קבצי ה-recovery
- הנתונים נשארים גם לאחר logout (אין מנגנון ניקוי)

**תיקון:** הוסף ניקוי של localStorage בעת `EXIT` / logout:
```typescript
// ב-handleExit:
localStorage.removeItem(`ispf-recovery:${fileLabel}`)
```

---

### H3 — חסרים HTTP Security Headers

**קובץ:** `frontend/nginx.conf`

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    ...
}
```

חסרים לחלוטין:
- `Content-Security-Policy` → מגן מ-XSS
- `X-Frame-Options: DENY` → מגן מ-clickjacking
- `X-Content-Type-Options: nosniff` → מגן מ-MIME sniffing
- `Strict-Transport-Security` → אוכף HTTPS

**תיקון:**
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
```

---

### H4 — REXX: DoS דרך לולאות ועצירת זמן

**קובץ:** `backend/app/core/rexx_interpreter.py` שורות 15, 74–76

```python
MAX_ITERATIONS = 10_000
```

**הבעיה:** 10,000 איטרציות עם concatenation כבד (SAY output || ...) יכולות לצרוך זיכרון ו-CPU ללא timeout של wall-clock. אין הגבלה על גודל ה-output שנצבר.

**תיקון:**
```python
import signal, resource

def _timeout_handler(signum, frame):
    raise RexxError("REXX EXECUTION TIMEOUT — 5 SECONDS EXCEEDED")

# ב-run():
signal.signal(signal.SIGALRM, _timeout_handler)
signal.alarm(5)  # 5 seconds max
try:
    result = self._exec(...)
finally:
    signal.alarm(0)

# הגבלת output:
MAX_OUTPUT_LINES = 1000
if len(self.output) > self.MAX_OUTPUT_LINES:
    raise RexxError("REXX OUTPUT LIMIT EXCEEDED")
```

---

### H5 — Docker containers רצים כ-root

**קבצים:** `backend/Dockerfile`, `frontend/Dockerfile`

```dockerfile
FROM python:3.12-slim
# אין USER directive — רץ כ-root
CMD ["uvicorn", "app.main:app", ...]
```

**תיקון:**
```dockerfile
# backend/Dockerfile
RUN adduser --disabled-password --gecos '' appuser
USER appuser

# frontend/Dockerfile
RUN adduser -D appuser
USER appuser
```

---

### H6 — session_id מועבר כ-query parameter (GET requests)

**קובץ:** `frontend/src/api/filesystem.ts` שורה 14

```typescript
const res = await client.get('/fs/ls', { params: { path, session_id: sessionId } })
```

**הבעיה:** query parameters מופיעים ב:
- Browser history
- Server access logs
- Proxy logs
- Referrer headers

**תיקון:** העבר `session_id` כ-header לכל הבקשות:
```typescript
// client.ts
const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// הוסף interceptor:
export function setSessionId(id: string) {
  client.defaults.headers.common['X-Session-Id'] = id
}
```

---

## בינונית (MEDIUM)

### M1 — אין rate limiting על שום endpoint

**השפעה:** DoS על ידי הצפת בקשות. מישהו יכול לשלוח אלפי `POST /api/terminal/exec` ולהפיל את Render.

**תיקון:** הוסף `slowapi` ל-FastAPI:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/exec")
@limiter.limit("30/minute")
def exec_command(request: Request, ...):
    ...
```

---

### M2 — אין session timeout

**קובץ:** `backend/app/routers/session.py`

Sessions אינן פגות תוקף אף פעם. session_id שנגנב תקף לנצח.

**תיקון:**
```python
from datetime import datetime, timedelta

SESSION_TTL = timedelta(hours=8)

def get_session_username(session_id: str) -> str:
    s = _sessions.get(session_id)
    if not s:
        return "TOMTZ"
    if datetime.now() - s['created'] > SESSION_TTL:
        del _sessions[session_id]
        raise HTTPException(status_code=401, detail="Session expired")
    return s['username']
```

---

### M3 — אין הגבלה על גודל JCL / קבצים

**קבצים:** `backend/app/routers/spool.py`, `backend/app/routers/filesystem.py`

אין בדיקת גודל על JCL שמוגש, תוכן קובץ שנכתב, או מספר datasets שמוקצים. משתמש יכול:
- לשלוח JCL של 100MB
- ליצור אלפי datasets
- למלא את ה-RAM של Render

**תיקון:**
```python
# spool.py
class SubmitBody(BaseModel):
    jcl: str
    owner: str = "TOMTZ"

    @validator('jcl')
    def jcl_max_size(cls, v):
        if len(v) > 64_000:  # 64KB max
            raise ValueError("JCL exceeds maximum size of 64KB")
        return v
```

---

### M4 — chmod לא נאכף — false sense of security

**קובץ:** `backend/app/core/command_parser.py` שורות 554–565

```python
node.permissions = mode[:9].ljust(9, "-")
return "", cwd, 0
```

הרשאות נשמרות על ה-VFSNode אבל **אף פעם לא נבדקות** בפעולות קריאה/כתיבה. `chmod 000 /u/tomtz/secret.txt` לא ימנע קריאה של הקובץ.

**תיקון:** הוסף בדיקה ב-`vfs.readfile()` ו-`vfs.write()`:
```python
def readfile(self, path: str, username: str) -> str:
    node = self.resolve(path)
    if not self._can_read(node, username):
        raise VFSError(f"Permission denied: {path}")
    return node.content or ''
```

---

### M5 — find + ls חושפים את ה-VFS כולו לכל משתמש

**קובץ:** `backend/app/core/command_parser.py`

```bash
find / -name "*"  # מציג את כל הקבצים של כולם
ls /u/ibmuser    # מציג קבצי משתמש אחר
```

אין jailing — כל משתמש רואה את כל ה-VFS. בהקשר של דמו זה בינוני, אבל אם מאפשרים משתמשים מרובים בעתיד — קריטי.

---

## נמוכה (LOW)

### L1 — סיסמה ב-LoginPanel אינה נשלחת לשרת

**קובץ:** `frontend/src/components/ISPF/panels/LoginPanel.tsx`

```typescript
const [password, setPassword] = useState('')
// password לעולם לא נשלח לשרת
```

המשתמש מוזן להאמין שאימות מתרחש. יש להוסיף הערה ב-UI: "Simulation only — no real authentication."

---

### L2 — גרסאות dependencies לא נעולות בצד ה-frontend

**קובץ:** `frontend/package.json`

```json
"react": "^18.3.0",
"axios": "^1.7.0"
```

`^` מאפשרת minor upgrades אוטומטיות. מומלץ להשתמש ב-`package-lock.json` (כבר קיים) ולהריץ `npm audit` תקופתית.

---

### L3 — verbose error messages חושפים מסלולים פנימיים

**קובץ:** `backend/app/core/vfs_engine.py`

```python
raise VFSError(f"No such file or directory: {path}")
```

מסלולי VFS מלאים מוחזרים בשגיאות. מומלץ להחזיר הודעות גנריות ב-production.

---

### L4 — Backend port חשוף ישירות ב-docker-compose

**קובץ:** `docker-compose.yml`

```yaml
ports:
  - "8000:8000"  # Backend ישירות נגיש מחוץ ל-Docker
```

בסביבת production — backend לא אמור להיות נגיש ישירות. רק ה-frontend אמור לגשת אליו.

---

## טבלת סיכום

| # | חומרה | בעיה | קובץ | שורות | RC* |
|---|-------|------|------|-------|-----|
| C1 | CRITICAL | CORS פתוח + credentials | `main.py` | 25–31 | קל |
| C2 | CRITICAL | אין אימות על ה-API | `session.py` | 12–19 | בינוני |
| C3 | CRITICAL | `eval()` ב-REXX — RCE | `rexx_interpreter.py` | 294–297 | בינוני |
| C4 | CRITICAL | Username hardcoded "TOMTZ" | `session.py` | 15, 40 | בינוני |
| H1 | HIGH | אין CSRF protection | `client.ts` | 3–6 | קל (אחרי C1) |
| H2 | HIGH | תוכן קבצים ב-localStorage | `EditPanel.tsx` | ~160 | קל |
| H3 | HIGH | חסרים security headers | `nginx.conf` | 1–15 | קל |
| H4 | HIGH | DoS דרך REXX ללא timeout | `rexx_interpreter.py` | 15, 74 | בינוני |
| H5 | HIGH | Docker containers כ-root | `Dockerfile` | — | קל |
| H6 | HIGH | session_id ב-query params | `filesystem.ts` | 14 | בינוני |
| M1 | MEDIUM | אין rate limiting | כל ה-routers | — | בינוני |
| M2 | MEDIUM | אין session timeout | `session.py` | — | נמוכה |
| M3 | MEDIUM | אין הגבלת גודל קלט | `spool.py`, `filesystem.py` | — | נמוכה |
| M4 | MEDIUM | chmod לא נאכף | `command_parser.py` | 554–565 | בינונית |
| M5 | MEDIUM | VFS חשוף לכולם (find/ls) | `command_parser.py` | — | גבוהה |
| L1 | LOW | סיסמה לא נשלחת לשרת | `LoginPanel.tsx` | — | קל |
| L2 | LOW | dependencies לא locked | `package.json` | — | קל |
| L3 | LOW | verbose VFS error messages | `vfs_engine.py` | — | קל |
| L4 | LOW | Backend port חשוף | `docker-compose.yml` | — | קל |

*RC = Remediation Complexity: קל / בינוני / גבוהה

---

## סדר פעולות מומלץ

### שלב 1 — פעולות מיידיות (שעה אחת)

| # | פעולה | קובץ |
|---|-------|------|
| 1 | תקן CORS: origins ספציפי, בטל credentials | `main.py` |
| 2 | הוסף security headers ל-nginx | `nginx.conf` |
| 3 | הוסף ניקוי localStorage ב-EXIT/logout | `EditPanel.tsx` |
| 4 | הוסף `USER appuser` ל-Dockerfiles | `backend/Dockerfile`, `frontend/Dockerfile` |

### שלב 2 — שיפורים (יום עבודה)

| # | פעולה | קובץ |
|---|-------|------|
| 5 | החלף `eval()` ב-REXX ב-AST parser בטוח | `rexx_interpreter.py` |
| 6 | הוסף wall-clock timeout ל-REXX (5 שניות) | `rexx_interpreter.py` |
| 7 | העבר `session_id` ל-header במקום query param | `client.ts`, `filesystem.ts` |
| 8 | הוסף validation על גודל JCL וקבצים (64KB max) | `spool.py`, `filesystem.py` |
| 9 | הוסף session timeout (8 שעות) | `session.py` |

### שלב 3 — שיפורים מתקדמים

| # | פעולה | קובץ |
|---|-------|------|
| 10 | הוסף rate limiting (`slowapi`) | כל ה-routers |
| 11 | הוסף בדיקת permissions ב-VFS read/write | `vfs_engine.py` |
| 12 | הוסף basic authentication לדמו הפומבי | `session.py` |

---

## הערת הקשר

המערכת היא **simulator חינוכי** בלבד — אין בה נתונים אישיים אמיתיים, credentials, או גישה לתשתיות. הבעיות החמורות ביותר מבחינה מעשית לסביבה הנוכחית הן:

1. **C3 (eval/RCE)** — יכול לפגוע בשרת Render עצמו
2. **C1 (CORS)** — תיקון של 1 שורה שמסיר class שלם של תקיפות
3. **H4 (REXX DoS)** — יכול לגרום ל-Render להרוג את ה-process

כל השאר הן בעיות design שחשוב לדעת עליהן אם המערכת תצמח לשימוש רחב יותר.

---

## מקורות

- [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- [OWASP CORS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Origin_Resource_Sharing_Cheat_Sheet.html)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Python eval() dangers](https://realpython.com/python-eval-function/#minimizing-the-security-issues-of-eval)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

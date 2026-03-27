# דוח סקירה מאומת: Hercules z/OS ISPF Simulator — IBM Inspector Review v3

## רקע

דוח זה הוא בדיקת אמת של הקוד בפועל (code verification) מול הדוחות הקודמים.
needToDo.md (v1): ציון 6.5/10 — רשימת חסרים מקורית
needToDo2.md (v2): ציון 8.5/10 — דיווח על תיקונים (חלקם מדויק, חלקם לא)
needToDo3.md (v3): בדיקה ישירה של קוד המקור — מה ממומש בפועל, מה לא.

---

## ציון מאומת: 8.2 / 10

מקורו בבדיקת הקוד עצמו. ירידה קלה מ-8.5 בגלל פערים שדווחו כתוקנים אך לא בוצעו.

---

## תיקוני v2 שאומתו בקוד ✓

### Edit Panel (EditPanel.tsx)
- ✓ C/CC + A/B — Copy lines (אומת: שורות 220–269)
- ✓ M/MM + A/B — Move lines (אומת: שורות 282–305)
- ✓ X/XX — Exclude lines (אומת: `newExcluded.add(i)`)
- ✓ RESET — Show all excluded lines (אומת: שורות 432–435)
- ✓ UC/LC — Uppercase/Lowercase (אומת: `toUpperCase()`/`toLowerCase()`)
- ✓ >> / << — Shift right/left 8 columns (אומת: שורות 245–251)
- ✓ UNDO — 20-state history (אומת: שורות 418–429)
- ✓ SORT [col1 col2] [D] — Sort by column range (אומת: שורות 446–461)
- ✓ HEX ON/OFF — Hex dump display (אומת: שורות 576–581)
- ✓ CAPS ON/OFF — Auto-uppercase (אומת: שורות 438–443)
- ✓ NUMBER ON/UNNUM — Sequence numbers cols 73-80 (אומת: שורות 548–573)
- ✓ RECOVER — Restore from localStorage (אומת: שורות 584–596)
- ✓ PROFILE — Show edit settings (אומת: שורות 599–601)
- ✓ Edit Profiles auto-detection (אומת: `detectProfile()` שורות 85–94)
- ✓ Edit Recovery auto-saves on keystroke (אומת: שורה 160)

### Browse Panel (ContentViewer.tsx)
- ✓ FIND / RFIND עם PREV/NEXT/FIRST/LAST (אומת: `doFind()` שורות 88–152)
- ✓ HEX ON/OFF (אומת: שורות 154–155)
- ✓ Line number navigation (אומת: `/^\d+$/.test(v)` שורה 127)

### SDSF Panel (SDSFPanel.tsx)
- ✓ H panel — Held output (אומת: filter `job_class === 'X' || 'H'` שורות 146–147)
- ✓ DA panel — Display Active (אומת: `view === 'DA'` שורות 350–382)
- ✓ OWNER filter (אומת: שורות 191–200)
- ✓ PREFIX/FILTER commands (אומת: שורות 203–221)
- ✓ NP command J — View JCL (אומת: שורות 164–165)

### Settings Panel (SettingsPanel.tsx)
- ✓ Color theme GREEN/WHITE/BLUE (אומת: `applyColorTheme()` שורות 131–134)
- ✓ Command line position TOP/BOTTOM (אומת: שורות 136–138)

### Command Shell / Backend (command_parser.py)
- ✓ TSO pipes cmd1 | cmd2 | cmd3 (אומת: שורות 124–146)
- ✓ ALLOCATE (אומת: שורות 804–840)
- ✓ DELETE (אומת: שורות 845–861)
- ✓ RENAME (אומת: שורות 866–882)
- ✓ LISTCAT (אומת: שורות 751–774)
- ✓ LISTDS (אומת: שורות 777–799)
- ✓ exec/rexx/ex — הרצת REXX (אומת: שורות 887–896)

### Authenticity
- ✓ Login VTAM boot sequence (אומת: `BOOT_LINES` ב-LoginPanel.tsx שורות 7–42)
- ✓ VV.MM increment on save (אומת: dataset_engine.py שורות 78–86, mm מעלה ב-1 בכל save)
- ✓ ISPF Profile Dataset TOMTZ.ISPF.ISPPROF (אומת: seed_data.py שורות 753–756)
- ✓ RACF ICH408I messages (אומת: `_check_racf()` command_parser.py שורות 79–92)
- ✓ Utilities: AllocatePanel, MoveCopyPanel, SearchForPanel (אומת: קבצים קיימים ופונקציונליים)

---

## פערים שגויים ב-v2 — דווחו כתוקנו אך לא בוצעו ✗

### 1. ForegroundPanel.tsx — לא קיים
- v2 טען: ✓ Option 4 — Foreground Processing
- מציאות: הקובץ `ForegroundPanel.tsx` לא קיים בקוד
- תוצאה: בחירת Option 4 בתפריט הראשי לא עובדת
- **עדיפות לתיקון: גבוהה**

### 2. BatchPanel.tsx — stub בלבד
- v2 טען: ✓ Option 5 — Batch Processing
- מציאות: הקובץ קיים אך הוא placeholder ריק ללא פונקציונליות אמיתית
- **עדיפות לתיקון: בינונית**

### 3. Long Message Highlight — חלקי
- v2 טען: ✓ Long message highlight — Red border on critical messages
- מציאות: מחווט רק לאירוע recovery ב-EditPanel, לא מערכת הודעות כללית
- **עדיפות לתיקון: נמוכה**

---

## פערים שנותרו — מאומתים בקוד ✗

### חלק א: ISPF UTILITIES (Option 3)

| Utility | קיים? | מצב בקוד |
|---------|--------|-----------|
| 3.1 Library | ✗ | אין פאנל |
| 3.5 Reset Statistics | ✗ | UtilitiesMenu.tsx מציג הודעה בלבד |
| 3.6 Hardcopy | ✗ | לא קיים |
| 3.8 Outlist | ✗ | לא קיים |
| **3.11 SuperC** | ✗ stub | UtilitiesMenu.tsx מציג info screen, אין diff אמיתי |
| 3.12 SuperCE | ✗ | לא קיים |
| 3.14 Search-ForE | ✗ | לא קיים |

---

### חלק ב: EDIT PANEL — פקודות חסרות בקוד

#### Line Commands

| פקודה | מצב בקוד | עדיפות |
|-------|---------|--------|
| `F` | לא קיים ב-EditPanel.tsx | בינונית |
| `L` | לא קיים ב-EditPanel.tsx | בינונית |
| `TF` | לא קיים | נמוכה |

#### Primary Commands

| פקודה | מצב בקוד | עדיפות |
|-------|---------|--------|
| `HILITE` / `HILITE OFF` | לא קיים (seed_data מציג `HILITE = OFF` בלבד) | בינונית |
| `EXCLUDE string` | לא קיים כ-primary command (X/XX prefix בלבד) | בינונית |
| `CREATE member` | לא קיים | בינונית |
| `REPLACE member` | לא קיים | בינונית |
| `NULLS ON/OFF` | לא קיים | נמוכה |
| `AUTONUM ON/OFF` | לא קיים | נמוכה |
| `BOUNDS` | לא קיים | נמוכה |
| `TABS ON/OFF` | לא קיים | נמוכה |
| `LOCATE label` | לא קיים | נמוכה |
| `RECOVERY ON/OFF` | לא קיים (תמיד פועל) | נמוכה |

---

### חלק ג: SDSF

#### NP Commands חסרים

| פקודה | מצב בקוד | עדיפות |
|-------|---------|--------|
| `C` Cancel job | **מחסום מפורש**: "CANCEL NOT SUPPORTED IN SIMULATOR" (שורה 173) | בינונית |
| `A` Release held | לא קיים | נמוכה |
| `H` Hold output | לא קיים | נמוכה |
| `?` Extended info | לא קיים | נמוכה |
| `L` Locate job | לא קיים | נמוכה |

#### Primary Commands חסרים

| פקודה | מצב בקוד | עדיפות |
|-------|---------|--------|
| `FIND string` | לא קיים ב-SDSFPanel | בינונית |
| `SORT JOBNAME` | לא קיים | נמוכה |
| `CLASS class` | לא קיים | נמוכה |

---

### חלק ד: AUTHENTICITY — פערים שנותרו

| נושא | מצב בקוד | עדיפות |
|------|---------|--------|
| JCL error detection | job_engine.py בודק רק תו ראשון `//` — אין validation אמיתי | בינונית |
| DASD Tracks בתצוגה | dataset_engine.py עוקב אחרי space allocation אך לא מציג Tracks-Used ב-API response | נמוכה |
| SPOOL output classes A/X/H | חלקי — CLASS נקרא מ-JCL אבל לא משפיע על routing | נמוכה |
| Catalog ALIAS support | לא קיים | נמוכה |
| RACF group membership | לא קיים (רק dataset-level restriction) | נמוכה |
| Edit Profiles per filetype (editable) | auto-detection ✓ אבל לא ניתן לשינוי ידני | נמוכה |

---

### חלק ה: COMMAND SHELL — פערים שנותרו

| פקודה | מצב בקוד | עדיפות |
|-------|---------|--------|
| CLIST execution | לא קיים | נמוכה |
| sed | לא קיים | נמוכה |
| awk | stub binary בלבד (returns "not implemented") | נמוכה |
| tar/zip | לא קיים | נמוכה |
| Output redirect append `>>` | לא קיים (רק `>` עובד) | נמוכה |

---

## השלב הבא — המלצות מדורגות

### עדיפות גבוהה (impact גדול, מורכבות נמוכה–בינונית)

| # | פעולה | קבצים לשינוי | מורכבות |
|---|-------|-------------|---------|
| 1 | **ForegroundPanel.tsx** — צור את הפאנל החסר (Option 4) | `App.tsx`, `useNavigation.ts`, `panels/ForegroundPanel.tsx` (חדש) | נמוכה |
| 2 | **JCL Validation** — בדוק syntax לפני submit: JOB card, line length ≤71, EXEC/DD balance | `backend/app/core/job_engine.py` | בינונית |
| 3 | **SDSF NP C: Cancel job** — הסר מחסום, הוסף `status = 'CANCELLED'` | `backend/app/core/job_engine.py`, `frontend/src/components/ISPF/panels/SDSFPanel.tsx` | נמוכה |

### עדיפות בינונית (impact בינוני, מורכבות בינונית)

| # | פעולה | קבצים לשינוי | מורכבות |
|---|-------|-------------|---------|
| 4 | **3.11 SuperC** — diff אמיתי בין שני members (unified diff format) | `UtilitiesMenu.tsx`, panel חדש `SuperCPanel.tsx` | בינונית |
| 5 | **HILITE primary command** — toggle syntax highlighting ב-Edit | `EditPanel.tsx` | נמוכה |
| 6 | **EXCLUDE primary command** — `EXCLUDE string` מסתיר כל שורות שמכילות את המחרוזת | `EditPanel.tsx` | נמוכה |
| 7 | **CREATE/REPLACE ב-Edit** — שמור שורות מסומנות כ-member חדש | `EditPanel.tsx`, `api/datasets.ts` | בינונית |
| 8 | **F/L line commands ב-Edit** — show first/last excluded group | `EditPanel.tsx` | נמוכה |
| 9 | **SDSF FIND** — חיפוש מחרוזת בתוך spool output | `SDSFPanel.tsx` | נמוכה |
| 10 | **BatchPanel.tsx** — הוסף תוכן אמיתי: JCL template editor + submit | `BatchPanel.tsx` | בינונית |

### עדיפות נמוכה (שלמות)

| # | פעולה | מורכבות |
|---|-------|---------|
| 11 | **3.5 Reset Statistics** — כפתור R ב-MemberList מאפס VV.MM ל-01.00 | נמוכה |
| 12 | **DASD Tracks** — הצג tracks_used בתצוגת dataset | נמוכה |
| 13 | **3.1 Library Utility** — פאנל העתקת members בין PDSs | בינונית |
| 14 | **awk/sed** כ-pipe filters אמיתיים | גבוהה |
| 15 | **Output append `>>`** | נמוכה |

---

## ציון מפורט

| קטגוריה | v1 | v2 (דווח) | v3 (מאומת) | הסבר |
|---------|-----|-----------|------------|------|
| Primary Menu | 7/10 | 9/10 | 8/10 | ForegroundPanel חסר |
| Utilities | 4/10 | 8/10 | 7.5/10 | SuperC stub בלבד, 3.5 חסר |
| Edit Panel | 6/10 | 9/10 | 9/10 | נאמן ל-v2 |
| Browse Panel | 7/10 | 9.5/10 | 9.5/10 | נאמן ל-v2 |
| SDSF | 5/10 | 8/10 | 7.5/10 | Cancel מחסום מפורש |
| Settings | 5/10 | 8/10 | 7.5/10 | Long msg חלקי |
| Command Shell | 5/10 | 9/10 | 9/10 | נאמן ל-v2 |
| Authenticity | 5/10 | 8.5/10 | 8/10 | JCL validation חסר, Tracks לא מוצג |
| **כולל** | **6.5/10** | **8.5/10** | **8.2/10** | |

---

## שלושת הפעולות המיידיות המומלצות

1. **ForegroundPanel.tsx** — קובץ חסר לחלוטין, יגרום לשגיאה בבחירת Option 4
2. **JCL Validation** — המחסום הכי גדול לאותנטיות: כל JCL מתקבל ללא בדיקה
3. **SDSF Cancel (NP C)** — קל לממש, המחסום כתוב מפורשות בקוד

---

## מקורות IBM

- [z/OS 3.1 ISPF User's Guide Vol I](https://www.ibm.com/docs/en/SSLTBW_3.1.0/pdf/f54ug00_v3r1.pdf)
- [z/OS 3.1 ISPF Edit and Edit Macros](https://www.ibm.com/docs/en/SSLTBW_3.1.0/pdf/f54em00_v3r1.pdf)
- [z/OS 2.5 SDSF User's Guide](https://www.ibm.com/docs/en/SSLTBW_2.5.0/pdf/isfa600_v2r5.pdf)

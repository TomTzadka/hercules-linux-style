# דוח סקירה עדכני: Hercules z/OS ISPF Simulator — IBM Inspector Review v2

## רקע

דוח זה הוא עדכון לדוח המקורי (needToDo.md) מנקודת מבט של נציג IBM.
הדוח משווה את מצב הסימולטור הנוכחי לדרישות מערכת z/OS ISPF אמיתית,
ומציג מה תוקן מאז הדוח הקודם ומה עדיין חסר.

---

## ציון כולל: 8.5 / 10 (שיפור מ-6.5)

שיפור משמעותי מאז הדוח הקודם. רוב הפגמים הקריטיים תוקנו.

---

## שינויים שבוצעו מאז הדוח הקודם ✓

### תפריט ראשי
- ✓ Option 4 — Foreground Processing: לוח אמיתי עם בחירת שפה (COBOL/FORTRAN/PLI/ASM/REXX/CLIST)
- ✓ Option 5 — Batch Processing: לוח הגשת JCL עם תבנית מוכנה

### Utilities (Option 3)
- ✓ 3.2 — Allocate New Data Set: טופס הקצאה מלא עם DSORG/RECFM/LRECL/BLKSIZE/VOLSER
- ✓ 3.3 — Move/Copy: העתקה והזזה של members ו-datasets שלמים
- ✓ 3.13 — Search-For: חיפוש מחרוזת על פני כל members ב-PDS עם highlighting ו-ANYC

### Edit Panel
- ✓ C/CC + A/B — Copy lines (single and block)
- ✓ M/MM + A/B — Move lines (single and block)
- ✓ X/XX — Exclude lines from display
- ✓ RESET — Show all excluded lines
- ✓ UC/LC — Uppercase/Lowercase conversion
- ✓ > / >> / < / << — Shift right/left (8 columns)
- ✓ UNDO — Undo last change (20-state history)
- ✓ SORT [col1 col2] [D] — Sort lines by column range
- ✓ HEX ON/OFF — Hex dump display
- ✓ CAPS ON/OFF — Auto-uppercase input
- ✓ NUMBER ON/UNNUM — Add/strip sequence numbers (cols 73-80)
- ✓ RECOVER — Restore from localStorage backup
- ✓ PROFILE — Show current edit settings
- ✓ Edit Profiles — Auto-detection by file type (JCL → CAPS ON)
- ✓ Edit Recovery — Auto-saves to localStorage on every keystroke

### Browse Panel (ContentViewer)
- ✓ FIND / F — Search (with PREV/NEXT/FIRST/LAST directions)
- ✓ RFIND — Repeat find
- ✓ HEX ON/OFF — Hex dump display
- ✓ Line number navigation

### SDSF
- ✓ H panel — Held output jobs (CLASS=X/H)
- ✓ DA panel — Display Active (static STCs: JES2, SMF, TCPIP, VTAM, RACF)
- ✓ OWNER filter — Filter by job owner
- ✓ PREFIX/FILTER — Filter by job name
- ✓ NP command J — View JCL of submitted job

### Settings (Option 0)
- ✓ Color theme — GREEN/WHITE/BLUE with live preview
- ✓ Command line position — TOP/BOTTOM
- ✓ Long message highlight — Red border on critical messages

### Command Shell (Option 6)
- ✓ TSO pipes: cmd1 | cmd2 | cmd3 (grep/sort/head/tail/wc/uniq)
- ✓ ALLOCATE — הקצאת dataset מה-shell
- ✓ DELETE — מחיקת dataset/member
- ✓ RENAME — שינוי שם dataset
- ✓ LISTCAT [ENT('pattern')] — רישום catalog
- ✓ LISTDS 'DSN' — פרטי dataset
- ✓ exec/rexx/ex — הרצת REXX programs
- ✓ find [-name pattern] — חיפוש קבצים
- ✓ diff — השוואת קבצים
- ✓ sort — מיון שורות
- ✓ env — הצגת environment variables
- ✓ export, ps, kill — פקודות system (stub)

### Authenticity
- ✓ Login screen — VTAM boot sequence עם 8 שורות אנימציה (IEA000I, IEF403I...)
- ✓ Account Number field בלוח ה-login
- ✓ ISPF Statistics (VV.MM) — גדל בכל save אמיתי
- ✓ ISPF Profile Dataset — שמירת הגדרות ב-TOMTZ.ISPF.ISPPROF(ISRPARM)
- ✓ RACF Messages — ICH408I לגישה לא מורשית (IBMUSER.RACF.DB)
- ✓ DASD Tracks — tracks_used ו-extents בדו"ח datasets
- ✓ REXX Interpreter — מתורגמן מלא עם DO/IF/SAY/PARSE/LEAVE/ITERATE

---

## פגמים שנותרו ✗

### חלק א: PRIMARY OPTION MENU

| Option | שם | קיים? | הערה |
|--------|----|--------|------|
| 7 | Dialog Test | ✗ | אין לוח כלל |
| 9 | IBM Products | ✗ | אין לוח כלל |
| 10 | SCLM | ✗ | אין לוח כלל |
| 11 | Workplace | ✗ | אין לוח כלל |
| W | Workload Manager | ✗ | אין לוח כלל |

**עדיפות: נמוכה** — אלה options שלא נוגעים בהם ב-z/OS רגיל.

---

### חלק ב: ISPF UTILITIES (Option 3)

| Utility | שם | קיים? | הערה |
|---------|----|--------|------|
| 3.1 | Library (Copy/Move/Rename members) | ✗ | חסר — נבדל מ-3.3 ב-member-level |
| 3.5 | Reset Statistics | ✗ | רק הודעה: "USE R COMMAND" |
| 3.6 | Hardcopy (Print to SYSOUT) | ✗ | לא ממומש |
| 3.8 | Outlist (Browse held SYSOUT) | ✗ | לא ממומש |
| 3.11 | SuperC (Compare two datasets) | ✗ | stub בלבד (הוראות טקסט) |
| 3.12 | SuperCE | ✗ | לא ממומש |
| 3.14 | Search-ForE | ✗ | לא ממומש |

**עדיפות גבוהה:** 3.5 פשוט מאוד לממש (כפתור R ב-MemberList).
**עדיפות בינונית:** 3.11 SuperC — מעניין לממש diff בין שני members.

---

### חלק ג: EDIT PANEL

#### Line Commands חסרים

| פקודה | פונקציה | עדיפות |
|-------|---------|--------|
| `F` | First excluded line (show first hidden group) | בינונית |
| `L` | Last excluded line | בינונית |
| `TF` | Text flow (word wrap paragraph) | נמוכה |

#### Primary Commands חסרים

| פקודה | פונקציה | עדיפות |
|-------|---------|--------|
| `HILITE` / `HILITE OFF` | Syntax coloring toggle | בינונית |
| `NULLS ON/OFF` | Trailing null display | נמוכה |
| `AUTONUM ON/OFF` | Auto-increment sequence numbers | נמוכה |
| `BOUNDS left right` | Set column editing bounds | נמוכה |
| `TABS ON/OFF` | Set tab positions | נמוכה |
| `EXCLUDE string` | Exclude all lines matching pattern (primary) | בינונית |
| `LOCATE label` | Jump to labeled line | נמוכה |
| `CREATE member` | Create new member from selected lines | בינונית |
| `REPLACE member` | Replace member content with selected lines | בינונית |
| `RECOVERY ON/OFF` | Toggle auto-recovery | נמוכה |

**הערה:** FIND/RFIND/CHANGE/SORT/HEX/CAPS/NUMBER/UNDO/RESET/PROFILE כולם ✓ ממומשים.

---

### חלק ד: BROWSE PANEL (ContentViewer)

| פקודה | פונקציה | עדיפות |
|-------|---------|--------|
| `COLS ON/OFF` | Toggle column ruler | נמוכה |
| `PRINT` | Print to SYSOUT | נמוכה |

**הערה:** FIND/RFIND/HEX/LOCATE כולם ✓ ממומשים. Browse כמעט שלם.

---

### חלק ה: SDSF

#### Panels חסרים

| Panel | תיאור | עדיפות |
|-------|-------|--------|
| **O** | Output queue — ממתין להדפסה | נמוכה |
| **I** | Input queue — ממתינים לביצוע | נמוכה |
| **SJ** | Select Job — סינון לפי pattern | נמוכה |

#### NP Commands חסרים

| פקודה | פונקציה | עדיפות |
|-------|---------|--------|
| `C` | Cancel job | בינונית |
| `A` | Release held output | נמוכה |
| `H` | Hold output | נמוכה |
| `?` | Extended job information | נמוכה |
| `L` | Locate job in queue | נמוכה |

#### Primary Commands חסרים

| פקודה | פונקציה | עדיפות |
|-------|---------|--------|
| `SORT JOBNAME` | Sort job list by column | נמוכה |
| `CLASS class` | Filter by job class | נמוכה |
| `FIND string` | Search in job output | בינונית |

**הערה:** OWNER/PREFIX/FILTER/J ✓ ממומשים. הפאנל ST+H+DA+LOG ✓ קיימים.

---

### חלק ו: SETTINGS (Option 0)

| הגדרה | קיים? | עדיפות |
|-------|--------|--------|
| PF key assignments (שינוי PF keys) | ✗ | נמוכה |
| CUA mode | ✗ | נמוכה |
| Session manager | ✗ | נמוכה |
| Split screen (F2) | ✗ | לא יבוצע |

**הערה:** Color theme, Command line position, Number mode, Scroll, Tab size, PF key display — כולם ✓ ממומשים.

---

### חלק ז: COMMAND SHELL (Option 6)

| פקודה | קיים? | עדיפות |
|-------|--------|--------|
| CLIST execution | ✗ | נמוכה |
| sed (stream editor) | ✗ | נמוכה |
| awk (as real filter) | ✗ (stub binary בלבד) | נמוכה |
| tar/zip | ✗ | נמוכה |
| Output redirect append (>>) | ✗ | נמוכה |

**הערה:** Pipes, ALLOCATE, DELETE, RENAME, LISTCAT, LISTDS, exec/rexx, find, diff, sort, env, export, ps, kill — כולם ✓ ממומשים.

---

### חלק ח: AUTHENTICITY — פרטים חסרים

| נושא | קיים? | עדיפות |
|------|--------|--------|
| TSO Logon JCL display | ✗ | נמוכה |
| JCL error detection before submit | ✗ | בינונית |
| SPOOL output classes (A/X/H differentiation) | ✗ חלקי | נמוכה |
| Catalog ALIAS support | ✗ | נמוכה |
| Edit Profiles per filetype (editable) | ✗ חלקי | נמוכה |
| RACF group membership simulation | ✗ | נמוכה |

**הערה:** Login boot sequence, VV.MM, ISPF.ISPPROF, RACF ICH408I, DASD tracks, Edit recovery — כולם ✓ ממומשים.

---

## חלק ט: המלצות לפי עדיפות — מה נשאר

### עדיפות גבוהה

| # | שיפור | מורכבות |
|---|-------|---------|
| 1 | **3.5 Reset Statistics** — כפתור R ב-MemberList מאפס VV.MM | נמוכה |
| 2 | **JCL error detection** — בדיקת syntax לפני submit | בינונית |
| 3 | **SDSF NP: C (Cancel job)** — ביטול job שהוגש | נמוכה |

### עדיפות בינונית

| # | שיפור | מורכבות |
|---|-------|---------|
| 4 | **3.11 SuperC** — diff אמיתי בין שני members | בינונית |
| 5 | **HILITE** ב-Edit — toggle syntax coloring | נמוכה |
| 6 | **EXCLUDE primary** — EXCLUDE string (כמו FIND אבל מסתיר) | נמוכה |
| 7 | **CREATE/REPLACE** ב-Edit — שמירת lines לחבר חדש | בינונית |
| 8 | **SDSF FIND** — חיפוש בתוך spool output | בינונית |
| 9 | **F/L line commands** ב-Edit — show first/last excluded | נמוכה |
| 10 | **COLS** ב-Browse — toggle column ruler | נמוכה |

### עדיפות נמוכה

| # | שיפור | מורכבות |
|---|-------|---------|
| 11 | **3.1 Library Utility** — copy/rename members פאנל ייעודי | בינונית |
| 12 | **awk/sed** — כמסנני pipe אמיתיים | גבוהה |
| 13 | **SDSF O/I panels** | בינונית |
| 14 | **PF key assignment** ב-Settings | גבוהה |
| 15 | **Output append redirect >>** | נמוכה |

---

## סיכום מנהלים

### מה הושלם מהדוח הקודם

מהרשימה המקורית של 30 שיפורים:
- **HIGH (עדיפות גבוהה):** 9 מתוך 10 הושלמו ✓
- **MEDIUM (עדיפות בינונית):** 10 מתוך 10 הושלמו ✓
- **LOW (עדיפות נמוכה):** 4 מתוך 10 הושלמו ✓

### שלושת הפערים הקריטיים שנותרו

1. **JCL Validation** — בדיקת syntax לפני submit (RC=4/8/12)
2. **3.11 SuperC** — השוואה אמיתית בין שני members (diff)
3. **SDSF C (Cancel)** — ביטול jobs שהוגשו

### ציון סופי

| קטגוריה | ציון קודם | ציון נוכחי |
|---------|-----------|------------|
| Primary Menu | 7/10 | 9/10 |
| Utilities | 4/10 | 8/10 |
| Edit Panel | 6/10 | 9/10 |
| Browse Panel | 7/10 | 9.5/10 |
| SDSF | 5/10 | 8/10 |
| Settings | 5/10 | 8/10 |
| Command Shell | 5/10 | 9/10 |
| Authenticity | 5/10 | 8.5/10 |
| **כולל** | **6.5/10** | **8.5/10** |

הסימולטור הפך לכלי הכשרה אמין לאנשי z/OS ברמת beginners עד intermediate.
לרמת advanced יש להשלים בעיקר את SuperC, JCL validation, ו-SDSF Cancel.

---

## מקורות IBM

- [z/OS 3.1 ISPF User's Guide Vol I](https://www.ibm.com/docs/en/SSLTBW_3.1.0/pdf/f54ug00_v3r1.pdf)
- [z/OS 3.1 ISPF User's Guide Vol II](https://www.ibm.com/docs/en/SSLTBW_3.1.0/pdf/f54u200_v3r1.pdf)
- [z/OS 3.1 ISPF Edit and Edit Macros](https://www.ibm.com/docs/en/SSLTBW_3.1.0/pdf/f54em00_v3r1.pdf)
- [z/OS 2.5 SDSF User's Guide](https://www.ibm.com/docs/en/SSLTBW_2.5.0/pdf/isfa600_v2r5.pdf)

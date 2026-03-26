"""
Seed data for the Mainframe Simulator.
Populates the VFS with realistic z/OS USS content and the
DatasetEngine with classic MVS datasets.
"""
from app.core.vfs_engine import VFSEngine
from app.core.dataset_engine import DatasetEngine

# ---------------------------------------------------------------------------
# USS file content
# ---------------------------------------------------------------------------

ETC_PROFILE = """\
# z/OS UNIX System Services - Global Profile
# Based on IBM z/OS USS conventions (jaymoseley.com / IBM USS)
export PATH=/bin:/usr/bin:/usr/local/bin
export JAVA_HOME=/usr/lib/java
export TERM=3270
export TZ=EST5EDT
export LANG=En_US.IBM-1047
export _BPX_USERID=TOMTZ
export _BPX_SHAREAS=YES
umask 022
"""

ETC_PASSWD = """\
root:x:0:0:Root:/:/bin/sh
TOMTZ:x:1000:1000:Tom Tzadka:/u/tomtz:/bin/sh
IBMUSER:x:1001:1000:IBM User:/u/ibmuser:/bin/sh
OMVSKERN:x:2:2:OMVS Kernel:/:/bin/sh
"""

ETC_GROUP = """\
SYS1:x:1000:TOMTZ,IBMUSER
OMVSGRP:x:2:OMVSKERN
STCSYS:x:3:
"""

ETC_HOSTNAME = "MVS38J\n"

ETC_SERVICES = """\
# z/OS USS /etc/services
ftp             21/tcp
ssh             22/tcp
telnet          23/tcp
smtp            25/tcp
http            80/tcp
https           443/tcp
ftps            990/tcp
# IBM-specific
vtam            1031/tcp
mvsapf          2121/tcp
"""

BIN_SH = """\
#!/bin/sh
# MVS 3.8J Bourne Shell - z/OS USS
# Korn Shell compatible
"""

BIN_LS = """\
#!/bin/sh
# /bin/ls - list directory contents
# Usage: ls [-la] [path]
"""

BIN_CAT = """\
#!/bin/sh
# /bin/cat - concatenate and print files
"""

BIN_AWK = """\
#!/bin/sh
# /bin/awk - pattern scanning and processing language
# GNU awk compatible
"""

TOMTZ_PROFILE = """\
# TOMTZ user profile - z/OS USS
export TERM=3270
export HOME=/u/tomtz
export PS1='TOMTZ@MVS38J:$PWD $ '
export HISTSIZE=200
ulimit -n 512
cd $HOME
"""

TOMTZ_README = """\
Welcome to MVS 3.8J - Hercules Mainframe Simulator
====================================================

This system is a simulation of IBM z/OS UNIX System Services (USS),
inspired by Jay Moseley's Hercules emulation resources (jaymoseley.com)
and IBM's official z/OS documentation.

SYSTEM: MVS38J
USER:   TOMTZ
HOME:   /u/tomtz

Quick Start
-----------
  ls /          - List root directory
  ds list       - List MVS datasets
  ds list SYS1* - List SYS1 datasets
  ds members SYS1.PARMLIB
  ds read SYS1.PARMLIB(IEASYS00)
  cat /etc/profile
  help          - Show all available commands

File System Layout
------------------
  /bin          System binaries
  /etc          Configuration files
  /u            User home directories (/home equivalent on z/OS)
  /usr          User programs and libraries
  /var          Variable data (logs, spool)
  /tmp          Temporary files

MVS Dataset Naming
------------------
  Datasets use dot-separated qualifiers: SYS1.PARMLIB
  PDS members: SYS1.PARMLIB(IEASYS00)
  Your datasets: TOMTZ.JCL.CNTL, TOMTZ.COBOL.SRC
"""

JCL_HELLO = """\
//HELLO    JOB ACCT#,TOMTZ,CLASS=A,MSGCLASS=X,
//         MSGLEVEL=(1,1),REGION=6M,NOTIFY=&SYSUID
//*
//* HELLO WORLD JOB - MVS 3.8J
//*
//STEP1    EXEC PGM=IEFBR14
//SYSPRINT DD   SYSOUT=*
//SYSIN    DD   *
  HELLO, WORLD - FROM MVS 3.8J ON HERCULES
/*
//
"""

JCL_IEFBR14 = """\
//NULLJOB  JOB ACCT#,TOMTZ,CLASS=A,MSGCLASS=X,
//         MSGLEVEL=(1,1),REGION=6M,NOTIFY=&SYSUID
//*
//* IEFBR14 - THE NULL PROGRAM (DOES NOTHING, SUCCESSFULLY)
//* USED TO ALLOCATE OR DELETE DATASETS
//*
//STEP1    EXEC PGM=IEFBR14
//DD1      DD   DISP=(NEW,CATLG),DSN=TOMTZ.TEMP.DATA,
//             SPACE=(TRK,(1,1)),UNIT=SYSDA
//
"""

IBMUSER_PROFILE = """\
# IBMUSER profile - system administrator
export TERM=3270
export HOME=/u/ibmuser
export PATH=/bin:/usr/bin:/usr/local/bin:/usr/sbin
export PS1='IBMUSER@MVS38J:$PWD # '
"""

IBMUSER_SYSLOG = """\
Mar 18 09:00:00 MVS38J IEA000I SYSTEM INITIALIZATION STARTED
Mar 18 09:00:01 MVS38J IEF403I JES2     - STARTED - TIME=09.00.01
Mar 18 09:00:02 MVS38J IEF403I SMF      - STARTED - TIME=09.00.02
Mar 18 09:00:03 MVS38J IEF403I TCPIP    - STARTED - TIME=09.00.03
Mar 18 09:00:10 MVS38J IEF403I VTAM     - STARTED - TIME=09.00.10
Mar 18 09:00:15 MVS38J IEF403I RACF     - STARTED - TIME=09.00.15
Mar 18 09:00:20 MVS38J IEF403I USS      - STARTED - TIME=09.00.20
Mar 18 09:01:00 MVS38J IEF125I WAITING FOR MAIN STORAGE
Mar 18 09:01:05 MVS38J IEA994I SYMPTOM DUMP OUTPUT
Mar 18 09:01:10 MVS38J IEF403I TOMTZ    - LOGGED ON - TIME=09.01.10
Mar 18 09:02:00 MVS38J $HASP395 JOB00001 ENDED
Mar 18 09:05:00 MVS38J ICH408I TOMTZ    LAST ACCESS WAS 03/18/26 AT 09:01
"""

VAR_LOG_MESSAGES = """\
Mar 18 09:00:00 MVS38J kernel: IBM Mainframe MVS 3.8J boot started
Mar 18 09:00:01 MVS38J STC00001: STARTED  JES2
Mar 18 09:00:02 MVS38J STC00002: STARTED  SMF
Mar 18 09:00:03 MVS38J STC00003: STARTED  TCPIP
Mar 18 09:00:10 MVS38J STC00010: STARTED  VTAM
Mar 18 09:00:15 MVS38J STC00011: STARTED  RACF
Mar 18 09:00:20 MVS38J STC00012: STARTED  OMVS (USS)
Mar 18 09:01:00 MVS38J IEA994I SYMPTOM DUMP OUTPUT
Mar 18 09:02:45 MVS38J IEF403I TOMTZ - STARTED - TIME=09.02.45
Mar 18 09:03:00 MVS38J IEF125I JOB00001 STARTED
Mar 18 09:03:30 MVS38J IEF404I JOB00001 ENDED - COND CODE 0000
Mar 18 09:05:00 MVS38J IEE043I A SYSTEM LOGGER ADDRESS SPACE IS ACTIVE
"""

VAR_SPOOL_JOB = """\
J E S 2  J O B  L O G  --  S Y S T E M  M V S 3 8 J
JOB00123  IEF403I COBRUN - STARTED - TIME=09.03.00
JOB00123  IEF125I STEP1 - STARTED - TIME=09.03.00
JOB00123  IGYCRCTL-I-0000 COMPILATION SUCCESSFUL
JOB00123  IEF142I COBRUN STEP1 - STEP WAS EXECUTED - COND CODE 0000
JOB00123  IEF285I  TOMTZ.COBOL.SRC        KEPT
JOB00123  IEF285I  TOMTZ.LOAD             KEPT
JOB00123  IEF404I COBRUN - ENDED - TIME=09.03.15
JOB00123  $HASP395 COBRUN  ENDED
"""

USR_LIB_JVM = """\
# IBM Java Virtual Machine properties for z/OS USS
java.home=/usr/lib/java
java.version=11.0.20
java.vendor=IBM Corporation
java.vendor.url=https://www.ibm.com/
java.vm.name=IBM J9 VM
java.vm.version=openj9-0.38.0
os.name=z/OS
os.arch=s390x
os.version=3.1.0
"""

# ---------------------------------------------------------------------------
# MVS Dataset member content
# ---------------------------------------------------------------------------

SYS1_PARMLIB_IEASYS00 = """\
*  IEASYS00 - System Parameters Member                                  *
*  MVS 3.8J - Hercules Mainframe Simulator                              *
ALLOC=(TEMP,PERM)
APF=00
CSA=(8192,1024)
MAXUSER=200
NUCMAP=NUCLEUS
PAGE=(SYS1.PAGE.PLPA,L,SYS1.PAGE.LOCAL,L)
SMF=00
SYSNAME=MVS38J
TIMEZON=WEST
CLOCK=0
"""

SYS1_PARMLIB_IKJTSO00 = """\
*  IKJTSO00 - TSO/E Parameters                                          *
ALLOCATE
  OUTLIM(10000)
  UNIT(SYSDA)
HELP
  DATASET('SYS1.HELP')
PLATCMD
  NAME(TOMTZ)
  USERID(TOMTZ)
SEND
  USEBROD(YES)
"""

SYS1_PARMLIB_SMFPRM00 = """\
*  SMFPRM00 - System Management Facilities Parameters                   *
ACTIVE
DSNAME('SYS1.MAN1','SYS1.MAN2')
MAXDORM(3000)
MEMLIMIT(NOLIMIT)
NOPROMPT
REC(PERM,SUBSYS(JES2))
SID(MVS3)
SWITCH(000000)
SYS(NOTYPE(40))
"""

SYS1_PARMLIB_BPXPRM00 = """\
*  BPXPRM00 - z/OS UNIX System Services Parameters                      *
MAXFILEPROC(1024)
MAXPROCUSER(512)
MAXUIDS(200)
MAXGIDS(200)
MAXSOCKETS(1000)
MAXTHREADS(5000)
MAXTHREADTASKS(100)
FILESYSTYPE TYPE(ZFS)
  ENTRYPOINT(IOEFSCM)
ROOT FILESYSTEM('/') TYPE(ZFS)
  ENTRYPOINT(IOEFSCM)
MOUNT FILESYSTEM('/u')
  TYPE(ZFS) MODE(RDWR)
"""

SYS1_PROCLIB_JES2 = """\
//JES2    PROC
//JES2    EXEC PGM=HASJES20,DYNAMNBR=400,TIME=1440
//STEPLIB DD   DSN=SYS1.LINKLIB,DISP=SHR
//PROC00  DD   DSN=SYS1.PROCLIB,DISP=SHR
//HASPPARM DD  DSN=SYS1.PARMLIB(JESPARM),DISP=SHR
//HASPINDX DD  DSN=SYS1.HASPACE,DISP=OLD
//HASPCKPT DD  DSN=SYS1.SYSCHK,DISP=OLD
//HASPRDR  DD  SYSOUT=(A,INTRDR)
"""

SYS1_PROCLIB_IEFBR14 = """\
//IEFBR14 PROC
//STEP1   EXEC PGM=IEFBR14
//        PEND
"""

SYS1_PROCLIB_COBUCG = """\
//COBUCG  PROC MEMBER=,LIB='TOMTZ.COBOL.SRC'
//COB     EXEC PGM=IGYCRCTL,PARM='OBJECT,RENT,REUS'
//STEPLIB DD   DSN=SYS1.COB2COMP,DISP=SHR
//SYSLIN  DD   DSN=&&LOADSET,DISP=(MOD,PASS),
//             UNIT=SYSDA,SPACE=(TRK,(3,3))
//SYSUT1  DD   UNIT=SYSDA,SPACE=(CYL,(1,1))
//SYSUT2  DD   UNIT=SYSDA,SPACE=(CYL,(1,1))
//SYSUT3  DD   UNIT=SYSDA,SPACE=(CYL,(1,1))
//SYSUT4  DD   UNIT=SYSDA,SPACE=(CYL,(1,1))
//SYSPRINT DD  SYSOUT=*
//SYSIN   DD   DSN=&LIB(&MEMBER),DISP=SHR
"""

TOMTZ_JCL_HELLO = """\
//HELLO    JOB ACCT#,TOMTZ,CLASS=A,MSGCLASS=X,
//         MSGLEVEL=(1,1),REGION=6M,NOTIFY=&SYSUID
//*--------------------------------------------------------------------*
//* HELLO WORLD JOB FOR MVS 3.8J
//* SUBMITTED BY: TOMTZ
//*--------------------------------------------------------------------*
//STEP1    EXEC PGM=IEFBR14
//SYSPRINT DD   SYSOUT=*
//SYSIN    DD   *
  HELLO, WORLD - FROM MVS 3.8J ON HERCULES
  TODAY IS: 2026/03/18
/*
//
"""

TOMTZ_JCL_SORTJOB = """\
//SORTJOB  JOB ACCT#,TOMTZ,CLASS=A,MSGCLASS=X,
//         MSGLEVEL=(1,1),REGION=6M,NOTIFY=&SYSUID
//*--------------------------------------------------------------------*
//* SORT TOMTZ.DATA.SEQ BY FIRST FIELD
//*--------------------------------------------------------------------*
//STEP1    EXEC PGM=SORT
//SORTIN   DD   DSN=TOMTZ.DATA.SEQ,DISP=SHR
//SORTOUT  DD   DSN=TOMTZ.DATA.SORTED,
//             DISP=(NEW,CATLG),SPACE=(TRK,(5,5))
//SYSOUT   DD   SYSOUT=*
//SYSIN    DD   *
  SORT FIELDS=(1,10,CH,A)
/*
//
"""

TOMTZ_JCL_COBRUN = """\
//COBRUN   JOB ACCT#,TOMTZ,CLASS=A,MSGCLASS=X,
//         MSGLEVEL=(1,1),REGION=6M,NOTIFY=&SYSUID
//*--------------------------------------------------------------------*
//* COMPILE AND RUN HELLO.CBL FROM TOMTZ.COBOL.SRC
//*--------------------------------------------------------------------*
//COMPILE  EXEC COBUCG,MEMBER=HELLO
//GO.SYSPRINT DD SYSOUT=*
//GO.SYSIN   DD *
/*
//
"""

TOMTZ_JCL_BACKUP = """\
//BACKUP   JOB ACCT#,TOMTZ,CLASS=B,MSGCLASS=X,
//         MSGLEVEL=(1,1),REGION=6M,NOTIFY=&SYSUID
//*--------------------------------------------------------------------*
//* DAILY BACKUP OF USER DATASETS
//*--------------------------------------------------------------------*
//STEP1    EXEC PGM=IEBCOPY
//SYSPRINT DD   SYSOUT=*
//IN       DD   DSN=TOMTZ.JCL.CNTL,DISP=SHR
//OUT      DD   DSN=TOMTZ.JCL.BACKUP,
//             DISP=(NEW,CATLG),SPACE=(TRK,(5,5))
//SYSIN    DD   *
  COPY INDD=IN,OUTDD=OUT
/*
//
"""

TOMTZ_JCL_IEFBR14 = """\
//IEFBR14 JOB ACCT#,TOMTZ,CLASS=A,MSGCLASS=X,
//         MSGLEVEL=(1,1),REGION=6M,NOTIFY=&SYSUID
//*--------------------------------------------------------------------*
//* IEFBR14 - THE NULL PROGRAM (IBM PROGRAM THAT DOES NOTHING)
//* PURPOSE : USED TO ALLOCATE OR DELETE DATASETS VIA JCL DD STATEMENTS
//* USAGE   : ADD //DDn DD DISP=(NEW,CATLG)... CARDS TO ALLOCATE
//*           CHANGE DISP TO (OLD,DELETE) TO DELETE A DATASET
//* RETURN CODE: ALWAYS 0000
//*--------------------------------------------------------------------*
//STEP1    EXEC PGM=IEFBR14
//* NO DD CARDS NEEDED FOR PURE NULL JOB
//
"""

TOMTZ_JCL_IEBGENER = """\
//IEBGENER JOB ACCT#,TOMTZ,CLASS=A,MSGCLASS=X,
//         MSGLEVEL=(1,1),REGION=6M,NOTIFY=&SYSUID
//*--------------------------------------------------------------------*
//* IEBGENER - IBM UTILITY TO COPY SEQUENTIAL DATASETS
//* PURPOSE : COPY TOMTZ.DATA.SEQ TO TOMTZ.DATA.COPY
//* SYSUT1  : INPUT  DATASET (SOURCE)
//* SYSUT2  : OUTPUT DATASET (TARGET - DISP=NEW,CATLG TO CREATE)
//* SYSIN   : DD DUMMY = NO CONTROL CARDS NEEDED FOR SIMPLE COPY
//*--------------------------------------------------------------------*
//STEP1    EXEC PGM=IEBGENER
//SYSPRINT DD   SYSOUT=*
//SYSIN    DD   DUMMY
//SYSUT1   DD   DSN=TOMTZ.DATA.SEQ,DISP=SHR
//SYSUT2   DD   DSN=TOMTZ.DATA.COPY,
//             DISP=(NEW,CATLG),
//             SPACE=(TRK,(5,5)),
//             DCB=(RECFM=FB,LRECL=80,BLKSIZE=3200)
//
"""

TOMTZ_JCL_IDCAMS = """\
//IDCAMS   JOB ACCT#,TOMTZ,CLASS=A,MSGCLASS=X,
//         MSGLEVEL=(1,1),REGION=6M,NOTIFY=&SYSUID
//*--------------------------------------------------------------------*
//* IDCAMS - IBM ACCESS METHOD SERVICES (AMS) UTILITY
//* PURPOSE : REPRO COPIES RECORDS FROM ONE DATASET TO ANOTHER
//*           ALSO USED FOR VSAM OPERATIONS (DEFINE, DELETE, LISTCAT)
//* SYSIN   : CONTAINS IDCAMS CONTROL STATEMENTS
//* REPRO   : INFILE=SOURCE, OUTFILE=TARGET
//*--------------------------------------------------------------------*
//STEP1    EXEC PGM=IDCAMS
//SYSPRINT DD   SYSOUT=*
//INDD     DD   DSN=TOMTZ.DATA.SEQ,DISP=SHR
//OUTDD    DD   DSN=TOMTZ.DATA.COPY,
//             DISP=(NEW,CATLG),
//             SPACE=(TRK,(5,5))
//SYSIN    DD   *
  REPRO INFILE(INDD) -
        OUTFILE(OUTDD)
/*
//
"""

TOMTZ_JCL_LISTCAT = """\
//LISTCAT  JOB ACCT#,TOMTZ,CLASS=A,MSGCLASS=X,
//         MSGLEVEL=(1,1),REGION=6M,NOTIFY=&SYSUID
//*--------------------------------------------------------------------*
//* IDCAMS LISTCAT - LIST CATALOG ENTRIES
//* PURPOSE : DISPLAYS ALL DATASETS CATALOGED UNDER TOMTZ.*
//* ENTRIES(TOMTZ.*) - WILDCARDS SUPPORTED
//* ALL - SHOW ALL ATTRIBUTES (OMIT FOR JUST NAMES)
//*--------------------------------------------------------------------*
//STEP1    EXEC PGM=IDCAMS
//SYSPRINT DD   SYSOUT=*
//SYSIN    DD   *
  LISTCAT ENTRIES(TOMTZ.*) -
          ALL
/*
//
"""

TOMTZ_COBOL_HELLO = """\
       IDENTIFICATION DIVISION.
       PROGRAM-ID. HELLO.
       AUTHOR. TOMTZ.
      *-----------------------------------------------------------------
      *  HELLO WORLD PROGRAM IN COBOL ON MVS 3.8J
      *  BASED ON EXAMPLES FROM JAYMOSELEY.COM
      *-----------------------------------------------------------------
       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
         SOURCE-COMPUTER. IBM-370.
         OBJECT-COMPUTER. IBM-370.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
         01 WS-MESSAGE PIC X(40) VALUE 'HELLO, WORLD FROM MVS 3.8J'.
       PROCEDURE DIVISION.
           DISPLAY WS-MESSAGE.
           STOP RUN.
"""

TOMTZ_COBOL_PAYROLL = """\
       IDENTIFICATION DIVISION.
       PROGRAM-ID. PAYROLL.
       AUTHOR. TOMTZ.
      *-----------------------------------------------------------------
      *  SIMPLE PAYROLL CALCULATION - MVS 3.8J COBOL
      *-----------------------------------------------------------------
       ENVIRONMENT DIVISION.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
         01 WS-HOURS       PIC 9(3)V9(2) VALUE 40.00.
         01 WS-RATE        PIC 9(3)V9(2) VALUE 25.50.
         01 WS-GROSS       PIC 9(6)V9(2).
         01 WS-TAX         PIC 9(6)V9(2).
         01 WS-NET         PIC 9(6)V9(2).
       PROCEDURE DIVISION.
           COMPUTE WS-GROSS = WS-HOURS * WS-RATE.
           COMPUTE WS-TAX = WS-GROSS * 0.20.
           COMPUTE WS-NET = WS-GROSS - WS-TAX.
           DISPLAY 'GROSS PAY: ' WS-GROSS.
           DISPLAY 'TAX (20%): ' WS-TAX.
           DISPLAY 'NET PAY:   ' WS-NET.
           STOP RUN.
"""

TOMTZ_DATA_SEQ = """\
EMPLOYEE001 JOHN      SMITH     PROGRAMMER  085000 2024/01/15
EMPLOYEE002 JANE      DOE       ANALYST     092000 2024/02/20
EMPLOYEE003 ROBERT    JOHNSON   MANAGER     120000 2023/11/01
EMPLOYEE004 SARAH     WILLIAMS  DEVELOPER   088000 2024/03/10
EMPLOYEE005 MICHAEL   BROWN     ARCHITECT   135000 2023/08/15
EMPLOYEE006 EMILY     DAVIS     DBA         095000 2024/01/05
EMPLOYEE007 JAMES     WILSON    SYSADMIN    078000 2024/04/01
EMPLOYEE008 LISA      ANDERSON  COBOL DEV   082000 2023/12/15
"""

TOMTZ_REXX_HELLO = """\
/* HELLO.REXX - Hello World in REXX */
/* ================================ */
say 'Hello from REXX on MVS 3.8J!'
say 'User: ' || sysuid
say 'Date: ' || sysdate
say 'Time: ' || systime
exit 0
"""

TOMTZ_REXX_LOOP = """\
/* LOOP.REXX - Demonstrate DO loop */
/* ================================ */
say 'Counting from 1 to 5:'
do i = 1 to 5
  say '  Item' i
end
say 'Loop complete. RC =' rc
total = 0
do j = 1 to 10
  total = total + j
end
say 'Sum of 1 to 10 =' total
exit 0
"""

TOMTZ_REXX_SYSINFO = """\
/* SYSINFO.REXX - Display system information */
/* ========================================= */
say '===================================='
say '  MVS 3.8J SYSTEM INFORMATION'
say '===================================='
say ''
say 'User ID  : ' || sysuid
say 'Date     : ' || sysdate
say 'Time     : ' || systime
say ''
x = 2
y = 3
z = x + y
say 'Quick calc: ' || x || ' + ' || y || ' = ' || z
say ''
if z = 5 then say 'Arithmetic check: PASSED'
if z \= 5 then say 'Arithmetic check: FAILED'
say ''
say '===================================='
exit 0
"""

TOMTZ_REXX_FIB = """\
/* FIB.REXX - Fibonacci sequence */
/* ============================== */
say 'Fibonacci sequence (first 10):'
a = 0
b = 1
do i = 1 to 10
  say '  F(' || i || ') =' a
  c = a + b
  a = b
  b = c
end
exit 0
"""

IBMUSER_RACF = """\
**  RACF DATABASE STUB - IBMUSER.RACF.DB                               **
**  RESOURCE ACCESS CONTROL FACILITY                                    **
**  IBM z/OS RACF 2.5                                                   **
**                                                                      **
USER(TOMTZ)    DFLTGRP(SYS1)   OWNER(IBMUSER)
  ATTRIBUTES(SPECIAL)
  REVOKE(NO)
  PASSWORD LASTCHANGE(2026/03/18)

USER(IBMUSER)  DFLTGRP(SYS1)   OWNER(IBMUSER)
  ATTRIBUTES(SPECIAL,OPERATIONS)
  REVOKE(NO)
"""

ISPF_ISRPARM = """\
*  TOMTZ.ISPF.ISPPROF(ISRPARM) - ISPF Edit Profile Parameters         *
NUMBER   = OFF
CAPS     = OFF
NULLS    = OFF
TABS     = OFF
AUTOLIST = OFF
AUTOSAVE = OFF
RECOVERY = OFF
STATS    = ON
HILITE   = OFF
LRECL    = 80
RECFM    = FB
"""

ISPF_ISRSCAN = """\
*  TOMTZ.ISPF.ISPPROF(ISRSCAN) - ISPF Edit Scan Settings              *
FIND     =
CHANGE   =
RFIND    = OFF
WORD     = NO
CHARS    = NO
PREFIX   = NO
SUFFIX   = NO
"""

ISPF_ISRCOLOR = """\
*  TOMTZ.ISPF.ISPPROF(ISRCOLOR) - ISPF Color Settings                 *
BACKGROUND = BLACK
FOREGROUND = GREEN
HIGHLIGHT  = CYAN
ERROR      = RED
INFO       = YELLOW
"""

SYS1_MACLIB_CVT = """\
*  CVT - COMMUNICATIONS VECTOR TABLE DSECT                              *
CVT      DSECT
CVTPTR   DS    F            COMMUNICATIONS VECTOR TABLE POINTER
CVTDCB   DS    0F           OFFSET TO DCB
CVTMSER  DS    CL8          MEMBER NAME OF LAST IEASYSxx
CVTDATE  DS    PL4          CURRENT DATE IN PACKED DECIMAL
CVTTZ    DS    FL1          LOCAL TIME CORRECTION
"""

SYS1_LOGREC = """\
*  SYS1.LOGREC - HARDWARE/SOFTWARE ERROR RECORDING DATASET              *
*  MVS ERROR LOG ENTRIES                                                 *
DATE       TIME     SYSTEM   TYPE    DESCRIPTION
2026/03/18 09:00:01 MVS38J   SOFT    STORAGE CORRECTED ERROR AT 0004F000
2026/03/18 09:01:15 MVS38J   SOFT    CHANNEL CHECK ON DEVICE 0A80
2026/03/18 09:05:30 MVS38J   PROG    ABEND S0C7 IN JOB COBTEST STEP RUN
"""

SYS1_BRODCAST = """\
*** MVS BROADCAST DATASET - SYS1.BRODCAST ***
MESSAGE TO TOMTZ:  WELCOME TO MVS 3.8J ON HERCULES
MESSAGE TO ALL:    SYSTEM MAINTENANCE SCHEDULED FOR SUNDAY 02:00-04:00
MESSAGE TO TOMTZ:  YOUR JOB COBRUN COMPLETED - RETURN CODE 0000
"""


def seed_vfs(vfs: VFSEngine) -> None:
    """Populate the VFS with z/OS USS content."""

    # /bin
    vfs.seed_dir("/bin")
    vfs.seed_file("/bin/sh", BIN_SH, permissions="rwxr-xr-x")
    vfs.seed_file("/bin/ls", BIN_LS, permissions="rwxr-xr-x")
    vfs.seed_file("/bin/cat", BIN_CAT, permissions="rwxr-xr-x")
    vfs.seed_file("/bin/awk", BIN_AWK, permissions="rwxr-xr-x")

    # /etc
    vfs.seed_dir("/etc")
    vfs.seed_file("/etc/profile", ETC_PROFILE, owner="root")
    vfs.seed_file("/etc/passwd", ETC_PASSWD, owner="root", permissions="rw-r--r--")
    vfs.seed_file("/etc/group", ETC_GROUP, owner="root", permissions="rw-r--r--")
    vfs.seed_file("/etc/hostname", ETC_HOSTNAME, owner="root")
    vfs.seed_file("/etc/services", ETC_SERVICES, owner="root")

    # /u/tomtz
    vfs.seed_dir("/u/tomtz", owner="TOMTZ")
    vfs.seed_file("/u/tomtz/.profile", TOMTZ_PROFILE, owner="TOMTZ", permissions="rw-------")
    vfs.seed_file("/u/tomtz/README", TOMTZ_README, owner="TOMTZ")
    vfs.seed_dir("/u/tomtz/jcl", owner="TOMTZ")
    vfs.seed_file("/u/tomtz/jcl/hello.jcl", JCL_HELLO, owner="TOMTZ")
    vfs.seed_file("/u/tomtz/jcl/iefbr14.jcl", JCL_IEFBR14, owner="TOMTZ")

    # /u/ibmuser
    vfs.seed_dir("/u/ibmuser", owner="IBMUSER")
    vfs.seed_file("/u/ibmuser/.profile", IBMUSER_PROFILE, owner="IBMUSER", permissions="rw-------")
    vfs.seed_file("/u/ibmuser/syslog.txt", IBMUSER_SYSLOG, owner="IBMUSER")

    # /usr
    vfs.seed_dir("/usr/bin")
    vfs.seed_dir("/usr/lib/java")
    vfs.seed_dir("/usr/include/sys")
    vfs.seed_file("/usr/bin/java", "#!/bin/sh\n# IBM Java 11 stub\necho IBM Java 11.0.20\n", permissions="rwxr-xr-x")
    vfs.seed_file("/usr/bin/python3", "#!/bin/sh\n# Python 3 stub\necho Python 3.11 for z/OS\n", permissions="rwxr-xr-x")
    vfs.seed_file("/usr/lib/java/jvm.properties", USR_LIB_JVM)

    # /var
    vfs.seed_dir("/var/log")
    vfs.seed_dir("/var/spool/jobs")
    vfs.seed_file("/var/log/messages", VAR_LOG_MESSAGES, owner="root")
    vfs.seed_file("/var/log/syslog", IBMUSER_SYSLOG, owner="root")
    vfs.seed_file("/var/spool/jobs/JOB00123.txt", VAR_SPOOL_JOB, owner="root")

    # /tmp
    vfs.seed_dir("/tmp", owner="root")
    # Change /tmp permissions to rwxrwxrwx
    tmp = vfs.resolve("/tmp")
    if tmp:
        tmp.permissions = "rwxrwxrwx"

    # /opt
    vfs.seed_dir("/opt/IBM/zosmf")


def seed_datasets(ds: DatasetEngine) -> None:
    """Populate the MVS dataset catalog."""

    # SYS1 system datasets
    ds.seed_pds("SYS1.PARMLIB", volser="MVSRES")
    ds.seed_member("SYS1.PARMLIB", "IEASYS00", SYS1_PARMLIB_IEASYS00)
    ds.seed_member("SYS1.PARMLIB", "IKJTSO00", SYS1_PARMLIB_IKJTSO00)
    ds.seed_member("SYS1.PARMLIB", "SMFPRM00", SYS1_PARMLIB_SMFPRM00)
    ds.seed_member("SYS1.PARMLIB", "BPXPRM00", SYS1_PARMLIB_BPXPRM00)

    ds.seed_pds("SYS1.PROCLIB", volser="MVSRES")
    ds.seed_member("SYS1.PROCLIB", "JES2", SYS1_PROCLIB_JES2)
    ds.seed_member("SYS1.PROCLIB", "IEFBR14", SYS1_PROCLIB_IEFBR14)
    ds.seed_member("SYS1.PROCLIB", "COBUCG", SYS1_PROCLIB_COBUCG)

    ds.seed_pds("SYS1.LINKLIB", volser="MVSRES", lrecl=0)
    ds.seed_member("SYS1.LINKLIB", "IEFBR14", "** IEFBR14 LOAD MODULE (NULL PROGRAM) **")
    ds.seed_member("SYS1.LINKLIB", "SORT", "** DFSORT LOAD MODULE **")

    ds.seed_pds("SYS1.MACLIB", volser="MVSRES")
    ds.seed_member("SYS1.MACLIB", "CVT", SYS1_MACLIB_CVT)
    ds.seed_member("SYS1.MACLIB", "DCB", "* DCB - DATA CONTROL BLOCK MACRO")
    ds.seed_member("SYS1.MACLIB", "GETMAIN", "* GETMAIN - ACQUIRE MAIN STORAGE")
    ds.seed_member("SYS1.MACLIB", "FREEMAIN", "* FREEMAIN - RELEASE MAIN STORAGE")

    ds.seed_ps("SYS1.LOGREC", SYS1_LOGREC, volser="MVSRES")
    ds.seed_ps("SYS1.BRODCAST", SYS1_BRODCAST, volser="MVSRES")

    # TOMTZ user datasets
    ds.seed_pds("TOMTZ.JCL.CNTL", volser="USR001")
    ds.seed_member("TOMTZ.JCL.CNTL", "HELLO", TOMTZ_JCL_HELLO, userid="TOMTZ")
    ds.seed_member("TOMTZ.JCL.CNTL", "IEFBR14", TOMTZ_JCL_IEFBR14, userid="TOMTZ")
    ds.seed_member("TOMTZ.JCL.CNTL", "IEBGENER", TOMTZ_JCL_IEBGENER, userid="TOMTZ")
    ds.seed_member("TOMTZ.JCL.CNTL", "IDCAMS", TOMTZ_JCL_IDCAMS, userid="TOMTZ")
    ds.seed_member("TOMTZ.JCL.CNTL", "LISTCAT", TOMTZ_JCL_LISTCAT, userid="TOMTZ")
    ds.seed_member("TOMTZ.JCL.CNTL", "SORTJOB", TOMTZ_JCL_SORTJOB, userid="TOMTZ")
    ds.seed_member("TOMTZ.JCL.CNTL", "COBRUN", TOMTZ_JCL_COBRUN, userid="TOMTZ")
    ds.seed_member("TOMTZ.JCL.CNTL", "BACKUP", TOMTZ_JCL_BACKUP, userid="TOMTZ")

    ds.seed_pds("TOMTZ.COBOL.SRC", volser="USR001")
    ds.seed_member("TOMTZ.COBOL.SRC", "HELLO", TOMTZ_COBOL_HELLO, userid="TOMTZ")
    ds.seed_member("TOMTZ.COBOL.SRC", "PAYROLL", TOMTZ_COBOL_PAYROLL, userid="TOMTZ")

    ds.seed_pds("TOMTZ.LOAD", volser="USR001", lrecl=0)
    ds.seed_member("TOMTZ.LOAD", "HELLO", "** HELLO LOAD MODULE (COMPILED COBOL) **")

    ds.seed_ps("TOMTZ.DATA.SEQ", TOMTZ_DATA_SEQ, volser="USR001")

    # ISPF profile dataset
    ds.seed_pds("TOMTZ.ISPF.ISPPROF", volser="USR001")
    ds.seed_member("TOMTZ.ISPF.ISPPROF", "ISRPARM",  ISPF_ISRPARM,  userid="TOMTZ")
    ds.seed_member("TOMTZ.ISPF.ISPPROF", "ISRSCAN",  ISPF_ISRSCAN,  userid="TOMTZ")
    ds.seed_member("TOMTZ.ISPF.ISPPROF", "ISRCOLOR", ISPF_ISRCOLOR, userid="TOMTZ")

    # REXX exec library
    ds.seed_pds("TOMTZ.REXX.EXEC", volser="USR001")
    ds.seed_member("TOMTZ.REXX.EXEC", "HELLO",   TOMTZ_REXX_HELLO,   userid="TOMTZ")
    ds.seed_member("TOMTZ.REXX.EXEC", "LOOP",    TOMTZ_REXX_LOOP,    userid="TOMTZ")
    ds.seed_member("TOMTZ.REXX.EXEC", "SYSINFO", TOMTZ_REXX_SYSINFO, userid="TOMTZ")
    ds.seed_member("TOMTZ.REXX.EXEC", "FIB",     TOMTZ_REXX_FIB,     userid="TOMTZ")

    # IBMUSER system datasets — RACF-protected
    ds.seed_pds("IBMUSER.RACF.DB", volser="MVSRES")
    ds.seed_member("IBMUSER.RACF.DB", "RACFDB", IBMUSER_RACF, userid="IBMUSER")
    ds._catalog["IBMUSER.RACF.DB"].restricted = True

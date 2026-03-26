"""
Shell command parser for the Mainframe Simulator terminal.
Dispatches raw command strings to VFSEngine and DatasetEngine operations.
"""
from __future__ import annotations
import shlex
from typing import Tuple
from app.core.vfs_engine import VFSEngine, VFSError
from app.core.dataset_engine import DatasetEngine, DatasetError
from app.models.vfs import NodeType


def _apply_pipe_filter(text: str, stage: str) -> str:
    """Apply a simple pipe filter (grep, sort, head, tail, wc, uniq) to text."""
    try:
        tokens = shlex.split(stage)
    except ValueError:
        return text
    if not tokens:
        return text
    cmd = tokens[0].lower()
    args = tokens[1:]
    lines = text.splitlines()

    if cmd == "grep":
        invert = "-v" in args
        case_insensitive = "-i" in args
        flag_args = {a for a in args if a.startswith("-")}
        patterns = [a for a in args if a not in flag_args]
        if not patterns:
            return text
        pat = patterns[0]
        if case_insensitive:
            result = [l for l in lines if (pat.lower() in l.lower()) != invert]
        else:
            result = [l for l in lines if (pat in l) != invert]
        return "\n".join(result)

    elif cmd == "sort":
        reverse = "-r" in args
        return "\n".join(sorted(lines, reverse=reverse))

    elif cmd == "head":
        n = 10
        for a in args:
            if a.startswith("-") and a[1:].isdigit():
                n = int(a[1:])
        return "\n".join(lines[:n])

    elif cmd == "tail":
        n = 10
        for a in args:
            if a.startswith("-") and a[1:].isdigit():
                n = int(a[1:])
        return "\n".join(lines[-n:])

    elif cmd == "wc":
        if "-l" in args:
            return str(len(lines))
        if "-w" in args:
            return str(sum(len(l.split()) for l in lines))
        if "-c" in args:
            return str(len(text))
        # default: lines words chars
        return f"{len(lines):8}  {sum(len(l.split()) for l in lines):8}  {len(text):8}"

    elif cmd == "uniq":
        seen: set = set()
        result = []
        for l in lines:
            if l not in seen:
                seen.add(l)
                result.append(l)
        return "\n".join(result)

    return text


def _check_racf(dsn: str, username: str, datasets: DatasetEngine) -> "str | None":
    """Return ICH408I error message if RACF blocks access, else None."""
    try:
        d = datasets.get_dataset(dsn)
        if d.restricted and username.upper() != "IBMUSER":
            return (
                f"ICH408I USER({username.upper()}) GROUP(SYS1) NAME({username.upper()})\n"
                f"  {dsn} CL(DATASET)\n"
                f"  INSUFFICIENT AUTHORITY -- RACF RETURN CODE 8\n"
                f"IKJ56709I INSUFFICIENT AUTHORITY"
            )
    except DatasetError:
        pass
    return None


def _fmt_size(size: int) -> str:
    if size < 1024:
        return str(size)
    elif size < 1024 * 1024:
        return f"{size // 1024}K"
    return f"{size // (1024 * 1024)}M"


def _ls_long(node, cwd: str) -> str:
    t = "d" if node.node_type == NodeType.DIRECTORY else "-"
    return f"{t}{node.permissions:<9}  {node.owner:<8}  {node.group:<8}  {_fmt_size(node.size):>6}  {node.modified.strftime('%b %d %H:%M')}  {node.name}"


def execute_command(
    raw: str,
    session_id: str,
    username: str,
    vfs: VFSEngine,
    datasets: DatasetEngine,
) -> Tuple[str, str, int]:
    """
    Parse and execute a shell command.
    Returns: (output_text, new_cwd, exit_code)
    """
    cwd = vfs.get_cwd(session_id)

    if not raw.strip():
        return "", cwd, 0

    # Handle pipe: cmd1 | cmd2 | cmd3
    # Must check before redirect (redirect is on the last stage only)
    if " | " in raw:
        # Split last redirect off the last stage if present
        last_redirect = None
        pipe_parts = raw.split(" | ")
        last_stage = pipe_parts[-1]
        if " > " in last_stage:
            last_stage, last_redirect = last_stage.split(" > ", 1)
            pipe_parts[-1] = last_stage.strip()
            last_redirect = last_redirect.strip()
        # Execute first command (which may itself be complex)
        first_raw = pipe_parts[0].strip()
        output, new_cwd, exit_code = execute_command(first_raw, session_id, username, vfs, datasets)
        # Apply subsequent pipe stages
        for stage in pipe_parts[1:]:
            output = _apply_pipe_filter(output, stage.strip())
        # Apply optional redirect on final output
        if last_redirect:
            target = vfs._normalize(last_redirect, cwd=cwd, username=username.lower())
            vfs.write(target, output, owner=username)
            return "", new_cwd, 0
        return output, new_cwd, exit_code

    # Handle simple output redirect: echo foo > /path/file
    redirect_target = None
    if " > " in raw:
        parts = raw.split(" > ", 1)
        raw = parts[0].strip()
        redirect_target = parts[1].strip()

    try:
        tokens = shlex.split(raw)
    except ValueError as e:
        return f"parse error: {e}", cwd, 1

    if not tokens:
        return "", cwd, 0

    cmd = tokens[0].lower()
    args = tokens[1:]

    def _resolve_path(p: str) -> str:
        return vfs._normalize(p, cwd=cwd, username=username.lower())

    def _output(text: str) -> Tuple[str, str, int]:
        if redirect_target:
            target = _resolve_path(redirect_target)
            vfs.write(target, text, owner=username)
            return "", cwd, 0
        return text, cwd, 0

    # ------------------------------------------------------------------
    # pwd
    # ------------------------------------------------------------------
    if cmd == "pwd":
        return _output(cwd)

    # ------------------------------------------------------------------
    # whoami
    # ------------------------------------------------------------------
    if cmd == "whoami":
        return _output(username)

    # ------------------------------------------------------------------
    # hostname
    # ------------------------------------------------------------------
    if cmd == "hostname":
        return _output("MVS38J")

    # ------------------------------------------------------------------
    # uname
    # ------------------------------------------------------------------
    if cmd == "uname":
        return _output("MVS 3.8J IBM/390 z/OS USS")

    # ------------------------------------------------------------------
    # clear
    # ------------------------------------------------------------------
    if cmd == "clear":
        return "__CLEAR__", cwd, 0

    # ------------------------------------------------------------------
    # help
    # ------------------------------------------------------------------
    if cmd == "help":
        help_text = (
            "MVS 3.8J USS Shell - Available Commands\n"
            "════════════════════════════════════════\n"
            "File System:\n"
            "  pwd              Print working directory\n"
            "  ls [-la] [path]  List directory contents\n"
            "  cd [path]        Change directory (~ = home)\n"
            "  cat <file>       Print file contents\n"
            "  mkdir [-p] <dir> Create directory\n"
            "  touch <file>     Create empty file\n"
            "  rm [-r] <path>   Remove file or directory\n"
            "  cp <src> <dst>   Copy file\n"
            "  mv <src> <dst>   Move / rename\n"
            "  echo <text>      Print text (supports > redirect)\n"
            "  sort [-r] <file> Sort lines of a file\n"
            "  find <path> [-name <pat>]  Search for files\n"
            "  diff <f1> <f2>   Compare two files\n"
            "\n"
            "System:\n"
            "  whoami           Current username\n"
            "  hostname         System hostname\n"
            "  uname -a         OS information\n"
            "  env              Show environment variables\n"
            "  export VAR=val   Set environment variable\n"
            "  ps               List active processes\n"
            "  clear            Clear terminal\n"
            "\n"
            "MVS Datasets:\n"
            "  ds list [FILTER] List datasets (supports * wildcard)\n"
            "  ds members <DSN> List PDS members\n"
            "  ds read <DSN(M)> Read PDS member\n"
            "  ds cat <DSN>     Print sequential dataset\n"
            "\n"
            "TSO Commands:\n"
            "  listcat [ENT('pat')]       List catalog entries\n"
            "  listds 'DSN'               Show dataset details\n"
            "  allocate DSN('MY.DS') DSORG(PO) LRECL(80)  Allocate dataset\n"
            "  delete 'DSN' or 'DSN(MBR)'  Delete dataset/member\n"
            "  rename 'OLD.DSN' 'NEW.DSN'  Rename dataset\n"
            "\n"
            "  help             Show this help\n"
        )
        return _output(help_text)

    # ------------------------------------------------------------------
    # ls
    # ------------------------------------------------------------------
    if cmd == "ls":
        long_fmt = "-la" in args or "-l" in args or "-a" in args
        long_fmt = long_fmt or any(a.startswith("-") and "l" in a for a in args)
        paths = [a for a in args if not a.startswith("-")]
        target = _resolve_path(paths[0]) if paths else cwd
        try:
            children = vfs.listdir(target)
        except VFSError as e:
            return str(e), cwd, 1
        if not children:
            return "", cwd, 0
        if long_fmt:
            lines = [f"total {len(children)}"]
            lines += [_ls_long(n, target) for n in sorted(children, key=lambda x: x.name)]
            return _output("\n".join(lines))
        else:
            names = [
                (n.name + "/" if n.node_type == NodeType.DIRECTORY else n.name)
                for n in sorted(children, key=lambda x: x.name)
            ]
            return _output("  ".join(names))

    # ------------------------------------------------------------------
    # cd
    # ------------------------------------------------------------------
    if cmd == "cd":
        target = _resolve_path(args[0]) if args else f"/u/{username.lower()}"
        node = vfs.resolve(target)
        if node is None:
            return f"cd: {target}: No such file or directory", cwd, 1
        if node.node_type != NodeType.DIRECTORY:
            return f"cd: {target}: Not a directory", cwd, 1
        vfs.set_cwd(session_id, target)
        return "", target, 0

    # ------------------------------------------------------------------
    # cat
    # ------------------------------------------------------------------
    if cmd == "cat":
        if not args:
            return "cat: missing operand", cwd, 1
        target = _resolve_path(args[0])
        try:
            content = vfs.readfile(target)
            return _output(content)
        except VFSError as e:
            return str(e), cwd, 1

    # ------------------------------------------------------------------
    # mkdir
    # ------------------------------------------------------------------
    if cmd == "mkdir":
        parents = "-p" in args
        paths = [a for a in args if not a.startswith("-")]
        if not paths:
            return "mkdir: missing operand", cwd, 1
        try:
            vfs.mkdir(_resolve_path(paths[0]), owner=username, parents=parents)
            return "", cwd, 0
        except VFSError as e:
            return str(e), cwd, 1

    # ------------------------------------------------------------------
    # touch
    # ------------------------------------------------------------------
    if cmd == "touch":
        if not args:
            return "touch: missing file operand", cwd, 1
        try:
            vfs.touch(_resolve_path(args[0]), owner=username)
            return "", cwd, 0
        except VFSError as e:
            return str(e), cwd, 1

    # ------------------------------------------------------------------
    # rm
    # ------------------------------------------------------------------
    if cmd == "rm":
        recursive = "-r" in args or "-rf" in args or "-fr" in args
        paths = [a for a in args if not a.startswith("-")]
        if not paths:
            return "rm: missing operand", cwd, 1
        try:
            vfs.remove(_resolve_path(paths[0]), recursive=recursive)
            return "", cwd, 0
        except VFSError as e:
            return str(e), cwd, 1

    # ------------------------------------------------------------------
    # echo
    # ------------------------------------------------------------------
    if cmd == "echo":
        text = " ".join(args)
        return _output(text + "\n")

    # ------------------------------------------------------------------
    # cp
    # ------------------------------------------------------------------
    if cmd == "cp":
        if len(args) < 2:
            return "cp: missing destination", cwd, 1
        try:
            vfs.copy(_resolve_path(args[0]), _resolve_path(args[1]))
            return "", cwd, 0
        except VFSError as e:
            return str(e), cwd, 1

    # ------------------------------------------------------------------
    # mv
    # ------------------------------------------------------------------
    if cmd == "mv":
        if len(args) < 2:
            return "mv: missing destination", cwd, 1
        try:
            vfs.move(_resolve_path(args[0]), _resolve_path(args[1]))
            return "", cwd, 0
        except VFSError as e:
            return str(e), cwd, 1

    # ------------------------------------------------------------------
    # ds - MVS dataset commands
    # ------------------------------------------------------------------
    if cmd == "ds":
        if not args:
            return "Usage: ds list|members|read|cat [args]", cwd, 1
        sub = args[0].lower()

        if sub == "list":
            pattern = args[1] if len(args) > 1 else None
            dss = datasets.list_datasets(pattern)
            if not dss:
                return "No datasets found.", cwd, 0
            header = f"{'DSN':<44} {'ORG':<5} {'RECFM':<6} {'LRECL':>5} {'VOLSER':<8} CHANGED"
            separator = "─" * 80
            lines = [header, separator]
            for d in dss:
                lines.append(
                    f"{d.dsn:<44} {d.dsorg.value:<5} {d.recfm.value:<6} {d.lrecl:>5} {d.volser:<8} {d.changed}"
                )
            return _output("\n".join(lines))

        def _racf_check(dsn: str) -> "str | None":
            return _check_racf(dsn, username, datasets)

        if sub == "members":
            if len(args) < 2:
                return "Usage: ds members <DSN>", cwd, 1
            dsn = args[1].upper()
            if (racf_err := _racf_check(dsn)):
                return racf_err, cwd, 8
            try:
                d = datasets.get_dataset(dsn)
                if not d.members:
                    return f"{dsn} has no members.", cwd, 0
                header = f"{'NAME':<9} {'SIZE':>6}  {'CHANGED':<17}  USERID"
                separator = "─" * 50
                lines = [header, separator]
                for m in sorted(d.members.values(), key=lambda x: x.name):
                    lines.append(f"{m.name:<9} {m.size:>6}  {m.changed:<17}  {m.userid}")
                return _output("\n".join(lines))
            except DatasetError as e:
                return str(e), cwd, 1

        if sub == "read":
            if len(args) < 2:
                return "Usage: ds read <DSN(MEMBER)>", cwd, 1
            spec = args[1].upper()
            if "(" in spec and spec.endswith(")"):
                dsn, member = spec[:-1].split("(", 1)
            else:
                return "Usage: ds read <DSN(MEMBER)>  -- parenthesis notation required", cwd, 1
            if (racf_err := _racf_check(dsn)):
                return racf_err, cwd, 8
            try:
                m = datasets.get_member(dsn, member)
                return _output(m.content)
            except DatasetError as e:
                return str(e), cwd, 1

        if sub == "cat":
            if len(args) < 2:
                return "Usage: ds cat <DSN>", cwd, 1
            dsn = args[1].upper()
            if (racf_err := _racf_check(dsn)):
                return racf_err, cwd, 8
            try:
                d = datasets.get_dataset(dsn)
                if d.dsorg.value != "PS":
                    return f"{dsn} is a PDS — use 'ds members' and 'ds read'", cwd, 1
                return _output(d.content or "")
            except DatasetError as e:
                return str(e), cwd, 1

        return f"ds: unknown subcommand '{sub}'. Try: list, members, read, cat", cwd, 1

    # ------------------------------------------------------------------
    # grep
    # ------------------------------------------------------------------
    if cmd == "grep":
        flags = [a for a in args if a.startswith("-")]
        positional = [a for a in args if not a.startswith("-")]
        if len(positional) < 2:
            return "Usage: grep <pattern> <file>", cwd, 1
        pattern, filepath = positional[0], positional[1]
        ignore_case = "-i" in flags
        try:
            content = vfs.readfile(_resolve_path(filepath))
        except VFSError as e:
            return str(e), cwd, 1
        results = []
        for lineno, line in enumerate(content.splitlines(), 1):
            haystack = line.lower() if ignore_case else line
            needle = pattern.lower() if ignore_case else pattern
            if needle in haystack:
                results.append(f"{lineno}:{line}")
        if not results:
            return "", cwd, 1
        return _output("\n".join(results))

    # ------------------------------------------------------------------
    # head
    # ------------------------------------------------------------------
    if cmd == "head":
        n = 10
        paths = []
        i = 0
        while i < len(args):
            if args[i] in ("-n", "--lines") and i + 1 < len(args):
                try: n = int(args[i + 1])
                except ValueError: pass
                i += 2
            elif args[i].startswith("-n") and len(args[i]) > 2:
                try: n = int(args[i][2:])
                except ValueError: pass
                i += 1
            else:
                paths.append(args[i])
                i += 1
        if not paths:
            return "head: missing file operand", cwd, 1
        try:
            content = vfs.readfile(_resolve_path(paths[0]))
        except VFSError as e:
            return str(e), cwd, 1
        return _output("\n".join(content.splitlines()[:n]))

    # ------------------------------------------------------------------
    # tail
    # ------------------------------------------------------------------
    if cmd == "tail":
        n = 10
        paths = []
        i = 0
        while i < len(args):
            if args[i] in ("-n", "--lines") and i + 1 < len(args):
                try: n = int(args[i + 1])
                except ValueError: pass
                i += 2
            elif args[i].startswith("-n") and len(args[i]) > 2:
                try: n = int(args[i][2:])
                except ValueError: pass
                i += 1
            else:
                paths.append(args[i])
                i += 1
        if not paths:
            return "tail: missing file operand", cwd, 1
        try:
            content = vfs.readfile(_resolve_path(paths[0]))
        except VFSError as e:
            return str(e), cwd, 1
        return _output("\n".join(content.splitlines()[-n:]))

    # ------------------------------------------------------------------
    # wc
    # ------------------------------------------------------------------
    if cmd == "wc":
        count_flags = [a for a in args if a.startswith("-")]
        paths = [a for a in args if not a.startswith("-")]
        if not paths:
            return "wc: missing file operand", cwd, 1
        try:
            content = vfs.readfile(_resolve_path(paths[0]))
        except VFSError as e:
            return str(e), cwd, 1
        line_count = len(content.splitlines())
        word_count = len(content.split())
        char_count = len(content)
        if "-l" in count_flags:
            return _output(str(line_count))
        if "-w" in count_flags:
            return _output(str(word_count))
        if "-c" in count_flags:
            return _output(str(char_count))
        return _output(f"{line_count:>8} {word_count:>8} {char_count:>8} {paths[0]}")

    # ------------------------------------------------------------------
    # chmod
    # ------------------------------------------------------------------
    if cmd == "chmod":
        if len(args) < 2:
            return "Usage: chmod <mode> <path>", cwd, 1
        mode, target_path = args[0], _resolve_path(args[1])
        node = vfs.resolve(target_path)
        if node is None:
            return f"chmod: {target_path}: No such file or directory", cwd, 1
        # Store the mode string on the node
        node.permissions = mode[:9].ljust(9, "-")
        return "", cwd, 0

    # ------------------------------------------------------------------
    # submit
    # ------------------------------------------------------------------
    if cmd == "submit":
        if not args:
            return "Usage: submit <jcl-file>", cwd, 1
        target_path = _resolve_path(args[0])
        try:
            content = vfs.readfile(target_path)
        except VFSError as e:
            return str(e), cwd, 1
        if not content.strip().startswith("//"):
            return f"IEF236I {args[0]} - JCL SYNTAX ERROR - NOT A VALID JCL MEMBER", cwd, 1
        from app import dependencies as _deps
        try:
            job = _deps.job_engine.submit(content, username)
        except ValueError as e:
            return str(e), cwd, 1
        return _output(
            f"IEF236I SUBMIT {args[0]}\n"
            f"IEF237I JES2 JOB QUEUE ACCEPTED\n"
            f"IEF233I JOBNAME={job.jobname:<8} JOBID={job.jobid}"
        )

    # ------------------------------------------------------------------
    # write (one-liner file write)
    # ------------------------------------------------------------------
    if cmd == "write":
        if len(args) < 2:
            return "Usage: write <path> <content>", cwd, 1
        target_path = _resolve_path(args[0])
        content = " ".join(args[1:])
        try:
            vfs.write(target_path, content, owner=username)
            return "", cwd, 0
        except VFSError as e:
            return str(e), cwd, 1

    # ------------------------------------------------------------------
    # vi / edit — redirect to GUI editor hint
    # ------------------------------------------------------------------
    if cmd in ("vi", "vim", "edit"):
        if not args:
            return f"{cmd}: missing file operand", cwd, 1
        return _output(
            f"ISPF EDIT panel opens for {args[0]} — use the GUI editor (E line command in USS Browser)"
        )

    # ------------------------------------------------------------------
    # sort — sort lines of a file
    # ------------------------------------------------------------------
    if cmd == "sort":
        paths = [a for a in args if not a.startswith("-")]
        if not paths:
            return "sort: missing file operand", cwd, 1
        reverse = "-r" in args
        try:
            content = vfs.readfile(_resolve_path(paths[0]))
        except VFSError as e:
            return str(e), cwd, 1
        sorted_lines = sorted(content.splitlines(), reverse=reverse)
        return _output("\n".join(sorted_lines))

    # ------------------------------------------------------------------
    # find — search for files in directory tree
    # ------------------------------------------------------------------
    if cmd == "find":
        search_path = args[0] if args and not args[0].startswith("-") else cwd
        name_pat = None
        i = 0
        while i < len(args):
            if args[i] == "-name" and i + 1 < len(args):
                name_pat = args[i + 1]
                i += 2
            else:
                i += 1
        search_root = _resolve_path(search_path)

        results = []
        def _walk(node_path: str) -> None:
            node = vfs.resolve(node_path)
            if node is None:
                return
            if node.node_type.value == "DIRECTORY":
                try:
                    children = vfs.listdir(node_path)
                    for child in children:
                        child_path = f"{node_path}/{child.name}".replace("//", "/")
                        if name_pat is None or _fnmatch_simple(child.name, name_pat):
                            results.append(child_path)
                        _walk(child_path)
                except Exception:
                    pass

        def _fnmatch_simple(name: str, pattern: str) -> bool:
            import fnmatch as _fnmatch
            return _fnmatch.fnmatch(name, pattern)

        _walk(search_root)
        return _output("\n".join(results) if results else "")

    # ------------------------------------------------------------------
    # diff — compare two files
    # ------------------------------------------------------------------
    if cmd == "diff":
        if len(args) < 2:
            return "Usage: diff <file1> <file2>", cwd, 1
        try:
            content1 = vfs.readfile(_resolve_path(args[0]))
            content2 = vfs.readfile(_resolve_path(args[1]))
        except VFSError as e:
            return str(e), cwd, 1
        lines1 = content1.splitlines()
        lines2 = content2.splitlines()
        if lines1 == lines2:
            return _output("")
        results = []
        max_len = max(len(lines1), len(lines2))
        for i in range(max_len):
            l1 = lines1[i] if i < len(lines1) else None
            l2 = lines2[i] if i < len(lines2) else None
            if l1 != l2:
                if l1 is None:
                    results.append(f"> {l2}")
                elif l2 is None:
                    results.append(f"< {l1}")
                else:
                    results.append(f"{i+1}c{i+1}")
                    results.append(f"< {l1}")
                    results.append(f"---")
                    results.append(f"> {l2}")
        return _output("\n".join(results))

    # ------------------------------------------------------------------
    # env — show environment variables
    # ------------------------------------------------------------------
    if cmd == "env":
        env_vars = [
            f"HOME=/u/{username.lower()}",
            f"USER={username.upper()}",
            f"LOGNAME={username.upper()}",
            "SHELL=/bin/sh",
            "PATH=/bin:/usr/bin:/usr/lbin",
            "LANG=C",
            "SYSNAME=MVS38J",
            "SYSPLEX=HERC01",
            f"TSOPROC=TSOPROC",
            f"TSOPREFIX={username.upper()}",
            "ISPF_CODEPAGE=IBM-1047",
        ]
        return _output("\n".join(env_vars))

    # ------------------------------------------------------------------
    # export — set environment variable (stub)
    # ------------------------------------------------------------------
    if cmd == "export":
        if not args:
            return "", cwd, 0
        return _output(f"export: {args[0]}")

    # ------------------------------------------------------------------
    # ps — list processes (stub)
    # ------------------------------------------------------------------
    if cmd == "ps":
        header = "  PID TTY          TIME CMD"
        procs = [
            f"    1 ?        00:00:01 init",
            f"   42 ?        00:00:05 JES2",
            f"  101 ?        00:00:02 TCPIP",
            f"  202 pts/0    00:00:00 sh",
            f"  203 pts/0    00:00:00 ps",
        ]
        return _output(header + "\n" + "\n".join(procs))

    # ------------------------------------------------------------------
    # kill — send signal to process (stub)
    # ------------------------------------------------------------------
    if cmd == "kill":
        if not args:
            return "kill: missing operand", cwd, 1
        pid = args[-1]
        return _output(f"kill: ({pid}) - Operation not permitted")

    # ------------------------------------------------------------------
    # listcat / lcat — list catalog entries (TSO command)
    # ------------------------------------------------------------------
    if cmd in ("listcat", "lcat"):
        # LISTCAT ENT('pattern') or LISTCAT LEVEL('prefix')
        pattern = None
        for a in args:
            a_upper = a.upper()
            if a_upper.startswith("ENT(") or a_upper.startswith("ENTRY("):
                inner = a[a.index("(") + 1:].rstrip(")").strip("'\"")
                pattern = inner
            elif a_upper.startswith("LEVEL(") or a_upper.startswith("LVL("):
                inner = a[a.index("(") + 1:].rstrip(")").strip("'\"")
                pattern = inner + ".*"
        if not pattern and args:
            # bare pattern
            pattern = args[0].strip("'\"")
        dss = datasets.list_datasets(pattern)
        if not dss:
            return _output("IDC3012I ENTRY NOT FOUND"), cwd, 4
        lines_out = [f"LISTCAT   LEVEL('{pattern or '*'}')"]
        lines_out.append("─" * 60)
        for d in dss:
            lines_out.append(f"  {d.dsorg.value:<5}  ------- {d.dsn}")
        return _output("\n".join(lines_out))

    # ------------------------------------------------------------------
    # listds — show dataset details (TSO command)
    # ------------------------------------------------------------------
    if cmd == "listds":
        if not args:
            return "Usage: listds 'DSN'", cwd, 1
        dsn = args[0].strip("'\"").upper()
        try:
            d = datasets.get_dataset(dsn)
        except DatasetError as e:
            return str(e), cwd, 8
        lines_out = [
            f"LISTDS '{dsn}'",
            "─" * 50,
            f"  --RECFM-LRECL-BLKSIZE-DSORG",
            f"    {d.recfm.value:<6}{d.lrecl:<6}{d.blksize:<8}{d.dsorg.value}",
            f"  --VOLUMES--",
            f"    {d.volser}",
        ]
        if d.dsorg.value == "PO" and d.members:
            lines_out.append("  --MEMBERS--")
            for m in sorted(d.members.keys()):
                lines_out.append(f"    {m}")
        return _output("\n".join(lines_out))

    # ------------------------------------------------------------------
    # allocate / alloc — allocate a new dataset (TSO command)
    # ------------------------------------------------------------------
    if cmd in ("allocate", "alloc"):
        # Parse: ALLOC DSN('my.ds') NEW CATALOG DSORG(PO) RECFM(FB) LRECL(80)
        dsn = None
        dsorg_val = "PS"
        recfm_val = "FB"
        lrecl_val = 80
        blksize_val = 3200
        volser_val = "USR001"
        for a in args:
            a_upper = a.upper()
            if a_upper.startswith("DSN(") or a_upper.startswith("DATASET("):
                dsn = a[a.index("(") + 1:].rstrip(")").strip("'\"").upper()
            elif a_upper.startswith("DSORG("):
                dsorg_val = a[6:].rstrip(")").upper()
            elif a_upper.startswith("RECFM("):
                recfm_val = a[6:].rstrip(")").upper()
            elif a_upper.startswith("LRECL("):
                try: lrecl_val = int(a[6:].rstrip(")"))
                except ValueError: pass
            elif a_upper.startswith("BLKSIZE("):
                try: blksize_val = int(a[8:].rstrip(")"))
                except ValueError: pass
            elif a_upper.startswith("VOLUME(") or a_upper.startswith("VOL("):
                volser_val = a[a.index("(") + 1:].rstrip(")").upper()
        if not dsn:
            return "ALLOC: DSN parameter required. Usage: ALLOC DSN('MY.DS') DSORG(PO) LRECL(80)", cwd, 8
        from app.models.dataset import DSOrg, RecFM
        try:
            dsorg_enum = DSOrg(dsorg_val) if dsorg_val in ("PS", "PO", "VSAM") else DSOrg.PS
            recfm_enum = RecFM(recfm_val) if recfm_val in ("FB", "VB", "U") else RecFM.FB
            datasets.allocate(dsn, dsorg_enum, recfm_enum, lrecl_val, blksize_val, volser_val)
            return _output(
                f"IKJ56500I DATASET '{dsn}' ALLOCATED TO DDNAME ALLOC\n"
                f"IKJ56501I DSORG={dsorg_val} RECFM={recfm_val} LRECL={lrecl_val} BLKSIZE={blksize_val} VOL={volser_val}"
            )
        except DatasetError as e:
            return f"IKJ56502I {e}", cwd, 8

    # ------------------------------------------------------------------
    # delete / del — delete a dataset or member (TSO command)
    # ------------------------------------------------------------------
    if cmd in ("delete", "del"):
        if not args:
            return "Usage: delete 'DSN' or delete 'DSN(MEMBER)'", cwd, 1
        spec = args[0].strip("'\"").upper()
        if "(" in spec and spec.endswith(")"):
            dsn_part, member_part = spec[:-1].split("(", 1)
            try:
                datasets.delete_member(dsn_part, member_part)
                return _output(f"IKJ56500I MEMBER '{member_part}' DELETED FROM '{dsn_part}'")
            except DatasetError as e:
                return f"IKJ56502I {e}", cwd, 8
        else:
            try:
                datasets.delete_dataset(spec)
                return _output(f"IKJ56500I DATASET '{spec}' DELETED")
            except DatasetError as e:
                return f"IKJ56502I {e}", cwd, 8

    # ------------------------------------------------------------------
    # rename — rename a dataset (TSO command)
    # ------------------------------------------------------------------
    if cmd == "rename":
        if len(args) < 2:
            return "Usage: rename 'OLD.DSN' 'NEW.DSN'", cwd, 1
        old_dsn = args[0].strip("'\"").upper()
        new_dsn = args[1].strip("'\"").upper()
        try:
            old_ds = datasets.get_dataset(old_dsn)
        except DatasetError as e:
            return f"IKJ56502I {e}", cwd, 8
        if new_dsn in [d.dsn for d in datasets.list_datasets()]:
            return f"IKJ56502I DATASET '{new_dsn}' ALREADY EXISTS", cwd, 8
        # Rename: copy catalog entry with new name, delete old
        from app.models.dataset import DSOrg
        old_ds.dsn = new_dsn
        datasets._catalog[new_dsn] = old_ds
        del datasets._catalog[old_dsn]
        return _output(f"IKJ56500I DATASET RENAMED FROM '{old_dsn}' TO '{new_dsn}'")

    # ------------------------------------------------------------------
    # exec / rexx / ex — execute a REXX program from a PDS member
    # ------------------------------------------------------------------
    if cmd in ("exec", "rexx", "ex"):
        if not args:
            return "Usage: exec 'DSN(MEMBER)'  or  rexx 'DSN(MEMBER)'", cwd, 1
        spec = args[0].strip("'\"").upper()
        if "(" in spec and spec.endswith(")"):
            dsn, member = spec[:-1].split("(", 1)
        else:
            # Try appending exec from TOMTZ.REXX.EXEC by default
            dsn = f"{username.upper()}.REXX.EXEC"
            member = spec
        if (racf_err := _check_racf(dsn, username, datasets)):
            return racf_err, cwd, 8
        try:
            m = datasets.get_member(dsn, member)
        except DatasetError as e:
            return f"IKJ56502I EXEC: {e}", cwd, 8
        from app.core.rexx_interpreter import RexxInterpreter
        interp = RexxInterpreter()
        interp.vars['SYSUID'] = username.upper()
        out, rc = interp.run(m.content)
        return _output(out), cwd, rc

    # ------------------------------------------------------------------
    # Unknown command
    # ------------------------------------------------------------------
    return f"-sh: {cmd}: command not found", cwd, 127

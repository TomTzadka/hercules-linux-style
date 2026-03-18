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
            "\n"
            "System:\n"
            "  whoami           Current username\n"
            "  hostname         System hostname\n"
            "  uname -a         OS information\n"
            "  clear            Clear terminal\n"
            "\n"
            "MVS Datasets:\n"
            "  ds list [FILTER] List datasets (supports * wildcard)\n"
            "  ds members <DSN> List PDS members\n"
            "  ds read <DSN(M)> Read PDS member\n"
            "  ds cat <DSN>     Print sequential dataset\n"
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

        if sub == "members":
            if len(args) < 2:
                return "Usage: ds members <DSN>", cwd, 1
            dsn = args[1].upper()
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
            try:
                m = datasets.get_member(dsn, member)
                return _output(m.content)
            except DatasetError as e:
                return str(e), cwd, 1

        if sub == "cat":
            if len(args) < 2:
                return "Usage: ds cat <DSN>", cwd, 1
            dsn = args[1].upper()
            try:
                d = datasets.get_dataset(dsn)
                if d.dsorg.value != "PS":
                    return f"{dsn} is a PDS — use 'ds members' and 'ds read'", cwd, 1
                return _output(d.content or "")
            except DatasetError as e:
                return str(e), cwd, 1

        return f"ds: unknown subcommand '{sub}'. Try: list, members, read, cat", cwd, 1

    # ------------------------------------------------------------------
    # Unknown command
    # ------------------------------------------------------------------
    return f"-sh: {cmd}: command not found", cwd, 127

"""
Simple REXX interpreter for the Mainframe Simulator.
Supports: SAY, assignment, IF/THEN/DO/END, DO loops, EXIT, /* comments */.
"""
from __future__ import annotations
import ast
import operator
import re
import time
from typing import Any


# Safe comparison operators — used instead of eval() in _eval_cond
_CMP_OPS = {
    '==': operator.eq, '!=': operator.ne,
    '>=': operator.ge, '<=': operator.le,
    '>':  operator.gt, '<':  operator.lt,
}


class RexxError(Exception):
    pass


class RexxInterpreter:
    MAX_ITERATIONS = 10_000
    MAX_OUTPUT_LINES = 1_000
    MAX_EXEC_SECONDS = 5.0

    def __init__(self) -> None:
        self.vars: dict[str, Any] = {
            'RESULT': '0',
            'RC': '0',
            'SYSUID': 'TOMTZ',
            'SYSDATE': '2026/03/26',
            'SYSTIME': '09:00:00',
        }
        self.output: list[str] = []
        self.exit_code: int = 0
        self._iter_count: int = 0
        self._deadline: float = 0.0

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------
    def run(self, source: str) -> tuple[str, int]:
        """Execute REXX source. Returns (output_text, exit_code)."""
        lines = self._strip_comments(source.split('\n'))
        self._deadline = time.monotonic() + self.MAX_EXEC_SECONDS
        try:
            self._exec(lines, 0, len(lines))
        except _ExitSignal as e:
            self.exit_code = e.code
        except RexxError as e:
            self.output.append(f"REXX ERROR: {e}")
            self.exit_code = 12
        return '\n'.join(self.output), self.exit_code

    # ------------------------------------------------------------------
    # Comment stripping
    # ------------------------------------------------------------------
    def _strip_comments(self, lines: list[str]) -> list[str]:
        result: list[str] = []
        in_comment = False
        for line in lines:
            out = ''
            i = 0
            while i < len(line):
                if not in_comment and line[i:i+2] == '/*':
                    in_comment = True
                    i += 2
                elif in_comment and line[i:i+2] == '*/':
                    in_comment = False
                    i += 2
                elif not in_comment:
                    out += line[i]
                    i += 1
                else:
                    i += 1
            result.append(out.rstrip())
        return result

    # ------------------------------------------------------------------
    # Execution engine
    # ------------------------------------------------------------------
    def _exec(self, lines: list[str], start: int, end: int) -> None:
        i = start
        while i < end:
            self._iter_count += 1
            if self._iter_count > self.MAX_ITERATIONS:
                raise RexxError("MAXIMUM ITERATIONS EXCEEDED")
            if time.monotonic() > self._deadline:
                raise RexxError("REXX EXECUTION TIMEOUT — 5 SECONDS EXCEEDED")

            raw = lines[i]
            line = raw.strip()

            if not line:
                i += 1
                continue

            upper = line.upper()

            # ---- SAY ----
            if upper == 'SAY' or upper.startswith('SAY ') or upper.startswith('SAY\t'):
                rest = line[3:].strip()
                if len(self.output) >= self.MAX_OUTPUT_LINES:
                    raise RexxError("REXX OUTPUT LIMIT EXCEEDED")
                self.output.append(str(self._eval(rest)))
                i += 1
                continue

            # ---- EXIT ----
            if upper == 'EXIT' or upper.startswith('EXIT '):
                rest = line[4:].strip()
                code = int(self._eval_num(rest)) if rest else 0
                raise _ExitSignal(code)

            # ---- RETURN ----
            if upper == 'RETURN' or upper.startswith('RETURN '):
                rest = line[6:].strip()
                if rest:
                    self.vars['RESULT'] = self._eval(rest)
                return

            # ---- LEAVE ----
            if upper == 'LEAVE':
                raise _LeaveSignal()

            # ---- ITERATE ----
            if upper == 'ITERATE':
                raise _IterateSignal()

            # ---- NOP / comment ----
            if upper == 'NOP' or upper.startswith('--'):
                i += 1
                continue

            # ---- IF cond THEN [DO] ----
            m = re.match(r'^IF\s+(.+?)\s+THEN\s*(.*)', line, re.IGNORECASE | re.DOTALL)
            if m:
                cond_str, then_part = m.group(1).strip(), m.group(2).strip()
                cond_val = self._eval_cond(cond_str)
                then_upper = then_part.upper()

                if then_upper == 'DO':
                    end_idx = self._find_end(lines, i + 1, end)
                    if cond_val:
                        try:
                            self._exec(lines, i + 1, end_idx)
                        except _LeaveSignal:
                            pass
                    i = end_idx + 1
                elif then_part:
                    # Inline statement — fake a one-line list
                    if cond_val:
                        self._exec([then_part], 0, 1)
                    i += 1
                else:
                    i += 1
                continue

            # ---- DO var = from TO end [BY step] ----
            m = re.match(
                r'^DO\s+(\w+)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+BY\s+(.+?))?$',
                line, re.IGNORECASE
            )
            if m:
                var = m.group(1).upper()
                from_val = self._eval_num(m.group(2).strip())
                to_val   = self._eval_num(m.group(3).strip())
                by_val   = self._eval_num(m.group(4).strip()) if m.group(4) else 1.0
                end_idx  = self._find_end(lines, i + 1, end)
                cur = from_val
                while (by_val > 0 and cur <= to_val) or (by_val < 0 and cur >= to_val):
                    self.vars[var] = int(cur) if cur == int(cur) else cur
                    try:
                        self._exec(lines, i + 1, end_idx)
                    except _LeaveSignal:
                        break
                    except _IterateSignal:
                        pass
                    cur += by_val
                i = end_idx + 1
                continue

            # ---- DO FOREVER ----
            if upper == 'DO FOREVER':
                end_idx = self._find_end(lines, i + 1, end)
                while True:
                    try:
                        self._exec(lines, i + 1, end_idx)
                    except _LeaveSignal:
                        break
                    except _IterateSignal:
                        pass
                i = end_idx + 1
                continue

            # ---- DO (simple block) ----
            if upper == 'DO':
                end_idx = self._find_end(lines, i + 1, end)
                try:
                    self._exec(lines, i + 1, end_idx)
                except _LeaveSignal:
                    pass
                i = end_idx + 1
                continue

            # ---- END (bare) ----
            if upper == 'END':
                return

            # ---- PARSE VAR var ----
            m = re.match(r'^PARSE\s+VAR\s+(\w+)\s+(.+)$', line, re.IGNORECASE)
            if m:
                src_var = m.group(1).upper()
                target  = m.group(2).strip().upper()
                val = str(self.vars.get(src_var, ''))
                self.vars[target] = val
                i += 1
                continue

            # ---- PARSE VALUE expr WITH vars ----
            m = re.match(r'^PARSE\s+VALUE\s+(.+?)\s+WITH\s+(.+)$', line, re.IGNORECASE)
            if m:
                val_expr, targets = m.group(1).strip(), m.group(2).strip()
                val = str(self._eval(val_expr))
                parts = val.split()
                for j, t in enumerate(targets.split()):
                    self.vars[t.upper()] = parts[j] if j < len(parts) else ''
                i += 1
                continue

            # ---- var = expr (assignment) ----
            m = re.match(r'^(\w+)\s*=\s*(.+)$', line)
            if m:
                var, expr = m.group(1).upper(), m.group(2).strip()
                self.vars[var] = self._eval(expr)
                i += 1
                continue

            # ---- Unknown ----
            i += 1

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _find_end(self, lines: list[str], start: int, end: int) -> int:
        depth = 1
        i = start
        while i < end:
            u = lines[i].strip().upper()
            if u == 'DO' or u.startswith('DO ') or u.startswith('DO\t'):
                depth += 1
            elif u == 'END' or u.startswith('END ') or u.startswith('END\t'):
                depth -= 1
                if depth == 0:
                    return i
            i += 1
        return end - 1

    def _eval(self, expr: str) -> Any:
        """Evaluate an expression, return string or number."""
        expr = expr.strip()
        if not expr:
            return ''

        # String literal
        for q in ("'", '"'):
            if expr.startswith(q) and expr.endswith(q) and len(expr) >= 2:
                return expr[1:-1]

        # Concatenation with ||
        if '||' in expr:
            parts = expr.split('||')
            return ''.join(str(self._eval(p.strip())) for p in parts)

        # Concatenation by adjacent strings/vars: "word1" "word2"
        # (simple: words separated by space but not operators)
        # Skip for now — most programs use ||

        # Variable lookup
        upper = expr.upper()
        if upper in self.vars:
            return self.vars[upper]
        if re.match(r'^[A-Za-z_]\w*$', expr):
            return self.vars.get(upper, expr)  # return var name if undefined

        # Arithmetic
        try:
            return self._eval_num(expr)
        except Exception:
            pass

        return expr

    def _eval_num(self, expr: str) -> float:
        """Evaluate numeric expression."""
        expr = expr.strip()
        if not expr:
            return 0.0

        # Resolve variables first
        resolved = re.sub(
            r'\b([A-Za-z_]\w*)\b',
            lambda m: str(self.vars.get(m.group(1).upper(), m.group(0))),
            expr
        )
        # Remove string quotes
        resolved = re.sub(r"'[^']*'|\"[^\"]*\"", lambda m: m.group(0)[1:-1], resolved)
        try:
            return float(self._safe_eval_num(resolved))
        except Exception:
            return 0.0

    @staticmethod
    def _safe_eval_num(expr: str) -> float:
        """Evaluate a numeric expression safely using AST — no eval()."""
        _OPS = {
            ast.Add: operator.add, ast.Sub: operator.sub,
            ast.Mult: operator.mul, ast.Div: operator.truediv,
            ast.Mod: operator.mod, ast.Pow: operator.pow,
            ast.FloorDiv: operator.floordiv,
        }

        def _node(n: ast.expr) -> float:
            if isinstance(n, ast.Constant):
                return float(n.value)
            if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
                return -_node(n.operand)
            if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.UAdd):
                return _node(n.operand)
            if isinstance(n, ast.BinOp) and type(n.op) in _OPS:
                return _OPS[type(n.op)](_node(n.left), _node(n.right))
            raise ValueError(f"Unsupported node: {ast.dump(n)}")

        tree = ast.parse(expr.strip(), mode='eval')
        return _node(tree.body)

    def _eval_cond(self, cond: str) -> bool:
        """Evaluate a boolean condition."""
        cond = cond.strip()
        ops = [('\\=', '!='), ('¬=', '!='), ('>=', '>='), ('<=', '<='),
               ('>', '>'), ('<', '<'), ('=', '==')]
        for rexx_op, py_op in ops:
            if rexx_op in cond:
                parts = cond.split(rexx_op, 1)
                if len(parts) == 2:
                    left  = str(self._eval(parts[0].strip()))
                    right = str(self._eval(parts[1].strip()))
                    try:
                        return _CMP_OPS[py_op](float(left), float(right))
                    except ValueError:
                        return _CMP_OPS[py_op](left, right)
                    except Exception:
                        return False
        return bool(self._eval(cond))


class _ExitSignal(Exception):
    def __init__(self, code: int = 0):
        self.code = code

class _LeaveSignal(Exception):
    pass

class _IterateSignal(Exception):
    pass

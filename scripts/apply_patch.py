#!/usr/bin/env python3
"""Apply an exact-match edit to a file, safely.

Why this exists: applying edits over ssh with a hand-rolled `text.replace()` fails silently or wrongly,
and `git checkout <sha> -- <path>` on a dirty tree destroys uncommitted work. This refuses the second
and explains the first.

    apply_patch.py FILE OLD_FILE NEW_FILE            # replace text, exactly once
    apply_patch.py FILE OLD_FILE NEW_FILE --all      # replace every occurrence
    apply_patch.py --context FILE "anchor text"      # show what is really there

Exit codes: 0 applied, 2 anchor missing (with context printed), 3 anchor not unique, 4 dirty tree,
5 file missing. A non-zero exit is the point: it can be put in a script or a hook.
"""

from __future__ import annotations

import argparse
import difflib
import pathlib
import subprocess
import sys


def repo_root(path: pathlib.Path) -> pathlib.Path:
    for parent in [path, *path.parents]:
        if (parent / ".git").exists():
            return parent
    return path.parent


def dirty_files(root: pathlib.Path) -> list[str]:
    try:
        out = subprocess.run(
            ["git", "status", "--porcelain"], cwd=root, capture_output=True, text=True, check=True
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return []
    return [line for line in out.splitlines() if line.strip()]


def show_context(text: str, anchor: str, window: int = 3) -> None:
    lines = text.splitlines()
    first = anchor.splitlines()[0] if anchor.splitlines() else anchor
    closest = difflib.get_close_matches(first, lines, n=1, cutoff=0.3)
    if not closest:
        print("anchor not found, and nothing in the file resembles its first line.", file=sys.stderr)
        return
    index = lines.index(closest[0])
    print(f"closest match at line {index + 1}:", file=sys.stderr)
    start = max(0, index - window)
    for number in range(start, min(len(lines), index + window + 1)):
        marker = ">>" if number == index else "  "
        print(f"{marker} {number + 1:4} | {lines[number]}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("file", help="file to edit")
    parser.add_argument("old_file", nargs="?", help="file holding the exact text to replace")
    parser.add_argument("new_file", nargs="?", help="file holding the replacement text")
    parser.add_argument("--all", action="store_true", help="replace every occurrence")
    parser.add_argument("--allow-dirty", action="store_true", help="edit even with uncommitted changes")
    parser.add_argument("--context", metavar="ANCHOR", help="only show what is near this text")
    args = parser.parse_args()

    path = pathlib.Path(args.file)
    if not path.exists():
        print(f"no such file: {path}", file=sys.stderr)
        return 5
    text = path.read_text()

    if args.context:
        show_context(text, args.context)
        return 0

    if not args.old_file or not args.new_file:
        parser.error("OLD_FILE and NEW_FILE are required (or use --context)")

    root = repo_root(path)
    if not args.allow_dirty:
        pending = dirty_files(root)
        if pending:
            print("refusing to edit: the tree has uncommitted changes", file=sys.stderr)
            for line in pending[:10]:
                print(f"  {line}", file=sys.stderr)
            print("commit, stash, or pass --allow-dirty if you mean it.", file=sys.stderr)
            return 4

    old = pathlib.Path(args.old_file).read_text()
    new = pathlib.Path(args.new_file).read_text()
    count = text.count(old)

    if count == 0:
        print("anchor does not appear in the file", file=sys.stderr)
        show_context(text, old)
        return 2
    if count > 1 and not args.all:
        print(f"anchor appears {count} times; pass --all or make it more specific", file=sys.stderr)
        show_context(text, old)
        return 3

    path.write_text(text.replace(old, new) if args.all else text.replace(old, new, 1))
    print(f"applied to {path} ({count} occurrence{'s' if count > 1 else ''})")
    return 0


if __name__ == "__main__":
    sys.exit(main())

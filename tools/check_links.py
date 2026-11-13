#!/usr/bin/env python3
"""Crawl all internal links/anchors/assets in the built site and report breakage.

Usage: python3 tools/check_links.py
Exit code 1 if anything is broken.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ATTR_RE = re.compile(r'(?:href|src)="([^"]+)"')
ID_RE = re.compile(r'id="([^"]+)"')
NAME_RE = re.compile(r'<a[^>]+name="([^"]+)"')


def norm(p):
    p = p.split("#")[0].split("?")[0]
    return p


def main():
    problems = []
    ids = {}
    files = []

    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in ("tools", ".git")]
        for fn in filenames:
            if fn.endswith(".html"):
                files.append(os.path.join(dirpath, fn))

    # collect anchors per page
    for f in files:
        rel = os.path.relpath(f, ROOT).replace(os.sep, "/")
        with open(f, encoding="utf-8") as fh:
            html = fh.read()
        s = set(ID_RE.findall(html)) | set(NAME_RE.findall(html))
        ids[rel] = s

    checked = 0
    for f in sorted(files):
        rel = os.path.relpath(f, ROOT).replace(os.sep, "/")
        with open(f, encoding="utf-8") as fh:
            html = fh.read()

        for raw in ATTR_RE.findall(html):
            if raw.startswith(("http://", "https://", "mailto:", "tel:", "//", "data:", "javascript:")):
                continue
            # Skip JS string concatenation fragments such as
            # href="lessons/lesson-' + String(n) + '.html" — these are
            # template pieces inside inline scripts, not real hrefs.
            if "'" in raw or '"' in raw or "+" in raw or "${" in raw:
                continue
            checked += 1
            target, _, frag = raw.partition("#")
            if target == "":
                # same-page anchor
                if frag and frag not in ids[rel]:
                    problems.append(f"{rel}: missing same-page anchor #{frag}")
                continue
            base_dir = os.path.dirname(f)
            resolved = os.path.normpath(os.path.join(base_dir, norm(target)))
            if not os.path.exists(resolved):
                problems.append(f"{rel}: missing file -> {raw}")
                continue
            if frag:
                trel = os.path.relpath(resolved, ROOT).replace(os.sep, "/")
                if trel in ids and frag not in ids[trel]:
                    problems.append(f"{rel}: missing anchor #{frag} in {trel}")

    print(f"scanned {len(files)} html files, {checked} internal references")
    if problems:
        print(f"\n{len(problems)} PROBLEM(S):")
        for p in problems:
            print("  " + p)
        return 1
    print("no broken internal links or anchors")
    return 0


if __name__ == "__main__":
    sys.exit(main())

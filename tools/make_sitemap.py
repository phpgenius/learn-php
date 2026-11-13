#!/usr/bin/env python3
"""Generate sitemap.xml from the real files on disk.

Only public, indexable pages are included: the homepage, all 96 lesson pages,
and any other page not listed in NOINDEX. Private/transactional pages
(checkout, dashboard, signup, certificate, project briefs, 404) are excluded
and are also marked noindex in their own <head>.

Usage: python3 tools/make_sitemap.py --base https://example.com/
"""
import argparse
import os
import re
from datetime import date

NOINDEX = {
    "checkout.html",
    "dashboard.html",
    "signup.html",
    "certificate.html",
    "projects/auth-system.html",
    "projects/blog-crud.html",
    "projects/contact-form.html",
    "projects/rest-api.html",
    "404.html",
}

DEFAULT_BASE = "https://static.teamily.ai/sites/3b1261c2-d849-4ad1-8822-626109251b81/webpages/learn-php_v6/"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--root", default=".")
    args = ap.parse_args()
    base = args.base if args.base.endswith("/") else args.base + "/"
    root = os.path.abspath(args.root)
    today = date.today().isoformat()

    entries = []
    for dirpath, _d, filenames in os.walk(root):
        if "/tools" in dirpath:
            continue
        for fn in filenames:
            if not fn.endswith(".html"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, fn), root).replace(os.sep, "/")
            if rel in NOINDEX:
                continue
            with open(os.path.join(dirpath, fn), encoding="utf-8") as f:
                html = f.read()
            if 'name="robots"' in html and "noindex" in html:
                continue

            loc = base if rel == "index.html" else base + rel
            if rel == "index.html":
                pri, freq = "1.0", "weekly"
            elif rel.startswith("lessons/"):
                pri, freq = "0.7", "monthly"
            else:
                pri, freq = "0.8", "monthly"
            entries.append((loc, pri, freq))

    # homepage first, then lessons in numeric order, then the rest
    def sort_key(e):
        loc = e[0]
        if loc == base:
            return (0, 0)
        m = re.search(r"lesson-(\d+)\.html$", loc)
        if m:
            return (1, int(m.group(1)))
        return (2, loc)

    entries.sort(key=sort_key)

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, pri, freq in entries:
        lines += [
            "  <url>",
            f"    <loc>{loc}</loc>",
            f"    <lastmod>{today}</lastmod>",
            f"    <changefreq>{freq}</changefreq>",
            f"    <priority>{pri}</priority>",
            "  </url>",
        ]
    lines.append("</urlset>")

    out = os.path.join(root, "sitemap.xml")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {out} with {len(entries)} urls")


if __name__ == "__main__":
    main()

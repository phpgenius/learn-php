#!/usr/bin/env python3
"""
Bulk SEO pass for the Learn PHP site.

Adds / normalises on every HTML page:
  - canonical URL (absolute, derived from the file path)
  - og:url, og:image, og:image:width/height/alt
  - twitter:image, twitter:card
  - the privacy-friendly analytics snippet (Plausible) + track() helper

Idempotent: re-running replaces the values it manages instead of duplicating.

Usage:
    python3 tools/apply_seo.py --base https://example.com/
"""
import argparse
import os
import re
import sys

DEFAULT_BASE = "https://static.teamily.ai/sites/3b1261c2-d849-4ad1-8822-626109251b81/webpages/learn-php_v6/"

# Pages that must not be indexed (private / transactional).
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

ANALYTICS = """<!-- Privacy-friendly analytics (Plausible). TODO: replace data-domain with your real domain. -->
<script defer data-domain="learnphp.example" src="https://plausible.io/js/script.js"></script>
<script>window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};</script>
"""


def rel_path(root, path):
    return os.path.relpath(path, root).replace(os.sep, "/")


def url_for(base, rel):
    if rel == "index.html":
        return base
    return base + rel


def strip_managed(html):
    """Remove tags this script owns so re-runs stay clean."""
    patterns = [
        r'\n?<link rel="canonical"[^>]*>',
        r'\n?<meta property="og:url"[^>]*>',
        r'\n?<meta property="og:image"[^>]*>',
        r'\n?<meta property="og:image:width"[^>]*>',
        r'\n?<meta property="og:image:height"[^>]*>',
        r'\n?<meta property="og:image:alt"[^>]*>',
        r'\n?<meta name="twitter:image"[^>]*>',
        r'\n?<meta name="twitter:card"[^>]*>',
        r'\n?<!-- Privacy-friendly analytics.*?-->\n?<script defer data-domain[^>]*></script>\n?<script>window\.plausible.*?</script>',
    ]
    for p in patterns:
        html = re.sub(p, "", html, flags=re.S)
    return html


def build_block(base, rel, title, desc, is_lesson):
    url = url_for(base, rel)
    og_img = base + "assets/og-image.png"
    card = "summary_large_image"
    alt = "Learn PHP — 96 lessons from first script to production backend"
    return (
        f'<link rel="canonical" href="{url}">\n'
        f'<meta property="og:url" content="{url}">\n'
        f'<meta property="og:image" content="{og_img}">\n'
        f'<meta property="og:image:width" content="1200">\n'
        f'<meta property="og:image:height" content="630">\n'
        f'<meta property="og:image:alt" content="{alt}">\n'
        f'<meta name="twitter:card" content="{card}">\n'
        f'<meta name="twitter:image" content="{og_img}">\n'
    )


def get_meta(html, prop, attr="property"):
    m = re.search(rf'<meta {attr}="{re.escape(prop)}" content="([^"]*)"', html)
    return m.group(1) if m else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--root", default=".")
    args = ap.parse_args()
    base = args.base if args.base.endswith("/") else args.base + "/"
    root = os.path.abspath(args.root)

    changed = 0
    for dirpath, _dirnames, filenames in os.walk(root):
        if "/tools" in dirpath or "/.git" in dirpath:
            continue
        for fn in sorted(filenames):
            if not fn.endswith(".html"):
                continue
            path = os.path.join(dirpath, fn)
            rel = rel_path(root, path)
            with open(path, encoding="utf-8") as f:
                html = f.read()

            title = re.search(r"<title>(.*?)</title>", html, re.S)
            title = title.group(1).strip() if title else "Learn PHP"
            desc = get_meta(html, "description", "name") or get_meta(html, "og:description")

            html = strip_managed(html)
            block = build_block(base, rel, title, desc, rel.startswith("lessons/"))

            # insert right after the theme-color meta, else after <title>
            anchor = re.search(r'<meta name="theme-color"[^>]*>\n?', html)
            if anchor:
                html = html[: anchor.end()] + block + html[anchor.end():]
            else:
                t = re.search(r"</title>\n?", html)
                html = html[: t.end()] + block + html[t.end():]

            # analytics: before </head>
            if "plausible.io" not in html:
                html = html.replace("</head>", ANALYTICS + "</head>", 1)

            # robots for private pages
            if rel in NOINDEX and 'name="robots"' not in html:
                html = html.replace(
                    "</title>", '</title>\n<meta name="robots" content="noindex, nofollow">', 1
                )

            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            changed += 1

    print(f"processed {changed} pages, base={base}")


if __name__ == "__main__":
    main()

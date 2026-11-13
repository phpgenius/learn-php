#!/usr/bin/env python3
"""
Make the Learn PHP site fully free (v6).

- Unlocks every Pro lesson: removes the [data-pro-lock] panel, the upgrade
  banner, the `hidden` attribute on [data-pro-content], and the duplicated
  preview paragraph that sat outside it.
- Rewrites every Pro badge to Free.
- Repoints Pricing -> Support, drops signup/checkout/dashboard links.
- Injects the Maya donation block + its CSS/JS on every lesson page.
- Repoints canonical/OG URLs from learn-php_v5 to learn-php_v6.

Idempotent: safe to re-run.
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OLD = "learn-php_v5"
NEW = "learn-php_v6"

DONATION_BLOCK = """
    <!-- ============ SUPPORT / DONATION ============ -->
    <section class="dn-section" aria-labelledby="dn-h">
      <div data-donation="block"></div>
    </section>

"""


def fix_urls(html):
    return html.replace("/webpages/%s/" % OLD, "/webpages/%s/" % NEW)


def unlock(html):
    """Remove the paywall from a Pro lesson page."""
    # 1. Drop the duplicated preview paragraph that sat before the gate.
    html = re.sub(
        r'(<article class="lesson-body">)\s*<p>.*?</p>\s*(<div data-pro-content hidden>)',
        r"\1\n      \2",
        html,
        flags=re.S,
    )

    # 2. Unwrap [data-pro-content] so its children become the lesson body.
    html = re.sub(
        r'<div data-pro-content hidden>\n(.*?)\n    </div>\n\n    <div class="locked" data-pro-lock>',
        '\\1\n\n    <div class="locked" data-pro-lock>',
        html,
        flags=re.S,
    )

    # 3. Remove the lock panel.
    html = re.sub(
        r'\n    <div class="locked" data-pro-lock>.*?\n    </div>\n\n    <div class="mark-row">',
        '\n    <div class="mark-row">',
        html,
        flags=re.S,
    )

    # 4. Remove the upgrade banner.
    html = re.sub(
        r'\n    <div class="upgrade">.*?\n    </div>\n',
        "\n",
        html,
        flags=re.S,
    )

    # 5. Any leftover gate attributes.
    html = html.replace(" data-pro-content hidden", "")
    html = html.replace(" data-pro-content", "")

    # 6. Pro badge -> Free badge.
    html = html.replace(
        '<span class="badge badge-pro">Pro</span>',
        '<span class="badge badge-free">Free</span>',
    )
    return html


def fix_nav(html, prefix):
    """prefix is '' for root pages, '../' for lessons/ and projects/."""
    # footer line FIRST — it contains a #pricing link the generic rule below
    # would otherwise rewrite before this pattern can match.
    p = re.escape(prefix)
    footer_pat = (
        r'<span><a href="' + p + r'index\.html#curriculum">All 96 lessons</a> &middot; '
        r'<a href="' + p + r'index\.html#pricing">Pricing</a> &middot; '
        r'<a href="' + p + r'dashboard\.html">Dashboard</a></span>'
    )
    footer_new = (
        '<span><a href="' + prefix + 'index.html#curriculum">All 96 lessons</a> &middot; '
        '<a href="' + prefix + 'index.html#support">Support this site</a></span>'
    )
    html = re.sub(footer_pat, footer_new, html)

    html = html.replace(
        '<a href="%sindex.html#pricing">Pricing</a>' % prefix,
        '<a href="%sindex.html#support">Support</a>' % prefix,
    )
    html = html.replace(
        '<a href="#pricing">Pricing</a>', '<a href="#support">Support</a>'
    )
    # mobile menu: drop the account buttons, keep a support link
    html = re.sub(
        r'\s*<a href="%sdashboard\.html" class="btn btn-ghost btn-block">Dashboard</a>' % re.escape(prefix),
        "",
        html,
    )
    html = re.sub(
        r'\s*<a href="%ssignup\.html" class="btn btn-primary btn-block">Start free</a>' % re.escape(prefix),
        '\n      <a href="%sindex.html#support" class="btn btn-primary btn-block">Support this site</a>' % prefix,
        html,
    )
    return html


def add_assets(html, prefix):
    if "donation.css" not in html:
        html = html.replace(
            "</head>",
            '<link rel="stylesheet" href="%sassets/donation.css">\n</head>' % prefix,
            1,
        )
    if "donation-config.js" not in html:
        html = html.replace(
            "</body>",
            '<script src="%sassets/donation-config.js"></script>\n'
            '<script src="%sassets/qrcode.min.js"></script>\n'
            '<script src="%sassets/donation.js"></script>\n</body>'
            % (prefix, prefix, prefix),
            1,
        )
    return html


def main():
    lessons = sorted(glob.glob(os.path.join(ROOT, "lessons", "*.html")))
    projects = sorted(glob.glob(os.path.join(ROOT, "projects", "*.html")))

    changed = 0
    for path in lessons:
        with open(path, encoding="utf-8") as f:
            html = f.read()
        before = html
        html = fix_urls(html)
        html = unlock(html)
        html = fix_nav(html, "../")
        if 'data-donation="block"' not in html:
            html = html.replace(
                '    <nav class="lesson-nav"', DONATION_BLOCK + '    <nav class="lesson-nav"', 1
            )
        html = add_assets(html, "../")
        if html != before:
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            changed += 1

    for path in projects:
        with open(path, encoding="utf-8") as f:
            html = f.read()
        before = html
        html = fix_urls(html)
        html = fix_nav(html, "../")
        html = add_assets(html, "../")
        if html != before:
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            changed += 1

    print("lessons:", len(lessons), "projects:", len(projects), "changed:", changed)

    # report anything still gated
    left = []
    for path in lessons:
        with open(path, encoding="utf-8") as f:
            h = f.read()
        if "data-pro-lock" in h or "data-pro-content" in h or "badge-pro\">Pro" in h:
            left.append(os.path.basename(path))
    print("still gated:", len(left), left[:5])
    return 0


if __name__ == "__main__":
    sys.exit(main())

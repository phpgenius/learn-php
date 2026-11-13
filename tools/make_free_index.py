#!/usr/bin/env python3
"""
Homepage pass for v6: fully free + Maya donation.

- Replaces the pricing table and the paid ebook upsell with a
  "Support this site" section containing the donation block.
- Removes every Pro badge / Pro filter from the curriculum index.
- Rewrites nav, hero, stats, FAQ, footer and JSON-LD to match a free site.
- Repoints canonical/OG URLs to learn-php_v6.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "index.html")

SUPPORT_SECTION = """<!-- ============ SUPPORT THIS SITE ============ -->
<section class="section" id="support">
  <div class="wrap">
    <div class="section-head reveal">
      <p class="eyebrow">Support</p>
      <h2>Everything here is free. If it helped, you can chip in.</h2>
      <p>
        All 96 lessons, all four project briefs and every code sample are open to everyone &mdash;
        no account, no card, no paywall. There is no paid tier to upgrade to. If you want to keep
        the site online, a voluntary donation is the only thing we ask for.
      </p>
    </div>

    <div class="support-grid">
      <div class="reveal">
        <div data-donation="block"></div>
      </div>

      <aside class="support-side reveal">
        <h3>What your donation pays for</h3>
        <ul class="support-list">
          <li><b>Hosting &amp; bandwidth</b><span>Static hosting, CDN and the domain renewal.</span></li>
          <li><b>New lessons</b><span>Time to write and test the material, not just publish it.</span></li>
          <li><b>Keeping it free</b><span>No ads on lesson pages, no email gate, no upsell wall.</span></li>
        </ul>
        <p class="support-note">
          Donations are optional and one-off. There is no subscription, nothing recurring,
          and no account is created. The site stays free either way.
        </p>
      </aside>
    </div>
  </div>
</section>

"""


def main():
    with open(PATH, encoding="utf-8") as f:
        html = f.read()
    before = html

    # ---------- URLs ----------
    html = html.replace("/webpages/learn-php_v5/", "/webpages/learn-php_v6/")

    # ---------- head / meta ----------
    html = html.replace(
        '<meta name="description" content="A structured PHP learning path: 96 browsable lessons across 8 levels - syntax, forms, arrays, functions, OOP, MySQL and security. Free tier, Pro from $15/mo, Team for 5 seats.">',
        '<meta name="description" content="A structured PHP learning path: 96 free lessons across 8 levels - syntax, forms, arrays, functions, OOP, MySQL and security. Every lesson and project brief is free, no account required.">',
    )
    html = html.replace(
        '<meta property="og:description" content="A structured PHP learning path: syntax, forms, arrays, functions, OOP, MySQL and security. 96 lessons, real code, and a production checklist.">',
        '<meta property="og:description" content="96 free PHP lessons across 8 levels: syntax, forms, arrays, functions, OOP, MySQL and security. No paywall, no account.">',
    )

    # ---------- JSON-LD: free course, no paid offers ----------
    html = html.replace(
        '''      "offers": [
        { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD", "category": "Free" },
        { "@type": "Offer", "name": "Pro", "price": "19", "priceCurrency": "USD", "category": "Subscription" },
        { "@type": "Offer", "name": "Team", "price": "49", "priceCurrency": "USD", "category": "Subscription" }
      ]''',
        '''      "isAccessibleForFree": true,
      "offers": {
        "@type": "Offer",
        "name": "Free",
        "price": "0",
        "priceCurrency": "USD",
        "category": "Free",
        "availability": "https://schema.org/InStock"
      }''',
    )

    # ---------- nav ----------
    html = html.replace('<a href="#pricing">Pricing</a>', '<a href="#support">Support</a>')
    html = html.replace(
        '      <a href="dashboard.html" class="btn btn-ghost btn-block">Dashboard</a>\n'
        '      <a href="signup.html" class="btn btn-primary btn-block">Start free</a>',
        '      <a href="#support" class="btn btn-primary btn-block">Support this site</a>',
    )

    # ---------- hero ----------
    html = html.replace(
        '<a href="#pricing" class="btn btn-primary">Start the free path &rarr;</a>',
        '<a href="lessons/lesson-01.html" class="btn btn-primary">Start lesson 1 &rarr;</a>',
    )
    html = html.replace(
        '<a href="#pricing" class="btn btn-primary">Start the free path \u2192</a>',
        '<a href="lessons/lesson-01.html" class="btn btn-primary">Start lesson 1 \u2192</a>',
    )
    html = html.replace(
        '<span><i class="dot"></i>No credit card</span>\n'
        '        <span><i class="dot"></i>Levels 1\u20133 free forever</span>\n'
        '        <span><i class="dot"></i>Runs in your browser</span>',
        '<span><i class="dot"></i>No account needed</span>\n'
        '        <span><i class="dot"></i>All 96 lessons free</span>\n'
        '        <span><i class="dot"></i>No paywall, ever</span>',
    )

    # ---------- stats ----------
    html = html.replace(
        '<div class="stat"><b>4.8</b><span>avg. rating</span></div>',
        '<div class="stat"><b>100%</b><span>free lessons</span></div>',
    )

    # ---------- level cards: Pro -> Free ----------
    html = html.replace(
        '<span class="badge badge-pro">Pro</span>', '<span class="badge badge-free">Free</span>'
    )

    # ---------- curriculum index: every row free ----------
    html = html.replace('data-pro="1"', 'data-pro="0"')
    html = html.replace(
        '<span class="badge badge-pro">Pro</span></span></a>',
        '<span class="badge badge-free">Free</span></span></a>',
    )

    # filter chips: drop the Free/Pro split, keep level chips
    html = re.sub(
        r'\s*<button type="button" class="cl-chip" data-filter="free">Free <span>40</span></button>'
        r'\s*<button type="button" class="cl-chip" data-filter="pro">Pro <span>56</span></button>',
        "",
        html,
    )

    # curriculum intro copy
    html = html.replace(
        "Eight levels, 96 lessons, in the order you should take them. Search by topic or filter by level &mdash;\n"
        "        every row links to the lesson page. Levels 1&ndash;3 are free; Pro lessons open with a free preview.",
        "Eight levels, 96 lessons, in the order you should take them. Search by topic or filter by level &mdash;\n"
        "        every row links straight to the full lesson. All 96 are free, with no account and no preview cut-off.",
    )
    html = html.replace(
        "Every level maps to a real block of the PHP language \u2014 the same topics covered by the\n"
        "        W3Schools PHP tutorial, re-sequenced so each one lands when you can use it. Levels 1\u20133 are free.",
        "Every level maps to a real block of the PHP language \u2014 the same topics covered by the\n"
        "        W3Schools PHP tutorial, re-sequenced so each one lands when you can use it. All eight levels are free.",
    )

    # ---------- replace pricing + upsell with the support section ----------
    start = html.find("<!-- ============ PRICING ============ -->")
    end = html.find("<!-- ============ AFFILIATE / RECOMMENDED ============ -->")
    if start == -1 or end == -1 or end < start:
        print("FATAL: could not locate pricing/upsell block", start, end)
        return 1
    html = html[:start] + SUPPORT_SECTION + html[end:]

    # ---------- FAQ ----------
    html = html.replace(
        "<summary>Is the free tier really free?</summary>\n"
        '        <div class="answer">Yes. Levels 1 through 3, all code samples and the weekly newsletter are free with no account required. A free account adds progress tracking and the exercise grader. Pro unlocks Levels 4 through 8, the project builds and the certificate.</div>',
        "<summary>Is everything really free?</summary>\n"
        '        <div class="answer">Yes &mdash; all 96 lessons, all four project briefs, every code sample and the newsletter. There is no paid tier, no locked lesson and no account required. Progress tracking is stored in your own browser. The site is funded by voluntary donations, so nothing is gated behind a payment.</div>',
    )
    html = html.replace(
        "<summary>Can I cancel a paid plan at any time?</summary>\n"
        '        <div class="answer">Yes, from your account page in two clicks. Cancelling stops the next renewal and you keep access until the end of the period you already paid for. There is also a 30-day refund window on first purchases.</div>',
        "<summary>Do I have to pay or donate anything?</summary>\n"
        '        <div class="answer">No. Donations are entirely voluntary and one-off, and the site stays free whether you give or not. There is no subscription to cancel because there is no subscription.</div>',
    )
    html = html.replace(
        "<summary>Do I get a certificate?</summary>\n"
        '        <div class="answer">Pro and Team members get a completion certificate after passing the final assessment, which covers all eight levels and includes a practical build. The certificate carries a verification URL that employers can check.</div>',
        "<summary>Do I get a certificate?</summary>\n"
        '        <div class="answer">There is a printable completion certificate you can generate once you have marked the lessons complete. It is free and needs no account. It is a record of your own progress, not an accredited qualification.</div>',
    )

    # ---------- footer ----------
    html = html.replace('<a href="#pricing">Pricing</a>', '<a href="#support">Support</a>')
    html = html.replace('<a href="#pricing">For teams</a>', '<a href="#curriculum">All lessons</a>')
    html = html.replace('<a href="#pricing">Affiliates</a>', '<a href="#support">Donate</a>')

    # ---------- placeholder note ----------
    html = html.replace(
        "<b>Demo build \u2014 placeholders in use.</b> Pricing figures ($19 / $49 / $39), the 12,400 subscriber count,\n"
        "      the 4.8 rating, the testimonial names and the affiliate partners are illustrative and must be replaced\n"
        "      with real data before launch.",
        "<b>Demo build \u2014 placeholders in use.</b> The Maya number and payment link are empty until the owner\n"
        "      fills in <code>assets/donation-config.js</code>, so the donation block shows a \u201ccoming soon\u201d state.\n"
        "      The 12,400 subscriber count, the testimonial names and the affiliate partners are illustrative and must\n"
        "      be replaced with real data before launch.",
    )

    # ---------- assets ----------
    if "donation.css" not in html:
        html = html.replace(
            "</head>", '<link rel="stylesheet" href="assets/donation.css">\n</head>', 1
        )
    if "donation-config.js" not in html:
        html = html.replace(
            "</body>",
            '<script src="assets/donation-config.js"></script>\n'
            '<script src="assets/qrcode.min.js"></script>\n'
            '<script src="assets/donation.js"></script>\n</body>',
            1,
        )

    # ---------- support-grid styles ----------
    if ".support-grid" not in html:
        css = """
  /* ---------- support / donation ---------- */
  .support-grid{display:grid;grid-template-columns:1.35fr .85fr;gap:26px;align-items:start}
  .support-side{border:1px solid var(--line-soft);background:var(--panel);border-radius:var(--radius);
    padding:26px 28px}
  .support-side h3{font-size:1.02rem;margin:0 0 16px}
  .support-list li{padding:12px 0;border-bottom:1px solid var(--line-soft)}
  .support-list li:last-child{border-bottom:0;padding-bottom:0}
  .support-list b{display:block;font-size:.9rem;font-weight:600;margin-bottom:3px}
  .support-list span{display:block;font-size:.83rem;color:var(--muted);line-height:1.55}
  .support-note{margin:18px 0 0;padding-top:16px;border-top:1px solid var(--line-soft);
    font-size:.8rem;color:var(--muted-2);line-height:1.6}
  @media(max-width:900px){.support-grid{grid-template-columns:1fr}}
"""
        html = html.replace("  /* ---------- print ---------- */", css + "  /* ---------- print ---------- */", 1)

    if html != before:
        with open(PATH, "w", encoding="utf-8") as f:
            f.write(html)
        print("index.html updated")
    else:
        print("index.html unchanged")

    # ---------- report leftovers ----------
    for needle in ["#pricing", "badge-pro\">Pro", "data-pro=\"1\"", "checkout.html", "signup.html", "dashboard.html", "learn-php_v5"]:
        n = html.count(needle)
        if n:
            print("  leftover %-22s %d" % (needle, n))
    return 0


if __name__ == "__main__":
    sys.exit(main())

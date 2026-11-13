# Learn PHP — Launch & Income Plan

A working plan for taking the site from "built" to "earning", with realistic
numbers instead of hype. Every figure below is an **estimate with its
assumption stated**, so you can tell when reality disagrees with the plan.

**Status at hand-off:** site is production-ready as a static build; payments
code is written and tested but needs Stripe keys; monetization placements are
wired to named programmes but need publisher/affiliate IDs.

---

## Part 1 — Publish checklist

Work top to bottom. Nothing in Part 2 works until this is done.

### Blockers (site is not live without these)

- [ ] **Pick a domain.** `.com` preferred; `.dev`/`.io` acceptable. ~$12/yr.
- [ ] **Deploy the static site.** Netlify / Cloudflare Pages / Vercel all work
      for the static build; the Stripe server needs a Node host (Fly.io,
      Railway, Render, or a small VPS).
- [ ] **Update the base URL everywhere.** Run:
      `python3 tools/apply_seo.py --base https://yourdomain.com/`
      then `python3 tools/make_sitemap.py --base https://yourdomain.com/`
      This rewrites every canonical, `og:url`, `og:image` and sitemap entry.
- [ ] **Set `SITE_URL`** on the server to the same domain.
- [ ] **Add the Stripe keys** per `server/STRIPE_SETUP.md`, then complete one
      test purchase end to end.
- [ ] **Set `COOKIE_SECURE=true`** (you are on HTTPS now).
- [ ] **Replace the placeholder prices** or confirm $19 / $49 are what you want
      to charge. They appear in `server/plans.js` **and** `assets/app.js`.
- [ ] **Replace the footer placeholder note** on `index.html` once the invented
      numbers (12,400 subscribers, 4.8 rating, testimonial names) are either
      real or removed.
- [ ] **Fill in `legal.html`**: `[COMPANY]`, `[REGISTERED ADDRESS]`, and real
      email addresses. Have a lawyer read it before charging money.
- [ ] **Point `robots.txt` at the domain root.** Crawlers only read
      `/robots.txt` at the root — copy the file there and fix the Sitemap line.
- [ ] **Verify no `REPLACE_WITH_YOUR` strings are left in production HTML.**
      `grep -r "REPLACE_WITH" .`

### Should-do before launch

- [ ] Google Search Console — verify the domain, submit `sitemap.xml`.
- [ ] Bing Webmaster Tools — same, it still feeds DuckDuckGo.
- [ ] Create a real Plausible account and swap `data-domain` in the analytics
      snippet from `learnphp.example` to your domain.
- [ ] Test the site on an actual phone, not just a narrow browser window.
- [ ] Run `python3 tools/check_links.py` one final time after the URL rewrite.
- [ ] Set up a `hello@yourdomain.com` mailbox (Fastmail, Zoho, or Google Workspace).
- [ ] Add the domain to your email provider and complete SPF/DKIM/DMARC — the
      newsletter is worthless if it lands in spam.

### Nice-to-have

- [ ] A 30-second screen recording of the lesson browser for the landing page.
- [ ] A `/changelog` page — "last updated" dates are a real ranking signal for
      tutorial content.
- [ ] Print stylesheet already exists; generate a PDF of the syllabus as a
      lead magnet.

---

## Part 2 — First 30 days

The trap here is building more lessons. You have 96. Nobody buys lesson 97 —
they buy a reason to trust the first one. Days are working days; skip weekends.

### Week 1 — Make it findable

| Day | Action | Why |
|---|---|---|
| 1 | Ship the site, submit sitemaps | Nothing else matters until it is indexable |
| 2 | Fix the 20 lesson pages Google will actually rank first — check that each has a unique `<title>`, a clear H1, and a real code example above the fold | Long-tail lesson queries are your entire early traffic |
| 3 | Post lesson 01 and lesson 44 (PDO prepared statements) to r/PHP as text posts, not link drops | r/PHP is hostile to self-promotion but rewards genuinely useful write-ups |
| 4 | Answer 5 questions on Stack Overflow's `php` tag where you can link a lesson *and* answer the question inline | Slow, compounding referral traffic |
| 5 | Submit to 3 dev newsletter curators (PHP Weekly, Bytes, Cooperpress) | One inclusion ≈ 2-5k visits |

### Week 2 — Make it trustworthy

| Day | Action | Why |
|---|---|---|
| 6-7 | Write one genuinely substantial free article that is *not* a lesson — e.g. "Why `mysqli` real_escape_string is not a substitute for prepared statements", with runnable exploit code | Linkable assets earn backlinks; lessons rarely do |
| 8 | Add author bio + photo to the About area | Anonymous tutorial sites convert badly |
| 9 | Record a 2-minute "what this is" video, embed on the hero | Video lifts pricing-page conversion measurably |
| 10 | Set up a real newsletter (Buttondown, ConvertKit, or Listmonk) and wire the form | You cannot monetize an audience you cannot reach |

### Week 3 — Make it convert

| Day | Action | Why |
|---|---|---|
| 11 | Add a **free** email course: 5 lessons delivered over 5 days, ending with a Pro offer | Email converts better than cold traffic, usually 3-8× |
| 12 | Put a single, specific upgrade prompt at lesson 45 (the first locked lesson) rather than a generic one | Contextual beats generic |
| 13 | A/B the hero CTA: "Start free" vs "Start Level 1" | Test the verb, not the color |
| 14 | Apply to Carbon Ads and EthicalAds | Approval takes ~1 week; start the clock |
| 15 | Apply to DigitalOcean, Amazon Associates, Udemy affiliate programmes | DigitalOcean approval is usually same-week |

### Week 4 — Make it compound

| Day | Action | Why |
|---|---|---|
| 16 | Publish the eBook (the "PHP Production Handbook" upsell) as a real PDF, 40-60 pages | A $39 product with a 100% margin and no marginal cost |
| 17 | Add the eBook to the checkout as an order bump (+$19) | Order bumps typically add 10-30% to AOV |
| 18 | Insert ad units once approved; keep Pro ad-free | Ad revenue is small; do not damage the paid tier for it |
| 19 | Write 2 comparison pages ("Learn PHP vs Codecademy", "Best PHP courses 2026") | High commercial-intent search, and you control the framing |
| 20 | Email your list the first real issue | The newsletter is a product, not a form |

### Ongoing rhythm after day 30

One new free article per week, one newsletter per week, one lesson improvement
per week. That is the whole engine.

---

## Part 3 — Realistic revenue expectations

Ordered by how much you should actually rely on them. The ranges are for
**months 3-12**, assuming consistent weekly publishing and no paid ads.

### Subscriptions — the only stream that can become a business

| Metric | Conservative | Realistic | Good |
|---|---|---|---|
| Monthly visitors (month 6) | 3,000 | 10,000 | 30,000 |
| Visitor → free signup | 1.5% | 3% | 5% |
| Free → paid conversion | 1% | 2.5% | 5% |
| Blended ARPU/mo | $16 | $20 | $24 |
| **MRR at month 6** | **$70** | **$500** | **$3,600** |

| Metric | Value |
|---|---|
| **MRR at month 12 (realistic)** | **$1,200-2,500** |
| Churn | 6-10%/mo for consumer dev education (high — price accordingly) |
| Team plans | Rare early, but one 5-seat team = 5× Pro revenue from one sale |

**The honest read:** most tutorial sites never clear $500 MRR. The ones that do
have either (a) a very specific niche with a painful problem, or (b) an author
with an existing audience. You have neither yet, which is why weeks 1-4 are
about audience, not product.

### Affiliates — meaningful only at volume

| Programme | Payout | Conversion reality |
|---|---|---|
| DigitalOcean | ~$25-200/referral | Hosting referrals convert well from deployment lessons |
| Amazon books | 1-4% of a $30-50 book | ~$1-2 per sale; needs thousands of clicks |
| Udemy | 10-15% of a $15-80 course | ~$3-8 per sale |

| Metric | Conservative | Realistic |
|---|---|---|
| Monthly affiliate revenue at 10k visits | $40 | $150 |
| At 30k visits | $120 | $450 |

Affiliate revenue depends almost entirely on **placement intent**. A hosting
link inside a "deploy this" lesson out-earns a sidebar banner by 10-20×.

### Display ads — small, and only worth it at scale

| Network | Effective RPM (dev traffic) | Notes |
|---|---|---|
| Carbon Ads | $2-8 RPM | One unit, high acceptance, low revenue |
| EthicalAds | $1-4 RPM | Privacy-first, similar range |

| Traffic | Conservative | Realistic |
|---|---|---|
| 10k visits/mo | $20 | $60 |
| 30k visits/mo | $60 | $190 |
| 100k visits/mo | $200 | $700 |

**Do not build the business on ads.** At 10k visits/month, ads are ~$60. One
extra Pro subscriber per month is worth more. Ads are worth having because they
cost nothing to run — not because they pay.

### eBook / one-time products — best early revenue per unit of work

| Metric | Conservative | Realistic |
|---|---|---|
| Price | $29 | $39 |
| Conversion of visitors | 0.1% | 0.3% |
| Revenue at 10k visits | $290 | $1,170 |
| Less payment fees (~3%) | — | ~$35 |

The eBook is your fastest path to the **first $100**. It has no churn, no
support load, and no infrastructure. Write it before you write lesson 97.

### Combined picture

| Scenario | Month 6 MRR-ish | Month 12 |
|---|---|---|
| Conservative | ~$150 total | ~$500 total |
| Realistic | ~$700 total | ~$2,500 total |
| Good (audience exists) | ~$4,000 | ~$15,000 |

**What actually decides which row you land in:** whether you have 10,000
visitors who trust you by month 6. That is a distribution problem, not a
content problem. If traffic is flat at month 3, stop writing lessons and start
writing things people link to.

---

## Part 4 — What to measure weekly

One page, five minutes, every Monday. If a number is not on this list, it is
not worth checking weekly.

### Funnel (the only numbers that compound)

| Metric | Where | Target trend |
|---|---|---|
| Unique visitors | Plausible | ↑ week over week |
| Visitor → free signup | `signup` event ÷ visitors | ≥ 2% |
| Free → paid | `purchase` ÷ `signup` | ≥ 1.5% |
| Checkout starts | `checkout_start` events | ↑, and ratio to `purchase` ≥ 60% |
| Newsletter submits | `newsletter_submit` | ≥ 1% of visitors |

A big gap between `checkout_start` and `purchase` means **the checkout itself is
losing people** — usually price shock, a card failure, or a webhook that never
fires. Check that first.

### Revenue

- **MRR** (sum of active subscriptions, normalized monthly)
- **New vs churned subscribers** — churn is the number that kills small sites
- **ARPU** — falling ARPU with rising MRR means mix shift toward Pro, which is fine
- **Affiliate clicks vs conversions** — clicks without conversions means wrong placement

### Content

- **Top 10 landing pages by entry traffic** — these are your lessons that earn
  links; improve them first
- **Bounce rate on top pages** — > 80% means the promise in the title is not
  being met above the fold
- **Search Console impressions vs clicks** — rising impressions with flat clicks
  means your titles are weak

### Health

- **Stripe webhook failures** — any non-200 in the Stripe dashboard is lost revenue
- **Checkout error rate** — track 4xx/5xx on `/api/checkout/session`
- **Page load (LCP)** on mobile — over 2.5s costs signups

### Monthly, not weekly

- Cohort retention: of the people who signed up in month N, how many are still
  active in month N+1, N+2?
- Refund rate (keep under 5%)
- Cost per acquisition, if you ever run paid ads (it will be $20-60 for dev tools;
  only worth it if LTV exceeds 3× that)

---

## Part 5 — The three decisions that matter

Everything above is execution. These three are the ones that actually change
the outcome:

1. **Niche down or stay general.** "Learn PHP" competes with php.net, W3Schools,
   Laracasts and free YouTube. "PHP for WordPress plugin developers" or
   "PHP for people inheriting a legacy codebase" competes with almost nobody.
   Consider narrowing the title and the pitch while keeping the 96 lessons.

2. **Build the email list before the product.** A 2,000-person list that trusts
   you is worth more than 96 lessons nobody can find. If month 3 traffic is
   flat, this is the fix.

3. **Charge from day one.** Free-tier-only sites almost never start charging
   later — the audience you attract at $0 is not the audience that converts.
   The Free tier here is generous enough (40 lessons) to be a real funnel.

---

## Assumptions this plan makes (check them against your reality)

- You are one person, part-time, with some PHP experience.
- No existing audience or email list.
- No paid acquisition budget in the first 90 days.
- Content is published in English only.
- You will keep publishing weekly for at least 6 months.

If any of those is wrong — especially the audience one — the revenue ranges move
substantially, usually upward if you already have distribution.

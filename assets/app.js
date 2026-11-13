/* ==========================================================================
   Learn PHP — shared progress & analytics engine
   --------------------------------------------------------------------------
   v6: THE SITE IS FULLY FREE. There is no paywall, no plan gate and no
   account requirement. Every lesson and project page is open to everyone.

   What remains here:
     - lesson progress tracking (localStorage, this device only)
     - privacy-friendly conversion tracking (Plausible wrapper)
     - the auth-aware nav renderer, now reduced to a plain "Support" link

   The legacy account/plan API (signUp, setPlan, hasPro, ...) is kept so the
   old signup.html / checkout.html / dashboard.html pages still load if
   someone has them bookmarked, but nothing on the site links to them and
   hasPro() now always returns true.
   ========================================================================== */
(function () {
  'use strict';

  var ACCOUNT_KEY = 'learnphp.account.v1';
  var PROGRESS_KEY = 'learnphp.progress.v1';

  /* ---------------------------------------------------------------- plans
     Retained only so the legacy pages can render. Not used for gating. */
  var PLANS = {
    free: {
      id: 'free',
      name: 'Free',
      tagline: 'Everything on the site, free.',
      monthly: 0,
      yearly: 0,
      seats: 1,
      cta: 'Start learning',
      features: [
        'All 8 levels — 96 lessons',
        'Every code sample on the site',
        'All 4 guided project briefs',
        'Weekly newsletter',
        'Community forum access'
      ],
      missing: []
    },
    pro: {
      id: 'pro',
      name: 'Pro',
      tagline: 'Retired — everything is free now.',
      monthly: 0,
      yearly: 0,
      seats: 1,
      cta: 'Free',
      features: ['Retired. All lessons are free.'],
      missing: []
    },
    team: {
      id: 'team',
      name: 'Team',
      tagline: 'Retired — everything is free now.',
      monthly: 0,
      yearly: 0,
      seats: 1,
      cta: 'Free',
      features: ['Retired. All lessons are free.'],
      missing: []
    }
  };

  var ORDER = ['free', 'pro', 'team'];

  /* ------------------------------------------------------------- helpers */
  function hash(s) {
    // djb2 — demo only, NOT a password hash.
    var h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'd' + (h >>> 0).toString(36);
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  function addMonths(d, n) {
    var x = new Date(d.getTime());
    var day = x.getDate();
    x.setMonth(x.getMonth() + n);
    if (x.getDate() < day) x.setDate(0); // clamp to last day of month
    return x;
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function daysUntil(iso) {
    if (!iso) return null;
    var d = new Date(iso).getTime();
    if (isNaN(d)) return null;
    return Math.ceil((d - Date.now()) / 86400000);
  }

  /* ------------------------------------------------------------- account */
  function getAccount() {
    var a = readJSON(ACCOUNT_KEY, null);
    if (!a || typeof a !== 'object' || !a.email) return null;
    if (!PLANS[a.plan]) a.plan = 'free';
    if (a.billing !== 'yearly') a.billing = 'monthly';
    if (!a.status) a.status = 'active';
    return a;
  }

  function saveAccount(a) {
    writeJSON(ACCOUNT_KEY, a);
    return a;
  }

  function isSignedIn() { return !!getAccount(); }

  /* A canceled subscription keeps access until the paid period ends. */
  function accessActive(a) {
    if (!a) return false;
    if (a.status === 'active') return true;
    if (a.status === 'canceled') {
      var d = daysUntil(a.renewsAt);
      return d !== null && d > 0;
    }
    return false;
  }

  function effectivePlan(a) {
    if (!a) return 'free';
    if (a.plan === 'free') return 'free';
    return accessActive(a) ? a.plan : 'free';
  }

  /* v6: the site is fully free — every lesson is open to everyone. */
  function hasPro() {
    return true;
  }

  function signUp(opts) {
    opts = opts || {};
    var email = String(opts.email || '').trim().toLowerCase();
    var name = String(opts.name || '').trim();
    var password = String(opts.password || '');
    if (!email || email.indexOf('@') < 1) return { ok: false, error: 'Enter a valid email address.' };
    if (name.length < 2) return { ok: false, error: 'Enter your name.' };
    if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };

    var existing = getAccount();
    if (existing && existing.email === email) {
      return { ok: false, error: 'An account with that email is already signed in on this device.' };
    }

    var acct = {
      email: email,
      name: name,
      pw: hash(password),
      plan: 'free',
      billing: 'monthly',
      status: 'active',
      seats: 1,
      createdAt: new Date().toISOString(),
      renewsAt: null,
      startedAt: null
    };
    saveAccount(acct);
    track('signup', { plan: 'free' });
    return { ok: true, account: acct };
  }

  function signIn(opts) {
    opts = opts || {};
    var email = String(opts.email || '').trim().toLowerCase();
    var password = String(opts.password || '');
    var acct = getAccount();
    if (!acct) {
      return { ok: false, error: 'No account on this device yet. Create one first — it takes a second.' };
    }
    if (acct.email !== email) {
      return { ok: false, error: 'That email does not match the account stored on this device.' };
    }
    if (acct.pw !== hash(password)) {
      return { ok: false, error: 'Incorrect password.' };
    }
    return { ok: true, account: acct };
  }

  function signOut() {
    try { localStorage.removeItem(ACCOUNT_KEY); } catch (e) {}
  }

  /* ---------------------------------------------------------------- plan */
  function setPlan(planId, billing) {
    var acct = getAccount();
    if (!acct) return { ok: false, error: 'Sign in first.' };
    if (!PLANS[planId]) return { ok: false, error: 'Unknown plan.' };
    billing = billing === 'yearly' ? 'yearly' : 'monthly';

    if (planId === 'free') {
      acct.plan = 'free';
      acct.billing = 'monthly';
      acct.status = 'active';
      acct.renewsAt = null;
      acct.startedAt = null;
      acct.seats = 1;
      saveAccount(acct);
      track('plan_select', { plan: 'free', billing: 'monthly' });
      return { ok: true, account: acct };
    }

    var now = new Date();
    acct.plan = planId;
    acct.billing = billing;
    acct.status = 'active';
    acct.startedAt = now.toISOString();
    acct.renewsAt = (billing === 'yearly' ? addMonths(now, 12) : addMonths(now, 1)).toISOString();
    acct.seats = PLANS[planId].seats;
    saveAccount(acct);
    track('purchase', { plan: planId, billing: billing, amount: priceFor(planId, billing) });
    return { ok: true, account: acct };
  }

  function cancel() {
    var acct = getAccount();
    if (!acct) return { ok: false, error: 'Sign in first.' };
    if (acct.plan === 'free') return { ok: false, error: 'The Free plan has nothing to cancel.' };
    acct.status = 'canceled';
    saveAccount(acct);
    return { ok: true, account: acct };
  }

  function resume() {
    var acct = getAccount();
    if (!acct) return { ok: false, error: 'Sign in first.' };
    if (acct.status !== 'canceled') return { ok: false, error: 'Nothing to resume.' };
    acct.status = 'active';
    saveAccount(acct);
    return { ok: true, account: acct };
  }

  /* ------------------------------------------------------------ progress */
  function getProgress() {
    var p = readJSON(PROGRESS_KEY, null);
    if (!p || typeof p !== 'object') p = {};
    if (!Array.isArray(p.done)) p.done = [];
    return p;
  }

  function completeLesson(n) {
    n = parseInt(n, 10);
    if (!n) return getProgress();
    var p = getProgress();
    if (p.done.indexOf(n) === -1) p.done.push(n);
    p.done.sort(function (a, b) { return a - b; });
    p.updatedAt = new Date().toISOString();
    writeJSON(PROGRESS_KEY, p);
    return p;
  }

  function uncompleteLesson(n) {
    n = parseInt(n, 10);
    var p = getProgress();
    p.done = p.done.filter(function (x) { return x !== n; });
    writeJSON(PROGRESS_KEY, p);
    return p;
  }

  function isComplete(n) {
    return getProgress().done.indexOf(parseInt(n, 10)) !== -1;
  }

  function progressCount() { return getProgress().done.length; }

  function resetProgress() {
    writeJSON(PROGRESS_KEY, { done: [] });
    return getProgress();
  }

  /* --------------------------------------------------------------- money */
  function priceFor(planId, billing) {
    var p = PLANS[planId];
    if (!p) return 0;
    if (planId === 'free') return 0;
    return billing === 'yearly' ? p.yearly * 12 : p.monthly;
  }

  function savingsFor(planId) {
    var p = PLANS[planId];
    if (!p || planId === 'free') return { amount: 0, pct: 0 };
    var full = p.monthly * 12;
    var disc = p.yearly * 12;
    return { amount: full - disc, pct: Math.round(((full - disc) / full) * 100) };
  }

  function money(n) {
    return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  /* ----------------------------------------------------------------- nav
     Any element with [data-lp-nav] is replaced with the auth-aware nav
     actions. Any element with [data-lp-plan-badge] shows the current plan. */
  function basePath() {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (/assets\/app\.js/.test(all[i].src)) { s = all[i]; break; }
      }
    }
    var src = s ? s.getAttribute('src') || '' : 'assets/app.js';
    return src.replace(/assets\/app\.js.*$/, '');
  }

  /* v6: no accounts, no plans. The nav slot is a single Support link. */
  function renderNav() {
    var base = basePath();
    var nodes = document.querySelectorAll('[data-lp-nav]');
    var i;

    for (i = 0; i < nodes.length; i++) {
      nodes[i].innerHTML =
        '<a href="' + base + 'index.html#curriculum" class="btn btn-ghost btn-sm">All lessons</a>' +
        '<a href="' + base + 'index.html#support" class="btn btn-primary btn-sm">Support this site</a>';
    }

    var badges = document.querySelectorAll('[data-lp-plan-badge]');
    for (i = 0; i < badges.length; i++) badges[i].textContent = 'Free';

    document.documentElement.setAttribute('data-plan', 'free');
    document.documentElement.setAttribute('data-auth', 'out');
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    var a = (parts[0] || '?').charAt(0);
    var b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (a + b).toUpperCase();
  }

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'You';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ------------------------------------------------------- lesson content
     v6: nothing is gated. Any legacy [data-pro-content] block is simply
     shown, and any legacy [data-pro-lock] panel is hidden for good. */
  function applyLessonGate() {
    var content = document.querySelectorAll('[data-pro-content]');
    var locks = document.querySelectorAll('[data-pro-lock]');
    var i;

    for (i = 0; i < content.length; i++) {
      content[i].removeAttribute('hidden');
      content[i].classList.add('is-unlocked');
    }
    for (i = 0; i < locks.length; i++) locks[i].setAttribute('hidden', '');

    // "mark complete" control
    var mark = document.querySelector('[data-mark-complete]');
    if (mark) {
      var n = mark.getAttribute('data-mark-complete');
      var done = isComplete(n);
      mark.textContent = done ? '✓ Completed' : 'Mark as complete';
      mark.classList.toggle('is-done', done);
      mark.addEventListener('click', function () {
        var was = isComplete(n);
        if (was) uncompleteLesson(n); else completeLesson(n);
        if (!was) track('lesson_complete', { lesson: parseInt(n, 10) });
        var nowDone = isComplete(n);
        mark.textContent = nowDone ? '✓ Completed' : 'Mark as complete';
        mark.classList.toggle('is-done', nowDone);
      });
    }
  }

  /* ------------------------------------------------------------- analytics
     Privacy-friendly conversion tracking.

     Wraps Plausible (loaded in each page's <head>). Plausible is cookieless
     and does not fingerprint, so it needs no consent banner in the EU.

     Every call is a no-op when the script is blocked or absent, so tracking
     can never break the UI. To swap providers, change only `send` below.

     Standard conversion events used across the site:
       signup            account created
       plan_select       a plan was chosen on the pricing table / checkout
       checkout_start    the pay step was submitted
       purchase          a plan was granted (demo or real)
       newsletter_submit email capture
       upgrade_click     a locked lesson / upsell CTA was clicked
       lesson_complete   a lesson was marked done                            */
  function track(event, props) {
    try {
      if (typeof window.plausible === 'function') {
        window.plausible(event, props ? { props: props } : undefined);
      }
      // Local echo so you can verify events during development:
      //   localStorage.getItem('learnphp.events')
      var log = readJSON('learnphp.events.v1', []);
      log.push({ e: event, p: props || null, t: new Date().toISOString() });
      if (log.length > 100) log = log.slice(-100);
      writeJSON('learnphp.events.v1', log);
    } catch (e) {
      /* analytics must never throw into the page */
    }
  }

  /* ------------------------------------------------- conversion delegation
     One delegated listener rather than an edit to all 96 lesson pages.
     Any CTA inside a lock panel or an upgrade banner reports upgrade_click;
     any pricing-table plan button reports plan_select. */
  function bindConversionClicks() {
    document.addEventListener('click', function (ev) {
      var el = ev.target;
      if (!el || !el.closest) return;

      var up = el.closest('[data-pro-lock] a, .upgrade a, a[data-track-upgrade]');
      if (up) {
        track('upgrade_click', {
          lesson: up.getAttribute('data-lesson') || null,
          href: up.getAttribute('href') || null
        });
        return;
      }

      var planBtn = el.closest('[data-plan][data-billing], [data-plan-cta]');
      if (planBtn) {
        track('plan_select', {
          plan: planBtn.getAttribute('data-plan') || planBtn.getAttribute('data-plan-cta'),
          billing: planBtn.getAttribute('data-billing') || null,
          source: 'pricing_table'
        });
      }
    }, { passive: true });
  }

  /* --------------------------------------------------------------- init */
  function init() {
    renderNav();
    applyLessonGate();
    bindConversionClicks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* --------------------------------------------------------------- API */
  window.LP = {
    PLANS: PLANS,
    ORDER: ORDER,
    getAccount: getAccount,
    isSignedIn: isSignedIn,
    effectivePlan: effectivePlan,
    accessActive: accessActive,
    hasPro: hasPro,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    setPlan: setPlan,
    cancel: cancel,
    resume: resume,
    getProgress: getProgress,
    completeLesson: completeLesson,
    uncompleteLesson: uncompleteLesson,
    isComplete: isComplete,
    progressCount: progressCount,
    resetProgress: resetProgress,
    priceFor: priceFor,
    savingsFor: savingsFor,
    money: money,
    fmtDate: fmtDate,
    daysUntil: daysUntil,
    track: track,
    basePath: basePath,
    renderNav: renderNav,
    applyLessonGate: applyLessonGate,
    escapeHtml: escapeHtml,
    initials: initials,
    firstName: firstName
  };
})();

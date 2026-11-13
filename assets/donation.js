/* ==========================================================================
   Learn PHP — Maya donation widget
   --------------------------------------------------------------------------
   Renders every [data-donation] placeholder from assets/donation-config.js.

   The QR is the owner's real Maya QR card image (assets/maya-qr.jpg), shown
   at a scannable size. If that image fails to load, the block falls back to
   a tidy "Donation details coming soon" panel — never a broken image icon.

   Account text is only shown when the config actually contains it. Nothing
   is invented: a masked number stays masked and is not offered as a copy
   target, because copying a masked number would be useless.

   Variants (set on the placeholder):
     data-donation="block"    full card — homepage, lesson pages, projects
     data-donation="compact"  one-line strip — header / footer
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.LEARN_PHP_DONATION || {};
  var QR_IMAGE = String(CFG.QR_IMAGE || '').trim();
  var LABEL = String(CFG.LABEL || 'Maya').trim();
  var NAME = String(CFG.ACCOUNT_NAME || '').trim();
  var HANDLE = String(CFG.ACCOUNT_HANDLE || '').trim();
  var MASKED = String(CFG.MASKED_NUMBER || '').trim();
  var NUMBER = String(CFG.MAYA_NUMBER || '').trim();
  var LINK = String(CFG.MAYA_LINK || '').trim();

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function usableLink() {
    if (!LINK) return '';
    if (!/^https?:\/\//i.test(LINK)) return '';
    return LINK;
  }

  /* Resolve the QR path relative to the page, so the same config works from
     the site root and from lessons/ or projects/ (which pass a prefix). */
  function qrSrc(prefix) {
    if (!QR_IMAGE) return '';
    if (/^https?:\/\//i.test(QR_IMAGE)) return QR_IMAGE;
    return (prefix || '') + QR_IMAGE;
  }

  function soonPanel() {
    return '' +
      '<div class="dn-soon">' +
        '<span class="dn-soon-ico" aria-hidden="true">&#9825;</span>' +
        '<div>' +
          '<b>Donation details coming soon</b>' +
          '<p>The ' + esc(LABEL) + ' QR code could not be loaded. ' +
          'Everything on this site is free in the meantime &mdash; no account, no card.</p>' +
        '</div>' +
      '</div>';
  }

  /* The copyable rows. Only rendered for values that are actually present
     and actually useful to copy. */
  function detailRows(uid) {
    var rows = '';

    if (NAME) {
      rows += '' +
        '<div class="dn-num-row">' +
          '<span class="dn-num-label">Account name</span>' +
          '<code class="dn-num dn-num-sm" id="' + uid + '-name">' + esc(NAME) + '</code>' +
          '<button type="button" class="dn-copy" data-copy-target="' + uid + '-name">' +
            '<span class="dn-copy-ico" aria-hidden="true">&#10697;</span>' +
            '<span class="dn-copy-txt">Copy</span>' +
          '</button>' +
        '</div>';
    }

    if (HANDLE) {
      rows += '' +
        '<div class="dn-num-row">' +
          '<span class="dn-num-label">' + esc(LABEL) + ' handle</span>' +
          '<code class="dn-num dn-num-sm" id="' + uid + '-handle">' + esc(HANDLE) + '</code>' +
          '<button type="button" class="dn-copy" data-copy-target="' + uid + '-handle">' +
            '<span class="dn-copy-ico" aria-hidden="true">&#10697;</span>' +
            '<span class="dn-copy-txt">Copy</span>' +
          '</button>' +
        '</div>';
    }

    if (NUMBER) {
      rows += '' +
        '<div class="dn-num-row">' +
          '<span class="dn-num-label">' + esc(LABEL) + ' number</span>' +
          '<code class="dn-num" id="' + uid + '-num">' + esc(NUMBER) + '</code>' +
          '<button type="button" class="dn-copy" data-copy-target="' + uid + '-num">' +
            '<span class="dn-copy-ico" aria-hidden="true">&#10697;</span>' +
            '<span class="dn-copy-txt">Copy number</span>' +
          '</button>' +
        '</div>';
    } else if (MASKED) {
      /* Masked in the source image — shown, but not offered as a copy target. */
      rows += '' +
        '<div class="dn-num-row dn-num-row-masked">' +
          '<span class="dn-num-label">' + esc(LABEL) + ' number</span>' +
          '<code class="dn-num">' + esc(MASKED) + '</code>' +
        '</div>' +
        '<p class="dn-masked-note">The number is masked on the QR card. Scan the code to pay &mdash; ' +
        'the ' + esc(LABEL) + ' app fills in the account for you.</p>';
    }

    return rows;
  }

  function blockHtml(uid, prefix) {
    var src = qrSrc(prefix);
    var link = usableLink();

    var head = '' +
      '<div class="dn-head">' +
        '<p class="dn-eyebrow">Support this site</p>' +
        '<h3>Keep Learn PHP free for everyone</h3>' +
        '<p class="dn-lede">All 96 lessons and every project brief are free, with no account and no paywall. ' +
        'If the material saved you time, you can send a tip with ' + esc(LABEL) + '.</p>' +
      '</div>';

    var body;
    if (src) {
      body = '' +
        '<div class="dn-body">' +
          '<div class="dn-qr-wrap">' +
            '<div class="dn-qr">' +
              '<img class="dn-qr-img" src="' + esc(src) + '" alt="' + esc(LABEL) + ' donation QR code' +
                (NAME ? ' for ' + esc(NAME) : '') + '" width="1080" height="1518" loading="lazy" decoding="async">' +
            '</div>' +
            '<p class="dn-qr-cap">Scan with the ' + esc(LABEL) + ' app</p>' +
          '</div>' +
          '<div class="dn-details">' +
            detailRows(uid) +
            (link
              ? '<p class="dn-or">or open the payment page</p>' +
                '<a class="dn-link" href="' + esc(link) + '" rel="noopener" target="_blank">' +
                'Open the ' + esc(LABEL) + ' payment page &rarr;</a>'
              : '') +
          '</div>' +
        '</div>';
    } else {
      body = soonPanel();
    }

    var note = '' +
      '<p class="dn-note">' +
        '<b>Donations are voluntary.</b> The site stays completely free whether you give or not &mdash; ' +
        'nothing is gated, and no lesson is ever locked behind a payment.' +
      '</p>';

    return '<div class="dn-card">' + head + body + note + '</div>';
  }

  function compactHtml(prefix) {
    var src = qrSrc(prefix);
    if (!src) {
      return '<span class="dn-compact-soon">' + esc(LABEL) + ' donations coming soon</span>';
    }
    return '<a class="dn-compact" href="#support">' +
      '<span class="dn-compact-ico" aria-hidden="true">&#9825;</span>' +
      '<span>Support this site &middot; ' + esc(LABEL) + '</span>' +
      '</a>';
  }

  /* If the QR image 404s or is blocked, swap the whole block for the
     "coming soon" panel so the visitor never sees a broken image. */
  function wireImageFallback(root) {
    var imgs = root.querySelectorAll('.dn-qr-img');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].addEventListener('error', function () {
        var card = this.closest('.dn-card');
        if (!card) return;
        var body = card.querySelector('.dn-body');
        if (body) body.outerHTML = soonPanel();
      });
    }
  }

  function wireCopy(root) {
    var btns = root.querySelectorAll('.dn-copy');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var btn = this;
        var target = document.getElementById(btn.getAttribute('data-copy-target'));
        if (!target) return;
        var text = target.textContent.trim();
        var txt = btn.querySelector('.dn-copy-txt');

        function done(ok) {
          if (!txt) return;
          txt.textContent = ok ? 'Copied' : 'Press Ctrl+C';
          btn.classList.toggle('is-copied', ok);
          /* If the clipboard API was refused (insecure context, permission
             denied, older browser), select the text so Ctrl+C works. */
          if (!ok) selectText(target);
          setTimeout(function () {
            txt.textContent = 'Copy';
            btn.classList.remove('is-copied');
          }, 1800);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); },
            function () { fallback(text, done); });
        } else {
          fallback(text, done);
        }
      });
    }
  }

  /* Select an element's text so the visitor can press Ctrl+C themselves. */
  function selectText(el) {
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* nothing else to do */ }
  }

  function fallback(text, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(!!ok);
    } catch (e) {
      done(false);
    }
  }

  function render() {
    var nodes = document.querySelectorAll('[data-donation]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var variant = el.getAttribute('data-donation');
      /* data-donation-prefix lets a page in lessons/ point at ../assets/ */
      var prefix = el.getAttribute('data-donation-prefix') || '';
      if (variant === 'compact') {
        el.innerHTML = compactHtml(prefix);
      } else {
        el.innerHTML = blockHtml('dn-' + i, prefix);
      }
      wireImageFallback(el);
      wireCopy(el);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  window.LP_DONATION = {
    name: NAME,
    handle: HANDLE,
    hasNumber: !!NUMBER,
    qrImage: QR_IMAGE,
    render: render
  };
})();

/* Don't Overthink - project page behaviour.
   Math rendering, the stage-by-stage walkthrough, the source-of-gains
   chart, table-of-contents scroll-spy, reading progress, figure lightbox
   and BibTeX copy. No dependencies beyond KaTeX, which is optional: the
   page works without it. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- math ---------- */
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }

  /* ---------- placeholder links (paper / code not out yet) ---------- */
  document.querySelectorAll('.is-pending').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* ---------- stage-by-stage walkthrough ---------- */
  // Without JS every example shows all its stages; with JS the stages of the
  // active example are revealed one at a time, and the walkthrough advances
  // on its own while it is on screen and not paused.
  var demo = document.getElementById('demo-walk');
  if (demo) {
    var examples = Array.prototype.slice.call(demo.querySelectorAll('.demo-example'));
    var tabs = Array.prototype.slice.call(demo.querySelectorAll('[role="tab"]'));
    var stepBtns = Array.prototype.slice.call(demo.querySelectorAll('.demo-steps button'));
    var playBtn = demo.querySelector('.demo-play');
    var LAST = 5;
    var STEP_MS = 2600;   // time on each reasoning stage
    var HOLD_MS = 4200;   // time on the finished edit before the next example
    var ex = 0;
    var step = 1;
    var inView = false;
    var playing = !reduceMotion;
    var timer = null;

    function render() {
      examples.forEach(function (el, k) {
        var active = k === ex;
        el.classList.toggle('active', active);
        el.setAttribute('aria-hidden', active ? 'false' : 'true');
        if (active) el.removeAttribute('inert'); else el.setAttribute('inert', '');
        el.dataset.step = active ? step : LAST;
        el.querySelectorAll('.ds').forEach(function (ds) {
          var s = +ds.dataset.step;
          ds.classList.toggle('on', !active || s <= step);
          ds.classList.toggle('now', active && s === step);
        });
      });
      tabs.forEach(function (t, k) {
        t.setAttribute('aria-selected', k === ex ? 'true' : 'false');
        t.tabIndex = k === ex ? 0 : -1;
      });
      stepBtns.forEach(function (b) {
        var s = +b.dataset.go;
        b.classList.toggle('now', s === step);
        b.classList.toggle('done', s < step);
        b.setAttribute('aria-current', s === step ? 'step' : 'false');
      });
      playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      playBtn.setAttribute('aria-label', playing ? 'Pause the walkthrough' : 'Play the walkthrough');
    }

    function schedule() {
      clearTimeout(timer);
      if (!playing || !inView) return;
      timer = setTimeout(function () {
        if (step < LAST) { step += 1; }
        else { ex = (ex + 1) % examples.length; step = 1; }
        render();
        schedule();
      }, step === LAST ? HOLD_MS : STEP_MS);
    }

    function goTo(e, s) {
      ex = ((e % examples.length) + examples.length) % examples.length;
      step = s;
      render();
      schedule();
    }

    demo.classList.add('is-live');
    if (reduceMotion) step = LAST;

    tabs.forEach(function (t, k) {
      t.addEventListener('click', function () { goTo(k, reduceMotion ? LAST : 1); });
    });
    // Choosing a stage by hand pauses the walkthrough on it.
    stepBtns.forEach(function (b) {
      b.addEventListener('click', function () { playing = false; goTo(ex, +b.dataset.go); });
    });
    playBtn.addEventListener('click', function () {
      playing = !playing;
      if (playing && step === LAST) { ex = (ex + 1) % examples.length; step = 1; }
      render();
      schedule();
    });

    demo.addEventListener('keydown', function (e) {
      if (e.target.closest('.demo-tabs')) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(ex - 1, 1); tabs[ex].focus(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); goTo(ex + 1, 1); tabs[ex].focus(); }
        return;
      }
      if (e.key === 'ArrowLeft' && step > 1) { e.preventDefault(); playing = false; goTo(ex, step - 1); }
      if (e.key === 'ArrowRight' && step < LAST) { e.preventDefault(); playing = false; goTo(ex, step + 1); }
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          inView = entry.isIntersecting;
          schedule();
        });
      }, { threshold: 0.35 }).observe(demo);
    } else {
      inView = true;
    }

    render();
    schedule();
  }

  /* ---------- source-of-gains chart: bars grow in once, when first seen ---------- */
  var chart = document.getElementById('gain-chart');
  if (chart && !reduceMotion && 'IntersectionObserver' in window) {
    chart.classList.add('pre');
    var chartObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        // Let the hidden state paint once before animating out of it.
        window.requestAnimationFrame(function () { chart.classList.remove('pre'); });
        chartObs.disconnect();
      });
    }, { threshold: 0.4 });
    chartObs.observe(chart);
  }

  /* ---------- table of contents: scroll-spy ---------- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc ol a[href^="#"]'));
  var targets = tocLinks.map(function (a) {
    return document.getElementById(a.getAttribute('href').slice(1));
  });
  var bar = document.getElementById('progress-bar');
  var ticking = false;

  function update() {
    ticking = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';

    var idx = -1;
    var line = Math.min(160, window.innerHeight * 0.3);
    for (var i = 0; i < targets.length; i++) {
      if (targets[i] && targets[i].getBoundingClientRect().top - line <= 0) idx = i;
    }
    if (max > 0 && window.scrollY >= max - 2) idx = targets.length - 1;

    tocLinks.forEach(function (a, i) { a.classList.toggle('active', i === idx); });
    var activeLink = tocLinks[idx];
    document.querySelectorAll('.toc li').forEach(function (li) {
      li.classList.toggle('open', !!activeLink && li.contains(activeLink));
    });
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();

  /* ---------- mobile table of contents ---------- */
  var toc = document.getElementById('toc');
  var toggle = document.getElementById('toc-toggle');
  var scrim = document.getElementById('scrim');
  function setToc(open) {
    toc.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    scrim.hidden = !open;
  }
  if (toc && toggle && scrim) {
    toggle.addEventListener('click', function () { setToc(!toc.classList.contains('open')); });
    scrim.addEventListener('click', function () { setToc(false); });
    toc.addEventListener('click', function (e) {
      if (e.target.closest('a') && toc.classList.contains('open')) setToc(false);
    });
  }

  /* ---------- lightbox ---------- */
  var lb = document.getElementById('lightbox');
  var lbImg = lb && lb.querySelector('img');
  function closeLightbox() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    lbImg.removeAttribute('src');
    document.body.style.overflow = '';
  }
  document.querySelectorAll('img.zoomable').forEach(function (img) {
    img.addEventListener('click', function () {
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt;
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      lb.querySelector('.lightbox-close').focus();
    });
  });
  if (lb) lb.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeLightbox();
    if (toc && toc.classList.contains('open')) setToc(false);
  });

  /* ---------- BibTeX copy ---------- */
  var copyBtn = document.getElementById('copy-bib');
  var bibText = document.getElementById('bib-text');
  if (copyBtn && bibText) {
    copyBtn.addEventListener('click', function () {
      var text = bibText.textContent;
      function done() {
        copyBtn.textContent = 'Copied';
        setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1600);
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var range = document.createRange();
        range.selectNodeContents(bibText);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        try { document.execCommand('copy'); done(); } catch (e) { /* leave it selected */ }
      }
    });
  }
})();

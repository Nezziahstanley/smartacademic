// ============================================================
// SMARTACADEMIC — Public Home Page Script (Enhanced)
// Hero slider, video lazy load, scroll reveal, counters,
// risk bar, testimonial slider, tilt effect, ripple, etc.
// ============================================================

'use strict';

(function () {
  /* ---------- Helpers ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Footer year ---------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Mobile hamburger ---------- */
  const hamburger = $('#hamburger');
  const navLinks  = $('#navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => navLinks.classList.remove('open'))
    );
    window.addEventListener('resize', () => {
      if (window.innerWidth > 640) navLinks.classList.remove('open');
    });
  }

  /* ============================================================
     HERO SLIDER
     ============================================================ */
  const slides = $$('.hero-slider .slide');
  const dots   = $$('#sliderDots .dot');
  let slideIndex = 0;
  let slideTimer = null;

  function goToSlide(i) {
    slideIndex = (i + slides.length) % slides.length;
    slides.forEach((s, idx) => s.classList.toggle('active', idx === slideIndex));
    dots.forEach((d, idx) => d.classList.toggle('active', idx === slideIndex));
  }
  function nextSlide() { goToSlide(slideIndex + 1); }

  function startSlider() {
    if (slides.length < 2) return;
    stopSlider();
    slideTimer = setInterval(nextSlide, 5500);
  }
  function stopSlider() { if (slideTimer) clearInterval(slideTimer); }

  dots.forEach(d =>
    d.addEventListener('click', () => {
      goToSlide(parseInt(d.dataset.slide, 10));
      startSlider();
    })
  );

  // Pause when tab is hidden (battery friendly)
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stopSlider() : startSlider();
  });

  startSlider();

  /* ============================================================
     SCROLL REVEAL (IntersectionObserver)
     ============================================================ */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.dataset.delay || '0', 10);
          setTimeout(() => entry.target.classList.add('is-visible'), delay);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ============================================================
     ANIMATED COUNTERS
     ============================================================ */
  function animateCounter(el) {
    const target = parseInt(el.dataset.target, 10) || 0;
    const suffix = el.dataset.suffix || '';
    const duration = 1600;
    const start = performance.now();

    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const val = Math.floor(target * eased);
      el.textContent = val.toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString() + suffix;
    }
    requestAnimationFrame(tick);
  }

  const counters = $$('.counter-num');
  if (counters.length && 'IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach((c) => cio.observe(c));
  }

  /* ============================================================
     RISK BAR (animate segment widths on view)
     ============================================================ */
  const riskBar = $('.risk-bar');
  if (riskBar && 'IntersectionObserver' in window) {
    const segs = $$('.risk-bar-seg', riskBar);
    const rObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          riskBar.classList.add('in-view');
          segs.forEach((s) => { s.style.width = (s.dataset.pct || '0') + '%'; });
          rObs.unobserve(riskBar);
        }
      });
    }, { threshold: 0.4 });
    rObs.observe(riskBar);
  }

  /* ============================================================
     VIDEO — LOCAL FILE (falls back to YouTube if configured)
     ============================================================ */

  // 🔧 CONFIGURATION:
  // Set USE_LOCAL_VIDEO = true to play frontend/public/assets/videos/demo.mp4
  // Set USE_LOCAL_VIDEO = false to play the YouTube video below
  const USE_LOCAL_VIDEO = true;
  const VIDEO_PATH = '/assets/videos/demo.mp4';
  const VIDEO_ID = ''; // YouTube ID (only used if USE_LOCAL_VIDEO is false)

  const videoThumb   = $('#videoThumb');
  const videoPlay    = $('#videoPlay');
  const iframeWrap   = $('#videoIframeWrap');

  function playVideo() {
    if (!iframeWrap) return;

    // ---------- LOCAL VIDEO ----------
    if (USE_LOCAL_VIDEO) {
      const video = document.createElement('video');
      video.src = VIDEO_PATH;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.style.cssText = 'width:100%;height:100%;object-fit:cover;background:#000;';

      video.onerror = () => {
        console.warn('[video] Local file failed to load:', VIDEO_PATH);
        iframeWrap.innerHTML =
          '<div style="display:grid;place-items:center;height:100%;color:#fff;text-align:center;padding:20px;">' +
            '<div>' +
              '<div style="font-size:48px;margin-bottom:12px;">🎬</div>' +
              '<p style="font-size:14px;opacity:.85;">Video file not found.</p>' +
              '<p style="font-size:12px;opacity:.65;margin-top:6px;">Expected: ' + VIDEO_PATH + '</p>' +
            '</div>' +
          '</div>';
      };

      iframeWrap.innerHTML = '';
      iframeWrap.appendChild(video);
      iframeWrap.hidden = false;
      if (videoThumb) videoThumb.style.display = 'none';
      return;
    }

    // ---------- YOUTUBE FALLBACK ----------
    if (!VIDEO_ID) {
      console.warn('[video] No VIDEO_ID set and USE_LOCAL_VIDEO is false');
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    iframe.title = 'SMARTACADEMIC Demo';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    iframeWrap.innerHTML = '';
    iframeWrap.appendChild(iframe);
    iframeWrap.hidden = false;
    if (videoThumb) videoThumb.style.display = 'none';
  }

  if (videoPlay) {
    videoPlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      playVideo();
    });
  }
  if (videoThumb) {
    videoThumb.addEventListener('click', (e) => {
      // Ignore clicks on the play button (it has its own handler)
      if (e.target.closest('.video-play')) return;
      e.preventDefault();
      playVideo();
    });
  }

  /* ============================================================
     TESTIMONIAL SLIDER
     ============================================================ */
  const tTrack = $('#testimonialTrack');
  const tPrev  = $('#tPrev');
  const tNext  = $('#tNext');
  const tDots  = $('#tDots');

  if (tTrack) {
    const items = $$('.testimonial', tTrack);
    let tIndex = 0;
    let tTimer = null;

    function renderDots() {
      if (!tDots) return;
      tDots.innerHTML = '';
      items.forEach((_, i) => {
        const b = document.createElement('button');
        b.setAttribute('aria-label', 'Go to testimonial ' + (i + 1));
        if (i === tIndex) b.classList.add('active');
        b.addEventListener('click', () => { tGoTo(i); restartAuto(); });
        tDots.appendChild(b);
      });
    }

    function tGoTo(i) {
      tIndex = (i + items.length) % items.length;
      tTrack.style.transform = `translateX(-${tIndex * 100}%)`;
      renderDots();
    }

    function restartAuto() {
      if (tTimer) clearInterval(tTimer);
      tTimer = setInterval(() => tGoTo(tIndex + 1), 6000);
    }

    if (tPrev) tPrev.addEventListener('click', () => { tGoTo(tIndex - 1); restartAuto(); });
    if (tNext) tNext.addEventListener('click', () => { tGoTo(tIndex + 1); restartAuto(); });

    // Swipe support on touch
    let touchStartX = 0;
    tTrack.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    tTrack.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        dx < 0 ? tGoTo(tIndex + 1) : tGoTo(tIndex - 1);
        restartAuto();
      }
    });

    renderDots();
    restartAuto();
  }

  /* ============================================================
     TILT EFFECT on .tilt cards
     ============================================================ */
  const tiltCards = $$('.tilt');
  const isTouch = matchMedia('(hover: none)').matches;
  if (!isTouch) {
    tiltCards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const rx = (y - 0.5) * -8;  // deg
        const ry = (x - 0.5) * 8;   // deg
        card.style.transform =
          `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ============================================================
     RIPPLE on .ripple buttons
     ============================================================ */
  $$('.ripple').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const rip = document.createElement('span');
      rip.className = 'rip';
      rip.style.width = rip.style.height = size + 'px';
      rip.style.left = (e.clientX - rect.left - size / 2) + 'px';
      rip.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
      btn.appendChild(rip);
      setTimeout(() => rip.remove(), 620);
    });
  });

  /* ============================================================
     ACTIVE NAV HIGHLIGHT on scroll
     ============================================================ */
  const sections = $$('section[id]');
  const navItems = $$('.nav-links a[href^="#"]');
  if ('IntersectionObserver' in window && sections.length) {
    const nObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navItems.forEach((link) => {
            const isActive = link.getAttribute('href') === `#${id}`;
            link.style.color = isActive ? 'var(--primary)' : '';
          });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach((s) => nObs.observe(s));
  }

  /* ============================================================
     LOGGED-IN BANNER
     ============================================================ */
  const token = localStorage.getItem('sa_token');
  const role  = localStorage.getItem('sa_role');
  if (token && role) {
    const dashboards = {
      admin:    '/admin/dashboard.html',
      hod:      '/hod/dashboard.html',
      lecturer: '/lecturer/dashboard.html',
      student:  '/student/dashboard.html',
    };
    const target = dashboards[role];
    if (target) {
      const banner = document.createElement('div');
      banner.style.cssText = `
        background: #f0fdf4;
        color: #14532d;
        text-align: center;
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 600;
        border-bottom: 1px solid #dcfce7;
      `;
      banner.innerHTML = `You are logged in as <strong>${role}</strong>. <a href="${target}" style="color:#166534;text-decoration:underline;font-weight:800;">Go to Dashboard →</a>`;
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }

  /* ============================================================
     SIMPLE TYPEWRITER on hero headline (optional)
     ============================================================ */
  const typeTarget = document.getElementById('typeTarget');
  if (typeTarget && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const fullText = typeTarget.textContent.trim();
    // Only run if the text is short enough to look nice
    if (fullText.length < 60) {
      typeTarget.textContent = '';
      let i = 0;
      const tick = () => {
        typeTarget.textContent = fullText.slice(0, i);
        i++;
        if (i <= fullText.length) {
          setTimeout(tick, 45 + Math.random() * 40);
        }
      };
      // Start when hero is in view
      setTimeout(tick, 500);
    }
  }
})();
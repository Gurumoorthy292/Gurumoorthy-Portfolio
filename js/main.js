'use strict';

(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------------------------------
     1. Accessible Mobile Navigation Drawer (<dialog> + Scroll Snap)
     -------------------------------------------------------------------------- */
  const drawer = document.getElementById('mobile-drawer');
  const openBtn = document.getElementById('drawer-open');
  const closeBtn = document.getElementById('drawer-close');

  if (drawer && openBtn && closeBtn) {
    const scroller = drawer.querySelector('.drawer-scroller');
    const sheet = drawer.querySelector('.drawer-sheet');
    const drawerLinks = drawer.querySelectorAll('.drawer-link');
    let pendingTargetId = null;

    async function openDrawer() {
      if (drawer.open) return;
      drawer.showModal();

      if (!CSS.supports('scroll-initial-target', 'nearest')) {
        scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'instant' });
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
      }

      scroller.scrollTo({ left: 0, behavior: 'auto' });
    }

    function closeDrawer(targetId = null) {
      if (!drawer.open) return;
      pendingTargetId = targetId;
      scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'auto' });
    }

    function onDrawerOpened() {
      openBtn.setAttribute('aria-expanded', 'true');
    }

    function onDrawerClosed() {
      if (!drawer.open) return;
      drawer.close();
      openBtn.setAttribute('aria-expanded', 'false');

      if (pendingTargetId) {
        const targetEl = document.querySelector(pendingTargetId);
        pendingTargetId = null;
        if (targetEl) {
          targetEl.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
          });
        }
      }
    }

    // Track drawer open/closed state via IntersectionObserver on the sheet
    const visibleThreshold = Math.min(0.01, 1 / Math.max(window.innerWidth, 1));
    const drawerObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (entry.intersectionRatio <= visibleThreshold) onDrawerClosed();
        if (entry.intersectionRatio >= 0.99) onDrawerOpened();
      },
      { root: drawer, threshold: [visibleThreshold, 0.99] }
    );
    drawerObserver.observe(sheet);

    // Fallback for backdrop opacity when scroll-driven animations aren't supported
    if (!CSS.supports('animation-timeline: scroll()')) {
      scroller.addEventListener(
        'scroll',
        () => {
          const width = sheet.offsetWidth || 1;
          const ratio = Math.max(0, Math.min(1, 1 - scroller.scrollLeft / width));
          drawer.style.setProperty('--drawer-backdrop', String(ratio));
        },
        { passive: true }
      );
    }

    openBtn.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', () => closeDrawer());

    // Light-dismiss when tapping outside the drawer sheet
    drawer.addEventListener('click', (event) => {
      if (!sheet.contains(event.target)) {
        closeDrawer();
      }
    });

    // Smooth slide-out on Escape key
    drawer.addEventListener('cancel', (event) => {
      if (event.cancelable) {
        event.preventDefault();
        closeDrawer();
      }
    });

    // Always sync aria-expanded when the dialog closes via any path
    drawer.addEventListener('close', () => {
      openBtn.setAttribute('aria-expanded', 'false');
    });

    // Close drawer cleanly and scroll to anchor target on link click
    drawerLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          event.preventDefault();
          closeDrawer(href);
        } else {
          closeDrawer();
        }
      });
    });

    // Auto-close if resized to desktop breakpoint
    const desktopMq = window.matchMedia('(min-width: 961px)');
    desktopMq.addEventListener('change', (event) => {
      if (event.matches && drawer.open) {
        drawer.close();
        openBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* --------------------------------------------------------------------------
     2. Fixed Header Elevation Fallback (for browsers without scroll() timeline)
     -------------------------------------------------------------------------- */
  const siteHeader = document.getElementById('site-header');
  const supportsHeaderTimeline = CSS.supports(
    '(animation-timeline: scroll()) and (animation-range: 0% 100%)'
  );

  if (siteHeader && (!supportsHeaderTimeline || prefersReducedMotion)) {
    const updateHeaderState = () => {
      siteHeader.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });
  }

  /* --------------------------------------------------------------------------
     3. One-Shot Scroll Reveal (IntersectionObserver)
     -------------------------------------------------------------------------- */
  if (!prefersReducedMotion) {
    const revealEls = document.querySelectorAll('.reveal');

    if ('IntersectionObserver' in window && revealEls.length > 0) {
      revealEls.forEach((el) => el.classList.add('reveal-pending'));

      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -24px 0px', threshold: 0.01 }
      );

      revealEls.forEach((el) => revealObserver.observe(el));
    }
  }

  /* --------------------------------------------------------------------------
     4. Active Navigation Link Scroll Spy
     -------------------------------------------------------------------------- */
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('.nav-link, .drawer-nav-list .drawer-link');

  if ('IntersectionObserver' in window && sections.length > 0 && navLinks.length > 0) {
    const setActiveLink = (sectionId) => {
      navLinks.forEach((link) => {
        const isMatch = link.getAttribute('href') === `#${sectionId}`;
        link.classList.toggle('is-active', isMatch);
        if (isMatch) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    };

    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveLink(entry.target.id);
          }
        });
      },
      { rootMargin: '-32% 0px -58% 0px', threshold: 0 }
    );

    sections.forEach((section) => spyObserver.observe(section));
  }

  /* --------------------------------------------------------------------------
     5. Subtle Pointer Spotlight on Cards (Desktop Fine Pointers Only)
     -------------------------------------------------------------------------- */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (finePointer && !prefersReducedMotion) {
    document.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
      });
    });
  }

  /* --------------------------------------------------------------------------
     6. Copy Email Button + Accessible Toast Notification
     -------------------------------------------------------------------------- */
  const copyBtn = document.getElementById('copy-email-btn');
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2400);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const value = copyBtn.getAttribute('data-copy');
      if (!value) return;

      try {
        await navigator.clipboard.writeText(value);
        showToast('Email copied to clipboard');
      } catch {
        // Fallback for non-HTTPS local file previews
        const helper = document.createElement('textarea');
        helper.value = value;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        document.body.removeChild(helper);
        showToast('Email copied to clipboard');
      }
    });
  }

  /* --------------------------------------------------------------------------
     7. Dynamic Copyright Year
     -------------------------------------------------------------------------- */
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();

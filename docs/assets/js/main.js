/* ===========================
   Localix Website — Main JS
   =========================== */

// ---- Navbar scroll effect ----
const navbar = document.getElementById('navbar');
if (navbar) {
  const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      navbar.style.background = isLight
        ? 'rgba(245,245,247,0.97)'
        : 'rgba(13,13,13,0.95)';
    } else {
      navbar.style.background = isLight
        ? 'rgba(245,245,247,0.85)'
        : 'rgba(13,13,13,0.8)';
    }
  }, { passive: true });

  // Update on system theme change
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    navbar.style.background = '';
  });
}

// ---- Hamburger menu ----
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');
if (hamburger && mobileNav) {
  hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !mobileNav.contains(e.target)) {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });

  // Close on mobile-nav link click
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

// ---- FAQ accordion ----
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    // Close all
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    // Toggle current
    if (!isOpen) item.classList.add('open');
  });
});

// ---- Docs sidebar active link ----
const docsLinks = document.querySelectorAll('.docs-nav-link');
if (docsLinks.length) {
  const sections = document.querySelectorAll('.docs-section');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        docsLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-60px 0px -60% 0px', threshold: 0 });

  sections.forEach(s => observer.observe(s));
}

// ---- Smooth scroll for anchor links ----
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ---- Animate elements on scroll ----
const animEls = document.querySelectorAll('.feature-card, .step-card, .pricing-card, .why-free-card, .feature-detail, .changelog-entry');
if ('IntersectionObserver' in window) {
  const animObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        animObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  animEls.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    animObserver.observe(el);
  });
}

// ---- Multi-language Localization (i18n) ----
document.addEventListener('DOMContentLoaded', () => {
  const currentLang = localStorage.getItem('localix_lang') || 'id';
  
  function applyLanguage(lang) {
    if (!window.localixTranslations || !window.localixTranslations[lang]) return;
    const dictionary = window.localixTranslations[lang];
    
    // Translate all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dictionary[key] !== undefined) {
        // If element is a self-closing element or has children we want to preserve carefully
        // or we just set innerHTML directly for format tags like <br /> / <span> / <code> etc.
        el.innerHTML = dictionary[key];
      }
    });

    // Update lang attribute on html tag
    document.documentElement.setAttribute('lang', lang);

    // Update custom dropdown elements to show the selected language
    document.querySelectorAll('.lang-dropdown').forEach(dropdown => {
      const btnText = dropdown.querySelector('span');
      const btnFlag = dropdown.querySelector('img.lang-flag');
      if (btnText && btnFlag) {
        btnText.textContent = lang.toUpperCase();
        if (lang === 'en') {
          btnFlag.style.display = 'none';
        } else {
          btnFlag.style.display = 'inline-block';
          btnFlag.src = `assets/img/flag-${lang}.svg`;
        }
      }
    });
  }

  // Setup language change listeners for custom dropdown
  document.querySelectorAll('.lang-dropdown').forEach(dropdown => {
    const btn = dropdown.querySelector('.lang-select-btn');
    const items = dropdown.querySelectorAll('.lang-item');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
      btn.classList.toggle('open');
    });

    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const newLang = item.getAttribute('data-value');
        localStorage.setItem('localix_lang', newLang);
        applyLanguage(newLang);
        dropdown.classList.remove('open');
        btn.classList.remove('open');
      });
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.lang-dropdown').forEach(dropdown => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
        const btn = dropdown.querySelector('.lang-select-btn');
        if (btn) btn.classList.remove('open');
      }
    });
  });

  // Apply default or stored language
  applyLanguage(currentLang);
});


var LANG = document.documentElement.lang === 'en' ? 'en' : 'id';

// ---- Theme toggle (light / dark), remembered per browser ----
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var current = root.dataset.theme ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('localix_theme', next); } catch (e) {}
  });
})();

// ---- Mobile menu ----
(function () {
  var nav = document.querySelector('.nav');
  var btn = document.getElementById('menuToggle');
  if (!nav || !btn) return;
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.querySelectorAll('.nav-links a').forEach(function (a) {
    a.addEventListener('click', function () {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ---- Product tour tabs ----
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  if (!tabs.length) return;

  function select(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { select(tab); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); next.focus(); select(next); }
    });
  });
})();

// ---- Docs: table of contents (open on wide screens) + scrollspy ----
(function () {
  var toc = document.querySelector('.docs-toc');
  if (!toc) return;

  var wide = window.matchMedia('(min-width: 961px)');
  function sync() { if (wide.matches) toc.open = true; }
  sync();
  if (wide.addEventListener) wide.addEventListener('change', sync);

  var links = Array.prototype.slice.call(toc.querySelectorAll('.toc-link'));
  links.forEach(function (a) {
    a.addEventListener('click', function () { if (!wide.matches) toc.open = false; });
  });

  if (!('IntersectionObserver' in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var link = byId[entry.target.id];
      if (!link) return;
      links.forEach(function (l) { l.classList.toggle('active', l === link); });
    });
  }, { rootMargin: '-80px 0px -70% 0px' });
  document.querySelectorAll('.prose > section[id]').forEach(function (s) { observer.observe(s); });
})();

// ---- PHP versions, read from the same runtimes.json the app uses ----
(function () {
  var grid = document.getElementById('phpGrid');
  if (!grid) return;

  var T = {
    id: {
      recommended: 'Direkomendasikan', bundled: 'Bawaan installer', eol: 'Sudah EOL', eolSoon: 'Segera EOL',
      support: 'Dukungan hingga', size: 'Ukuran unduhan'
    },
    en: {
      recommended: 'Recommended', bundled: 'Bundled', eol: 'End of life', eolSoon: 'EOL soon',
      support: 'Supported until', size: 'Download size'
    }
  }[LANG];
  var LOCALE = LANG === 'en' ? 'en-GB' : 'id-ID';
  var BUNDLED = '8.4';
  // Used when the manifest can't be fetched (e.g. page opened from file://).
  var FALLBACK = [
    { version: '8.5.11', folder: '8.5', eol: '2029-12-31', recommended: false },
    { version: '8.4.26', folder: '8.4', eol: '2028-12-31', recommended: true },
    { version: '8.3.35', folder: '8.3', eol: '2027-12-31', recommended: false },
    { version: '8.2.34', folder: '8.2', eol: '2026-12-31', recommended: false }
  ];

  function fmtDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function monthsLeft(iso) {
    var now = new Date();
    var d = new Date(iso + 'T00:00:00');
    return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function row(label, value) {
    var r = el('div');
    r.appendChild(el('span', null, label));
    r.appendChild(el('b', null, value));
    return r;
  }

  function render(list) {
    grid.textContent = '';
    list.forEach(function (p) {
      var card = el('div', 'php-card' + (p.recommended ? ' recommended' : ''));
      var badges = el('div', 'badges');
      if (p.recommended) badges.appendChild(el('span', 'badge badge-brand', T.recommended));
      if (p.folder === BUNDLED) badges.appendChild(el('span', 'badge badge-ok', T.bundled));
      var left = p.eol ? monthsLeft(p.eol) : null;
      if (left != null && left <= 6) badges.appendChild(el('span', 'badge badge-warn', left < 0 ? T.eol : T.eolSoon));
      card.appendChild(badges);
      card.appendChild(el('div', 'ver', 'PHP ' + p.folder));
      card.appendChild(el('div', 'patch', p.version));
      var meta = el('div', 'meta');
      meta.appendChild(row(T.support, p.eol ? fmtDate(p.eol) : '-'));
      if (p.size) meta.appendChild(row(T.size, Math.round(p.size / 1048576) + ' MB'));
      card.appendChild(meta);
      grid.appendChild(card);
    });
  }

  render(FALLBACK);

  fetch(grid.dataset.manifest || 'runtimes.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      if (!data || !Array.isArray(data.php) || !data.php.length) return;
      render(data.php);
    })
    .catch(function () { /* keep fallback */ });
})();

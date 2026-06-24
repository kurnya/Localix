const appRoot = document.getElementById('app');

const pages = [
  ['dashboard', 'Dashboard'],
  ['services', 'Services'],
  ['projects', 'Projects'],
  ['laravel', 'Laravel'],
  ['vhosts', 'Virtual Hosts'],
  ['settings', 'Settings'],
  ['logs', 'Logs']
];

let currentPage = 'dashboard';
let statusState = {
  global: 'Stopped',
  apache: { status: 'Stopped', port: 80, lastError: '' },
  mysql: { status: 'Stopped', port: 3306, lastError: '' }
};
let settingsState = null;
let projectsState = [];
let phpVersionsState = [];
let pathsState = {};
let logType = 'localix';
let logText = '';
let laravelState = { running: false, output: '', lastError: '' };
let showCloseModal = false;
let openDropdown = '';

// Pending confirm modal state: { title, message, confirmLabel, confirmClass, onConfirm }
let pendingConfirm = null;

function h(strings, ...values) {
  return strings.reduce((acc, part, index) => `${acc}${part}${values[index] ?? ''}`, '');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function statusClass(status) {
  return String(status || 'Stopped').toLowerCase();
}

function badge(status) {
  return `<span class="badge ${statusClass(status)}">${escapeHtml(status)}</span>`;
}

function customSelect(id, value, options) {
  const selected = options.find((item) => item.value === value) || options[0];
  return h`
    <div class="select-wrap ${openDropdown === id ? 'open' : ''}" data-select-wrap="${escapeHtml(id)}">
      <input type="hidden" id="${escapeHtml(id)}" value="${escapeHtml(selected?.value || '')}">
      <button type="button" class="select-trigger" data-select-toggle="${escapeHtml(id)}">
        <span>${escapeHtml(selected?.label || '')}</span>
        <span class="select-chevron"></span>
      </button>
      <div class="select-menu">
        ${options.map((item) => `
          <button type="button" class="select-option ${item.value === value ? 'selected' : ''}" data-select-option="${escapeHtml(id)}" data-value="${escapeHtml(item.value)}" data-label="${escapeHtml(item.label)}">
            ${escapeHtml(item.label)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function dot(status) {
  return `<span class="dot ${statusClass(status)}"></span>`;
}

function isRunning(service) {
  return service?.status === 'Running';
}

function canStop() {
  return ['Running', 'Partial', 'Error'].includes(statusState.global);
}

function canRestart() {
  return ['Running', 'Partial'].includes(statusState.global);
}

function toast(message, type = 'success') {
  const wrap = document.querySelector('.toast-wrap');
  if (!wrap) return;
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  wrap.appendChild(node);
  setTimeout(() => node.remove(), 3400);
}

async function refreshAll(render = true) {
  const [status, info] = await Promise.all([
    window.localix.getStatus(),
    window.localix.getSettings()
  ]);
  statusState = status;
  settingsState = info.settings;
  projectsState = info.projects || [];
  phpVersionsState = info.phpVersions || [];
  pathsState = info.paths || {};
  laravelState = await window.localix.getLaravelStatus();
  applyTheme(settingsState?.general?.theme || 'light');
  if (currentPage === 'logs') logText = await window.localix.getLogs(logType);
  if (render) renderApp();
}

function applyTheme(theme) {
  const selected = theme || 'system';
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.themePreference = selected;
  document.documentElement.dataset.theme = selected === 'system' ? (prefersDark ? 'dark' : 'light') : selected;
}

async function action(label, fn, options = {}) {
  try {
    const result = await fn();
    if (result?.status) statusState = result.status;
    await refreshAll(options.render !== false);
    toast(result?.message || `${label} selesai.`, result?.ok === false ? 'error' : 'success');
  } catch (error) {
    toast(error.message || String(error), 'error');
  }
}

function renderApp() {
  appRoot.innerHTML = h`
    <div class="shell">
      ${renderSidebar()}
      <main class="main">
        ${renderTopbar()}
        <section class="content">
          ${renderPage()}
        </section>
      </main>
      <div class="toast-wrap"></div>
      ${renderCloseModal()}
      ${renderConfirmModal()}
    </div>
  `;
  bindEvents();
}

function renderConfirmModal() {
  if (!pendingConfirm) return '';
  return h`
    <div class="modal-backdrop">
      <div class="confirm-modal">
        <div class="modal-icon">!</div>
        <div class="modal-copy">
          <h2>${escapeHtml(pendingConfirm.title)}</h2>
          <p>${escapeHtml(pendingConfirm.message)}</p>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" data-confirm-choice="cancel">Batal</button>
          <button class="btn ${escapeHtml(pendingConfirm.confirmClass || 'danger')}" data-confirm-choice="ok">${escapeHtml(pendingConfirm.confirmLabel || 'Ya')}</button>
        </div>
      </div>
    </div>
  `;
}

function showConfirm({ title, message, confirmLabel = 'Ya', confirmClass = 'danger' }) {
  return new Promise((resolve) => {
    pendingConfirm = {
      title,
      message,
      confirmLabel,
      confirmClass,
      onConfirm: resolve
    };
    renderApp();
  });
}

function renderCloseModal() {
  if (!showCloseModal) return '';
  return h`
    <div class="modal-backdrop">
      <div class="confirm-modal">
        <div class="modal-icon">!</div>
        <div class="modal-copy">
          <h2>Tutup Localix?</h2>
          <p>Keluar akan mematikan semua service terlebih dahulu. Hide membuat Localix tetap berjalan di tray.</p>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" data-close-choice="cancel">Batal</button>
          <button class="btn danger" data-close-choice="exit">Keluar</button>
          <button class="btn primary" data-close-choice="hide">Hide</button>
        </div>
      </div>
    </div>
  `;
}

function renderSidebar() {
  return h`
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">
          <img src="../../build/icon.ico" alt="Localix" class="brand-logo">
        </div>
        <div>
          <div class="brand-name">Localix</div>
        </div>
      </div>
      <nav class="nav">
        ${pages.map(([id, label]) => `<button class="nav-item ${currentPage === id ? 'active' : ''}" data-page="${id}">${escapeHtml(label)}</button>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="tiny-label">Global status</div>
        ${badge(statusState.global)}
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const title = pages.find(([id]) => id === currentPage)?.[1] || 'Dashboard';
  return h`
    <header class="topbar">
      <div>
        <h1>${escapeHtml(title)}</h1>
      </div>
      <div>${badge(statusState.global)}</div>
    </header>
  `;
}

function renderPage() {
  return {
    dashboard: renderDashboard,
    services: renderServices,
    projects: renderProjects,
    laravel: renderLaravel,
    vhosts: renderVhosts,
    settings: renderSettings,
    logs: renderLogs
  }[currentPage]();
}

function renderDashboard() {
  return h`
    <div class="dashboard-grid">
      <section class="card hero-card">
        <div class="hero-header">
          <div>
            <h2>Control Panel</h2>
          </div>
          ${settingsState?.virtualHost?.enabled ? `<span class="info-pill">${escapeHtml(settingsState.virtualHost.domainSuffix || '.locx')} vhost</span>` : ''}
        </div>
        <div class="service-list">
          ${serviceRow('Apache', statusState.apache)}
          ${serviceRow('MySQL', statusState.mysql)}
        </div>
        ${renderMainActions()}
        <div class="shortcuts">
          <button class="pill" data-action="openLocalhost">Localhost</button>
          <button class="pill" data-action="openPhpMyAdmin">phpMyAdmin</button>
          <button class="pill" data-action="openWwwFolder">www</button>
        </div>
      </section>
      <aside class="side-stack">
        <section class="card compact">
          <h3>Ports</h3>
          <div class="port-row"><span>Apache</span><strong>:${escapeHtml(statusState.apache.port)}</strong></div>
          <div class="port-row"><span>PHP</span><strong>${escapeHtml(settingsState?.php?.activeVersion || '8.4')}</strong></div>
          <div class="port-row"><span>MySQL</span><strong>:${escapeHtml(statusState.mysql.port)}</strong></div>
        </section>
        <section class="card compact">
          <h3>Quick tools</h3>
          <div class="tool-list">
            <button class="text-btn" data-page="logs">Open logs</button>
            <button class="text-btn" data-page="settings">Settings</button>
            <button class="text-btn" data-page="services">Advanced services</button>
          </div>
        </section>
        ${renderErrorCard()}
      </aside>
    </div>
  `;
}

function serviceRow(name, service) {
  return h`
    <div class="service-row">
      <div class="service-name">${escapeHtml(name)}</div>
      <div class="service-status">${dot(service.status)}<span>${escapeHtml(service.status)}</span></div>
      <div class="service-port">:${escapeHtml(service.port)}</div>
    </div>
  `;
}

function renderMainActions() {
  const startDominant = ['Stopped', 'Partial', 'Error'].includes(statusState.global);
  const stopDominant = statusState.global === 'Running';
  return h`
    <div class="main-actions">
      <button class="btn ${startDominant ? 'primary' : 'secondary'}" data-action="startAll" ${statusState.global === 'Running' ? 'disabled' : ''}>Start All</button>
      <button class="btn ${stopDominant ? 'danger-fill' : 'danger'}" data-action="stopAll" ${canStop() ? '' : 'disabled'}>Stop</button>
      <button class="btn secondary" data-action="restartAll" ${canRestart() ? '' : 'disabled'}>Restart</button>
    </div>
  `;
}

function renderErrorCard() {
  const error = [statusState.apache.lastError, statusState.mysql.lastError].find(Boolean);
  if (!error || statusState.global !== 'Error') return '';
  return h`
    <section class="card compact error-card">
      <h3>Last error</h3>
      <p>${escapeHtml(error)}</p>
      <button class="text-btn danger-text" data-page="logs">View logs</button>
    </section>
  `;
}

function renderServices() {
  return h`
    <div class="stack">
      <section class="card">
        <div class="section-head">
          <div>
            <h2>Services</h2>
          </div>
        </div>
        <div class="service-cards">
          ${advancedServiceCard('Apache', statusState.apache)}
          ${advancedServiceCard('MySQL', statusState.mysql)}
        </div>
      </section>
      <section class="card compact">
        <div class="section-head tight">
          <div>
            <h3>Maintenance</h3>
          </div>
        </div>
        <div class="maintenance-grid">
          <button class="maintenance-action" data-action="checkPorts">
            <strong>Check Ports</strong>
            <span>Validate runtime files and config paths.</span>
          </button>
          <button class="maintenance-action" data-action="repairPhpMyAdminConfig">
            <strong>Repair phpMyAdmin</strong>
            <span>Regenerate config and temp folder.</span>
          </button>
          <button class="maintenance-action danger" data-action="reinitializeMySQLData">
            <strong>Reinitialize MySQL Data</strong>
            <span>Backup data first, then initialize again.</span>
          </button>
        </div>
      </section>
    </div>
  `;
}

function advancedServiceCard(name, service) {
  return h`
    <div class="service-card">
      <div>
        <h3>${escapeHtml(name)}</h3>
        <p>${dot(service.status)} ${escapeHtml(service.status)} on port ${escapeHtml(service.port)}</p>
      </div>
      <div class="inline-actions">
        <button class="btn secondary" data-action="start${name}">Start</button>
        <button class="btn secondary" data-action="stop${name}">Stop</button>
        <button class="btn secondary" data-action="restart${name}">Restart</button>
      </div>
      ${service.lastError ? `<div class="mini-error">${escapeHtml(service.lastError)}</div>` : ''}
    </div>
  `;
}

function renderProjects() {
  return h`
    <section class="card">
      <div class="section-head">
        <div>
          <h2>Projects</h2>
        </div>
        <button class="btn secondary" data-action="openWwwFolder">Open www</button>
      </div>
      ${projectsState.length ? renderProjectTable() : '<div class="empty">Belum ada folder project selain phpmyadmin.</div>'}
    </section>
  `;
}

function renderProjectTable() {
  return h`
    <div class="table-wrap">
      <table>
        <thead><tr><th>Project</th><th>Domain</th><th>Document root</th><th></th></tr></thead>
        <tbody>
          ${projectsState.map((project) => `
            <tr>
              <td>${escapeHtml(project.name)}</td>
              <td>${escapeHtml(project.domain)}</td>
              <td>${escapeHtml(project.documentRoot)}</td>
              <td><button class="mini-btn" data-action="openProject" data-project="${escapeHtml(project.name)}">Open</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderLaravel() {
  const defaultLocation = pathsState.www || '';
  return h`
    <div class="stack">
      <section class="card">
        <div class="section-head">
          <div>
            <h2>Create Laravel Project</h2>
          </div>
          ${laravelState.running ? '<span class="info-pill">Creating...</span>' : '<span class="info-pill muted-pill">Ready</span>'}
        </div>
        <div class="settings-grid laravel-grid">
          <label class="field">
            <span>Nama project</span>
            <input class="input" id="laravelName" placeholder="contoh: toko-online">
          </label>
          <label class="field">
            <span>Lokasi project</span>
            <div class="path-picker">
              <input class="input" id="laravelLocation" value="${escapeHtml(defaultLocation)}">
              <button class="btn secondary" data-action="chooseLaravelLocation" ${laravelState.running ? 'disabled' : ''}>Browse</button>
            </div>
          </label>
        </div>
        <div class="inline-actions">
          <button class="btn primary" data-action="createLaravelProject" ${laravelState.running ? 'disabled' : ''}>Buat Project Laravel</button>
          <button class="btn secondary" data-action="openWwwFolder">Open www</button>
        </div>
      </section>
      <section class="card compact">
        <h3>Composer output</h3>
        <pre class="log-output laravel-output">${escapeHtml(laravelState.output || 'Belum ada proses Laravel.')}</pre>
      </section>
    </div>
  `;
}

function renderVhosts() {
  const s = settingsState?.virtualHost || {};
  return h`
    <div class="stack">
      <section class="card">
        <div class="section-head">
          <div>
            <h2>Virtual Hosts</h2>
          </div>
          ${s.enabled ? '<span class="info-pill">Enabled</span>' : '<span class="info-pill muted-pill">Disabled</span>'}
        </div>
        <div class="settings-grid">
          <label class="toggle-line"><span>Enable Virtual Host</span><input type="checkbox" id="vhEnabled" ${s.enabled ? 'checked' : ''}></label>
          <label class="field"><span>Domain suffix</span><input class="input" id="vhSuffix" value="${escapeHtml(s.domainSuffix || '.locx')}"></label>
          <label class="toggle-line"><span>Use port 80</span><input type="checkbox" id="vhPort80" ${s.usePort80 ? 'checked' : ''}></label>
        </div>
        <div class="inline-actions">
          <button class="btn primary" data-action="saveVhostSettings">Save VHost Settings</button>
          <button class="btn secondary" data-action="generateVirtualHosts">Regenerate Config</button>
          <button class="btn secondary" data-action="copyHostsEntry">Copy Hosts Entry</button>
          <button class="btn secondary" data-action="openHostsFile">Open Hosts File</button>
        </div>
      </section>
      <section class="card compact">
        <h3>Hosts entry</h3>
        <pre class="hosts-box">${escapeHtml(projectsState.map((p) => `127.0.0.1 ${p.domain}`).join('\n') || 'Belum ada project.')}</pre>
      </section>
      <section class="card">
        ${projectsState.length ? renderProjectTable() : '<div class="empty">Belum ada project untuk virtual host.</div>'}
      </section>
    </div>
  `;
}

function renderSettings() {
  const s = settingsState || { apache: {}, mysql: {}, general: {}, virtualHost: {} };
  return h`
    <section class="card settings-card">
      <div class="section-head">
        <div>
          <h2>Settings</h2>
        </div>
      </div>
      <div class="settings-grid">
        <label class="toggle-line"><span>Launch Localix di background saat Windows startup</span><input type="checkbox" id="launchAtStartup" ${s.general.launchAtStartup ? 'checked' : ''}></label>
        <label class="toggle-line"><span>Auto-start server saat Localix dibuka</span><input type="checkbox" id="autoStart" ${s.general.autoStart ? 'checked' : ''}></label>
        <label class="toggle-line"><span>Auto-open browser setelah server aktif</span><input type="checkbox" id="autoOpenBrowser" ${s.general.autoOpenBrowser ? 'checked' : ''}></label>
        <label class="field"><span>Theme</span>
          ${customSelect('theme', s.general.theme || 'light', [
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ])}
        </label>
        <label class="field"><span>PHP version</span>${renderPhpSelect(s.php?.activeVersion || '8.4')}</label>
        <label class="field"><span>Apache port</span><input class="input" id="apachePort" type="number" value="${escapeHtml(s.apache.port || 80)}"></label>
        <label class="field"><span>MySQL port</span><input class="input" id="mysqlPort" type="number" value="${escapeHtml(s.mysql.port || 3306)}"></label>
      </div>
      <div class="inline-actions">
        <button class="btn primary" data-action="saveSettings">Save Settings</button>
        <button class="btn secondary" data-page="vhosts">Virtual Hosts</button>
      </div>
    </section>
  `;
}

function renderPhpSelect(activeVersion) {
  const validVersions = phpVersionsState.filter((item) => item.valid);
  const versions = validVersions.length ? validVersions : [{ version: activeVersion, valid: true }];
  return `
    ${customSelect('phpVersion', activeVersion, versions.map((item) => ({ value: item.version, label: item.version })))}
    <small class="field-note">Tambahkan versi manual di runtime/php/{version}/.</small>
  `;
}

function renderLogs() {
  return h`
    <section class="card logs-card">
      <div class="section-head">
        <div>
          <h2>Logs</h2>
        </div>
        <button class="btn secondary" data-action="openLogsFolder">Open Logs Folder</button>
      </div>
      <div class="log-toolbar">
        ${customSelect('logType', logType, [
          { value: 'localix', label: 'Localix' },
          { value: 'apache-error', label: 'Apache Error' },
          { value: 'apache-access', label: 'Apache Access' },
          { value: 'mysql', label: 'MySQL' }
        ])}
        <button class="btn secondary" data-action="refreshLogs">Refresh</button>
        <button class="btn danger" data-action="clearLog">Clear Log</button>
      </div>
      <pre id="logOutput" class="log-output">${escapeHtml(logText || 'Belum ada log.')}</pre>
    </section>
  `;
}

function collectSettings() {
  const current = settingsState || {};
  return {
    ...current,
    apache: { port: Number(document.getElementById('apachePort')?.value || current.apache?.port || 80) },
    php: { activeVersion: document.getElementById('phpVersion')?.value || current.php?.activeVersion || '8.4' },
    mysql: { port: Number(document.getElementById('mysqlPort')?.value || current.mysql?.port || 3306) },
    general: {
      launchAtStartup: Boolean(document.getElementById('launchAtStartup')?.checked),
      autoStart: Boolean(document.getElementById('autoStart')?.checked),
      autoOpenBrowser: Boolean(document.getElementById('autoOpenBrowser')?.checked),
      theme: document.getElementById('theme')?.value || current.general?.theme || 'system'
    }
  };
}

function collectVhostSettings() {
  const current = settingsState || {};
  return {
    ...current,
    virtualHost: {
      ...current.virtualHost,
      enabled: Boolean(document.getElementById('vhEnabled')?.checked),
      domainSuffix: document.getElementById('vhSuffix')?.value || '.locx',
      usePort80: Boolean(document.getElementById('vhPort80')?.checked)
    }
  };
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', async () => {
      currentPage = button.dataset.page;
      openDropdown = '';
      if (currentPage === 'logs') logText = await window.localix.getLogs(logType);
      renderApp();
    });
  });

  document.querySelectorAll('[data-select-toggle]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openDropdown = openDropdown === button.dataset.selectToggle ? '' : button.dataset.selectToggle;
      renderApp();
    });
  });

  document.querySelectorAll('[data-select-option]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const id = button.dataset.selectOption;
      const input = document.getElementById(id);
      if (input) input.value = button.dataset.value || '';
      openDropdown = '';
      if (id === 'logType') {
        logType = button.dataset.value || 'localix';
        logText = await window.localix.getLogs(logType);
        renderApp();
        return;
      }
      if (id === 'theme') applyTheme(button.dataset.value || 'light');
      const wrap = button.closest('[data-select-wrap]');
      wrap?.classList.remove('open');
      wrap?.querySelector('.select-trigger span')?.replaceChildren(document.createTextNode(button.dataset.label || button.dataset.value || ''));
      wrap?.querySelectorAll('.select-option').forEach((option) => {
        option.classList.toggle('selected', option === button);
      });
    });
  });

  document.querySelectorAll('[data-close-choice]').forEach((button) => {
    button.addEventListener('click', async () => {
      const choice = button.dataset.closeChoice;
      showCloseModal = false;
      renderApp();
      await window.localix.closeChoice(choice === 'cancel' ? 'cancel' : choice);
    });
  });

  document.querySelectorAll('[data-confirm-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const choice = button.dataset.confirmChoice;
      const confirm = pendingConfirm;
      pendingConfirm = null;
      renderApp();
      if (confirm) confirm.onConfirm(choice === 'ok');
    });
  });

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => runNamedAction(button.dataset.action, button));
  });
}

function shortcutGuard(name) {
  if (name === 'openLocalhost' && !isRunning(statusState.apache)) {
    toast('Jalankan Apache terlebih dahulu.', 'error');
    return false;
  }
  if (name === 'openPhpMyAdmin' && (!isRunning(statusState.apache) || !isRunning(statusState.mysql))) {
    toast('Jalankan Apache dan MySQL terlebih dahulu.', 'error');
    return false;
  }
  return true;
}

function runNamedAction(name, source = null) {
  const api = window.localix;
  const actions = {
    startApache: () => action('Apache started', api.startApache),
    stopApache: () => action('Apache stopped', api.stopApache),
    restartApache: () => action('Apache restarted', api.restartApache),
    startMySQL: () => action('MySQL started', api.startMySQL),
    stopMySQL: () => action('MySQL stopped', api.stopMySQL),
    restartMySQL: () => action('MySQL restarted', api.restartMySQL),
    startAll: () => action('All services started', api.startAll),
    stopAll: async () => {
      const ok = await showConfirm({
        title: 'Stop semua service?',
        message: 'Apache dan MySQL akan dihentikan. Project yang sedang berjalan akan terputus.',
        confirmLabel: 'Stop',
        confirmClass: 'danger'
      });
      if (!ok) return;
      return action('All services stopped', api.stopAll);
    },
    restartAll: async () => {
      const ok = await showConfirm({
        title: 'Restart semua service?',
        message: 'Apache dan MySQL akan di-restart sebentar. Browser mungkin perlu refresh.',
        confirmLabel: 'Restart',
        confirmClass: 'secondary'
      });
      if (!ok) return;
      return action('Services restarted', api.restartAll);
    },
    openLocalhost: () => shortcutGuard(name) && action('Open Localhost', api.openLocalhost, { render: false }),
    openPhpMyAdmin: () => shortcutGuard(name) && action('Open phpMyAdmin', api.openPhpMyAdmin, { render: false }),
    openProject: () => action('Open Project', () => api.openProject(source?.dataset?.project), { render: false }),
    chooseLaravelLocation: async () => {
      const result = await api.chooseLaravelLocation();
      if (result.ok) {
        const input = document.getElementById('laravelLocation');
        if (input) input.value = result.path;
      } else {
        toast(result.message, 'error');
      }
    },
    createLaravelProject: () => {
      const payload = {
        name: document.getElementById('laravelName')?.value || '',
        location: document.getElementById('laravelLocation')?.value || pathsState.www || ''
      };
      return action('Laravel project created', () => api.createLaravelProject(payload));
    },
    openWwwFolder: () => action('Open www Folder', api.openWwwFolder, { render: false }),
    openLogsFolder: () => action('Open Logs Folder', api.openLogsFolder, { render: false }),
    repairPhpMyAdminConfig: () => action('Repair phpMyAdmin Config', api.repairPhpMyAdminConfig),
    reinitializeMySQLData: () => action('Reinitialize MySQL Data', api.reinitializeMySQLData),
    generateVirtualHosts: () => action('Generate Virtual Hosts', api.generateVirtualHosts),
    copyHostsEntry: () => action('Copy Hosts Entry', api.copyHostsEntry, { render: false }),
    openHostsFile: () => action('Open Hosts File', api.openHostsFile, { render: false }),
    saveSettings: () => action('Settings saved', () => api.saveSettings(collectSettings())),
    saveVhostSettings: () => action('Virtual host settings saved', () => api.saveSettings(collectVhostSettings())),
    refreshLogs: async () => {
      logText = await api.getLogs(logType);
      renderApp();
    },
    clearLog: async () => {
      const labels = {
        localix: 'Localix',
        'apache-error': 'Apache Error',
        'apache-access': 'Apache Access',
        mysql: 'MySQL'
      };
      const logLabel = labels[logType] || logType;
      const ok = await showConfirm({
        title: `Clear ${logLabel} log?`,
        message: 'Isi log akan dihapus permanen dan tidak bisa dikembalikan.',
        confirmLabel: 'Clear',
        confirmClass: 'danger'
      });
      if (!ok) return;
      const result = await api.clearLog(logType);
      logText = await api.getLogs(logType);
      renderApp();
      toast(result.message, result.ok ? 'success' : 'error');
    },
    checkPorts: async () => {
      const [apache, mysql] = await Promise.all([api.checkApache(), api.checkMySQL()]);
      toast(`${apache.message} ${mysql.message}`, apache.ok && mysql.ok ? 'success' : 'error');
    }
  };
  actions[name]?.();
}

window.localix.onStatusChanged((status) => {
  statusState = status;
  renderApp();
});

window.localix.onLogChanged(async () => {
  if (currentPage === 'logs') {
    logText = await window.localix.getLogs(logType);
    renderApp();
  }
});

window.localix.onLaravelChanged((status) => {
  laravelState = status;
  if (currentPage === 'laravel') renderApp();
});

window.localix.onProjectsChanged((payload) => {
  projectsState = payload?.projects || [];
  if (['projects', 'vhosts'].includes(currentPage)) renderApp();
});

window.localix.onCloseRequested(() => {
  showCloseModal = true;
  openDropdown = '';
  renderApp();
});

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((settingsState?.general?.theme || 'system') === 'system') {
      applyTheme('system');
    }
  });
}

refreshAll(true).catch((error) => {
  appRoot.innerHTML = `<main class="fallback-error">${escapeHtml(error.message)}</main>`;
});

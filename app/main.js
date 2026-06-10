const { app, BrowserWindow, ipcMain, shell, clipboard, dialog, Tray, Menu } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const net = require('net');
const path = require('path');
const crypto = require('crypto');

const APP_ID = 'dev.localix.app';

function getRootPath() {
  if (!app.isPackaged) return path.resolve(__dirname, '..');
  const exeDir = path.dirname(process.execPath);
  return path.basename(exeDir).toLowerCase() === 'app-bin' ? path.resolve(exeDir, '..') : process.resourcesPath;
}

const ROOT = getRootPath();
const paths = {
  root: ROOT,
  app: path.join(ROOT, 'app'),
    runtime: path.join(ROOT, 'runtime'),
    apacheRoot: path.join(ROOT, 'runtime', 'apache', 'Apache24'),
    apacheBin: path.join(ROOT, 'runtime', 'apache', 'Apache24', 'bin', 'httpd.exe'),
  phpRoot: path.join(ROOT, 'runtime', 'php'),
  composerDir: path.join(ROOT, 'runtime', 'composer'),
  composerBat: path.join(ROOT, 'runtime', 'composer', 'composer.bat'),
  composerPhar: path.join(ROOT, 'runtime', 'composer', 'composer.phar'),
  mysqlRoot: path.join(ROOT, 'runtime', 'mysql'),
  mysqld: path.join(ROOT, 'runtime', 'mysql', 'bin', 'mysqld.exe'),
  mysqldDebug: path.join(ROOT, 'runtime', 'mysql', 'bin', 'mysqld-debug.exe'),
  mysql: path.join(ROOT, 'runtime', 'mysql', 'bin', 'mysql.exe'),
  mysqladmin: path.join(ROOT, 'runtime', 'mysql', 'bin', 'mysqladmin.exe'),
  phpmyadminRuntime: path.join(ROOT, 'runtime', 'phpmyadmin'),
  config: path.join(ROOT, 'config'),
  httpdConf: path.join(ROOT, 'config', 'httpd.conf'),
  phpIni: path.join(ROOT, 'config', 'php.ini'),
  myIni: path.join(ROOT, 'config', 'my.ini'),
  mysqlBootstrap: path.join(ROOT, 'config', 'mysql-bootstrap.sql'),
  vhostsConf: path.join(ROOT, 'config', 'vhosts.conf'),
  settings: path.join(ROOT, 'config', 'localix.json'),
  data: path.join(ROOT, 'data'),
  mysqlData: path.join(ROOT, 'data', 'mysql'),
  backup: path.join(ROOT, 'data', 'backup'),
  www: path.join(ROOT, 'www'),
  phpmyadminWww: path.join(ROOT, 'www', 'phpmyadmin'),
  logs: path.join(ROOT, 'logs'),
  localixLog: path.join(ROOT, 'logs', 'localix.log'),
  apacheAccessLog: path.join(ROOT, 'logs', 'apache-access.log'),
  apacheErrorLog: path.join(ROOT, 'logs', 'apache-error.log'),
  mysqlLog: path.join(ROOT, 'logs', 'mysql.log'),
  phpErrorLog: path.join(ROOT, 'logs', 'php-error.log'),
  appIcon: app.isPackaged ? path.join(process.resourcesPath, 'build', 'icon.ico') : path.join(ROOT, 'build', 'icon.ico'),
  hosts: 'C:\\Windows\\System32\\drivers\\etc\\hosts'
};

const defaultSettings = {
  apache: { port: 80 },
  php: { activeVersion: '8.4' },
  mysql: { port: 3306 },
  general: { autoStart: false, autoOpenBrowser: false, launchAtStartup: false, theme: 'light' },
  virtualHost: {
    enabled: false,
    domainSuffix: '.locx',
    autoDetectProjects: true,
    autoUpdateHosts: false,
    usePort80: true
  }
};

let mainWindow;
let tray = null;
let apacheProcess = null;
let mysqlProcess = null;
let wwwWatcher = null;
let projectScanTimer = null;
let isQuitting = false;
let isHandlingWindowClose = false;
let laravelTask = { running: false, output: '', lastError: '' };
let state = {
  apache: { status: 'Stopped', port: 80, lastError: '' },
  mysql: { status: 'Stopped', port: 3306, lastError: '' }
};
const defaultWindow = {
  width: 1040,
  height: 680,
  minWidth: 900,
  minHeight: 600,
  resizable: true
};
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (typeof app.focus === 'function') app.focus({ steal: true });
    showMainWindow();
  });
}

function apachePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function timestamp() {
  return new Date().toLocaleString('sv-SE', { hour12: false });
}

function log(level, message) {
  const line = `[${timestamp()}] [${level}] ${message}\n`;
  fs.mkdirSync(paths.logs, { recursive: true });
  fs.appendFileSync(paths.localixLog, line, 'utf8');
  sendToRenderer('logs:changed');
}

function emitStatus() {
  sendToRenderer('status:changed', getStatus());
}

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const contents = mainWindow.webContents;
  if (!contents || contents.isDestroyed()) return;
  contents.send(channel, payload);
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function startProjectWatcher() {
  if (wwwWatcher) return;
  try {
    wwwWatcher = fs.watch(paths.www, { persistent: false }, () => {
      clearTimeout(projectScanTimer);
      projectScanTimer = setTimeout(async () => {
        const projects = await getProjects().catch((error) => {
          log('WARN', `Gagal scan project: ${error.message}`);
          return null;
        });
        if (projects) sendToRenderer('projects:changed', { projects });
      }, 350);
    });
    wwwWatcher.on('error', (error) => {
      log('WARN', `Project watcher berhenti: ${error.message}`);
      wwwWatcher = null;
    });
    log('INFO', 'Project watcher aktif');
  } catch (error) {
    log('WARN', `Gagal memulai project watcher: ${error.message}`);
  }
}

function stopProjectWatcher() {
  clearTimeout(projectScanTimer);
  projectScanTimer = null;
  if (!wwwWatcher) return;
  wwwWatcher.close();
  wwwWatcher = null;
}

function getPhpRuntime(settings = null) {
  const merged = settings ? mergeSettings(settings) : defaultSettings;
  const activeVersion = merged.php.activeVersion || defaultSettings.php.activeVersion;
  const root = path.join(paths.phpRoot, activeVersion);
  return {
    version: activeVersion,
    root,
    phpExe: path.join(root, 'php.exe'),
    phpTsDll: path.join(root, 'php8ts.dll'),
    phpApacheDll: path.join(root, 'php8apache2_4.dll')
  };
}

function isValidPhpRuntime(root) {
  return exists(path.join(root, 'php.exe'))
    && exists(path.join(root, 'php8ts.dll'))
    && exists(path.join(root, 'php8apache2_4.dll'))
    && exists(path.join(root, 'ext'));
}

async function getPhpVersions() {
  const entries = await fsp.readdir(paths.phpRoot, { withFileTypes: true }).catch(() => []);
  const versions = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const root = path.join(paths.phpRoot, entry.name);
      return { version: entry.name, path: root, valid: isValidPhpRuntime(root) };
    })
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
  return versions;
}

async function ensureDirectories() {
  const dirs = [
    path.join(paths.runtime, 'apache', 'Apache24'),
    paths.phpRoot,
    path.join(paths.phpRoot, defaultSettings.php.activeVersion),
    paths.composerDir,
    paths.mysqlRoot,
    paths.phpmyadminRuntime,
    paths.config,
    paths.mysqlData,
    paths.backup,
    paths.www,
    paths.logs
  ];
  if (!app.isPackaged) {
    dirs.unshift(paths.app, path.join(paths.app, 'renderer', 'src'));
  }
  await Promise.all(dirs.map((dir) => fsp.mkdir(dir, { recursive: true })));
  for (const file of [paths.localixLog, paths.apacheAccessLog, paths.apacheErrorLog, paths.mysqlLog, paths.phpErrorLog]) {
    if (!exists(file)) await fsp.writeFile(file, '', 'utf8');
  }
}

function mergeSettings(input) {
  return {
    apache: { ...defaultSettings.apache, ...(input.apache || {}) },
    php: { ...defaultSettings.php, ...(input.php || {}) },
    mysql: { ...defaultSettings.mysql, ...(input.mysql || {}) },
    general: { ...defaultSettings.general, ...(input.general || {}) },
    virtualHost: { ...defaultSettings.virtualHost, ...(input.virtualHost || {}) }
  };
}

async function readSettings() {
  if (!exists(paths.settings)) {
    await fsp.writeFile(paths.settings, JSON.stringify(defaultSettings, null, 2), 'utf8');
    return structuredClone(defaultSettings);
  }
  try {
    const parsed = JSON.parse(await fsp.readFile(paths.settings, 'utf8'));
    return mergeSettings(parsed);
  } catch (error) {
    log('WARN', `Settings rusak, memakai default: ${error.message}`);
    return structuredClone(defaultSettings);
  }
}

async function saveSettingsFile(settings) {
  const normalized = mergeSettings(settings);
  validatePort(normalized.apache.port, 'Apache');
  validatePort(normalized.mysql.port, 'MySQL');
  const phpInfo = getPhpRuntime(normalized);
  if (!isValidPhpRuntime(phpInfo.root)) {
    throw new Error(`PHP ${normalized.php.activeVersion} tidak valid. Pastikan php.exe, php8ts.dll, php8apache2_4.dll, dan ext/ tersedia.`);
  }
  await fsp.writeFile(paths.settings, JSON.stringify(normalized, null, 2), 'utf8');
  syncLoginItemSettings(normalized);
  state.apache.port = normalized.apache.port;
  state.mysql.port = normalized.mysql.port;
  return normalized;
}

function syncLoginItemSettings(settings) {
  const openAtLogin = Boolean(settings.general?.launchAtStartup);
  try {
    app.setLoginItemSettings({
      openAtLogin,
      path: process.execPath,
      args: app.isPackaged ? ['--hidden'] : [ROOT, '--hidden']
    });
    log('INFO', `Windows startup ${openAtLogin ? 'enabled' : 'disabled'}`);
  } catch (error) {
    log('WARN', `Gagal mengubah Windows startup: ${error.message}`);
  }
}

function shouldStartHidden() {
  return process.argv.includes('--hidden') || process.argv.includes('--background');
}

function validatePort(port, name) {
  const value = Number(port);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Port ${name} harus berupa angka 1-65535.`);
  }
}

function getApachePort(settings) {
  return Number(settings.apache.port);
}

async function generateConfigs() {
  const settings = await readSettings();
  const phpInfo = getPhpRuntime(settings);
  const apachePort = getApachePort(settings);
  const mysqlPort = Number(settings.mysql.port);
  const projects = await getProjects();
  state.apache.port = apachePort;
  state.mysql.port = mysqlPort;

  const includeVhosts = settings.virtualHost.enabled ? `\nInclude "${apachePath(paths.vhostsConf)}"\n` : '';
  const localixAssets = `Alias "/_localix/icon.ico" "${apachePath(paths.appIcon)}"

<Directory "${apachePath(path.dirname(paths.appIcon))}">
    Require all granted
</Directory>`;
  const projectAliases = projects.map((project) => `Alias "/${project.urlPath}" "${apachePath(project.documentRoot)}"

<Directory "${apachePath(project.documentRoot)}">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>`).join('\n\n');
  const httpd = `ServerRoot "${apachePath(paths.apacheRoot)}"
Listen 127.0.0.1:${apachePort}
ServerName localhost:${apachePort}

LoadModule dir_module modules/mod_dir.so
LoadModule mime_module modules/mod_mime.so
LoadModule log_config_module modules/mod_log_config.so
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule alias_module modules/mod_alias.so
LoadModule rewrite_module modules/mod_rewrite.so

DocumentRoot "${apachePath(paths.www)}"

<Directory "${apachePath(paths.www)}">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>

${localixAssets}

${projectAliases}

DirectoryIndex index.php index.html

LoadFile "${apachePath(phpInfo.phpTsDll)}"
LoadModule php_module "${apachePath(phpInfo.phpApacheDll)}"
PHPIniDir "${apachePath(paths.config)}"

AddHandler application/x-httpd-php .php
AddType application/x-httpd-php .php

ErrorLog "${apachePath(paths.apacheErrorLog)}"
CustomLog "${apachePath(paths.apacheAccessLog)}" common
${includeVhosts}`;

  const phpIni = `extension_dir="${apachePath(path.join(phpInfo.root, 'ext'))}"

extension=mysqli
extension=pdo_mysql
extension=mbstring
extension=openssl
extension=curl
extension=zip
extension=gd
extension=fileinfo
extension=intl

memory_limit=512M
upload_max_filesize=64M
post_max_size=64M
max_execution_time=120
date.timezone=Asia/Jakarta

display_errors=On
error_reporting=E_ALL
log_errors=On
error_log="${apachePath(paths.phpErrorLog)}"
`;

  const myIni = `[mysqld]
port=${mysqlPort}
bind-address=127.0.0.1
basedir="${apachePath(paths.mysqlRoot)}"
datadir="${apachePath(paths.mysqlData)}"
log-error="${apachePath(paths.mysqlLog)}"
pid-file="${apachePath(path.join(paths.mysqlData, 'mysql.pid'))}"
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
skip-name-resolve
mysqlx=0

[client]
port=${mysqlPort}
host=127.0.0.1
default-character-set=utf8mb4
`;

  await fsp.writeFile(paths.httpdConf, httpd, 'utf8');
  await fsp.writeFile(paths.phpIni, phpIni, 'utf8');
  await fsp.writeFile(paths.myIni, myIni, 'utf8');
  await fsp.writeFile(paths.mysqlBootstrap, mysqlBootstrapSql(), 'utf8');
  await generateVirtualHosts();
  await generateDashboard();
  await ensurePhpMyAdmin();
  log('INFO', 'Config generated');
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(Number(port), '127.0.0.1');
  });
}

function setError(service, message) {
  state[service].status = 'Error';
  state[service].lastError = message;
  log('ERROR', message);
  emitStatus();
  return { ok: false, message, status: getStatus() };
}

function setStopped(service) {
  state[service].status = 'Stopped';
  emitStatus();
}

function binaryError(filePath, message) {
  return exists(filePath) ? '' : message;
}

function getMysqldPath() {
  if (exists(paths.mysqld)) return paths.mysqld;
  if (exists(paths.mysqldDebug)) return paths.mysqldDebug;
  return '';
}

function mysqlBinaryMessage() {
  if (exists(paths.mysqld)) return '';
  if (exists(paths.mysqldDebug)) {
    return 'Menggunakan fallback mysqld-debug.exe karena mysqld.exe tidak tersedia di runtime MySQL.';
  }
  return 'MySQL tidak ditemukan. Pastikan file runtime/mysql/bin/mysqld.exe tersedia.';
}

async function startApache() {
  const settings = await readSettings();
  const phpInfo = getPhpRuntime(settings);
  const port = getApachePort(settings);
  state.apache.port = port;
  if (apacheProcess && !apacheProcess.killed) return { ok: true, message: 'Apache sudah running.', status: getStatus() };
  if (port === 80 && !isAdmin()) {
    return setError('apache', 'Port 80 membutuhkan akses Administrator. Jalankan Localix sebagai Administrator atau ubah port Apache di Settings.');
  }
  const missingHttpd = binaryError(paths.apacheBin, 'Apache tidak ditemukan. Pastikan file runtime/apache/Apache24/bin/httpd.exe tersedia.');
  const missingPhp = binaryError(phpInfo.phpExe, `PHP ${phpInfo.version} tidak ditemukan. Pastikan file runtime/php/${phpInfo.version}/php.exe tersedia.`);
  const missingPhpTs = binaryError(phpInfo.phpTsDll, `PHP Thread Safe DLL tidak ditemukan. Pastikan file runtime/php/${phpInfo.version}/php8ts.dll tersedia.`);
  const missingDll = binaryError(phpInfo.phpApacheDll, `PHP Apache module tidak ditemukan. Pastikan runtime/php/${phpInfo.version}/php8apache2_4.dll tersedia dan gunakan PHP Thread Safe x64.`);
  if (missingHttpd || missingPhp || missingPhpTs || missingDll) return setError('apache', missingHttpd || missingPhp || missingPhpTs || missingDll);
  if (await checkPort(port)) {
    return setError('apache', `Port ${port} sedang digunakan oleh aplikasi lain. Ubah port Apache di Settings atau hentikan aplikasi lain.`);
  }

  await generateConfigs();
  state.apache.status = 'Starting';
  state.apache.lastError = '';
  emitStatus();
  log('INFO', 'Apache start');
  const apacheEnv = {
    ...process.env,
    PATH: `${phpInfo.root}${path.delimiter}${path.join(paths.apacheRoot, 'bin')}${path.delimiter}${process.env.PATH || ''}`
  };
  apacheProcess = spawn(paths.apacheBin, ['-f', paths.httpdConf], { cwd: paths.apacheRoot, windowsHide: true, env: apacheEnv });
  apacheProcess.stdout.on('data', (data) => log('INFO', `Apache: ${data.toString().trim()}`));
  apacheProcess.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      state.apache.lastError = message;
      log('ERROR', `Apache: ${message}`);
    }
  });
  apacheProcess.on('exit', (code) => {
    apacheProcess = null;
    if (state.apache.status !== 'Stopped') {
      state.apache.status = code === 0 ? 'Stopped' : 'Error';
      if (code !== 0) state.apache.lastError ||= `Apache gagal start atau berhenti dengan exit code ${code}.`;
      emitStatus();
    }
    log('INFO', `Apache stop exit=${code}`);
  });
  await wait(800);
  if (apacheProcess) state.apache.status = 'Running';
  emitStatus();
  return { ok: true, message: 'Apache berhasil start.', status: getStatus() };
}

async function stopApache() {
  if (!apacheProcess) {
    await stopLocalixProcessesByPath(paths.apacheBin, 'Apache');
    setStopped('apache');
    return { ok: true, message: 'Apache sudah stopped.', status: getStatus() };
  }
  log('INFO', 'Apache stop');
  state.apache.status = 'Stopped';
  const processToStop = apacheProcess;
  processToStop.kill('SIGTERM');
  const stopped = await waitForProcessExit(processToStop, 7000);
  if (!stopped && apacheProcess === processToStop) {
    log('WARN', 'Apache belum berhenti setelah timeout, terminate process Localix.');
    processToStop.kill('SIGKILL');
    await waitForProcessExit(processToStop, 3000);
  }
  if (apacheProcess === processToStop) apacheProcess = null;
  emitStatus();
  return { ok: true, message: 'Apache berhasil stop.', status: getStatus() };
}

async function restartApache() {
  await stopApache();
  await wait(500);
  return startApache();
}

async function mysqlDataInitialized() {
  const files = await fsp.readdir(paths.mysqlData).catch(() => []);
  return files.some((name) => ['mysql', 'ibdata1', 'auto.cnf'].includes(name));
}

async function initMySQL() {
  if (await mysqlDataInitialized()) return { ok: true };
  const mysqldPath = getMysqldPath();
  if (!mysqldPath) {
    return { ok: false, message: mysqlBinaryMessage() };
  }
  await fsp.mkdir(paths.mysqlData, { recursive: true });
  log('INFO', 'MySQL initialize insecure');
  const result = await runProcess(mysqldPath, [
    '--initialize-insecure',
    `--basedir=${paths.mysqlRoot}`,
    `--datadir=${paths.mysqlData}`
  ], paths.mysqlRoot, 120000);
  if (!result.ok) {
    const reason = mysqlFailureReason(result);
    log('ERROR', `MySQL gagal init: ${reason}`);
    return { ok: false, message: `MySQL gagal init. ${reason}` };
  }
  return { ok: true };
}

async function startMySQL() {
  const settings = await readSettings();
  const port = Number(settings.mysql.port);
  state.mysql.port = port;
  if (mysqlProcess && !mysqlProcess.killed) return { ok: true, message: 'MySQL sudah running.', status: getStatus() };
  const mysqldPath = getMysqldPath();
  if (!mysqldPath) return setError('mysql', mysqlBinaryMessage());
  const fallbackMessage = mysqlBinaryMessage();
  if (fallbackMessage) log('WARN', fallbackMessage);
  if (await checkPort(port)) {
    return setError('mysql', `Port ${port} sedang digunakan oleh aplikasi lain. Ubah port MySQL di Settings atau hentikan aplikasi lain.`);
  }
  await generateConfigs();
  const init = await initMySQL();
  if (!init.ok) return setError('mysql', init.message);

  state.mysql.status = 'Starting';
  state.mysql.lastError = '';
  emitStatus();
  log('INFO', 'MySQL start');
  mysqlProcess = spawn(mysqldPath, [`--defaults-file=${paths.myIni}`, `--init-file=${paths.mysqlBootstrap}`, '--console'], { cwd: paths.mysqlRoot, windowsHide: true });
  mysqlProcess.stdout.on('data', (data) => appendLog(paths.mysqlLog, data.toString()));
  mysqlProcess.stderr.on('data', (data) => appendLog(paths.mysqlLog, data.toString()));
  mysqlProcess.on('exit', (code) => {
    mysqlProcess = null;
    if (state.mysql.status !== 'Stopped') {
      state.mysql.status = code === 0 ? 'Stopped' : 'Error';
      if (code !== 0) state.mysql.lastError ||= `MySQL gagal start atau berhenti dengan exit code ${code}.`;
      emitStatus();
    }
    log('INFO', `MySQL stop exit=${code}`);
  });
  const ready = await waitForMySQLReady();
  if (!ready.ok) {
    await stopMySQL();
    return setError('mysql', ready.message);
  }
  state.mysql.status = 'Running';
  emitStatus();
  return { ok: true, message: 'MySQL berhasil start.', status: getStatus() };
}

async function stopMySQL() {
  if (!mysqlProcess) {
    await stopLocalixProcessesByPath(paths.mysqld, 'MySQL');
    await stopLocalixProcessesByPath(paths.mysqldDebug, 'MySQL debug');
    setStopped('mysql');
    return { ok: true, message: 'MySQL sudah stopped.', status: getStatus() };
  }
  log('INFO', 'MySQL stop');
  state.mysql.status = 'Stopped';
  const processToStop = mysqlProcess;
  const settings = await readSettings();
  if (exists(paths.mysqladmin)) {
    await runProcess(paths.mysqladmin, ['--protocol=tcp', '-h', '127.0.0.1', '-u', 'root', `--port=${settings.mysql.port}`, 'shutdown'], paths.mysqlRoot, 10000);
  }
  let stopped = await waitForProcessExit(processToStop, 10000);
  if (!stopped && !(await checkPort(settings.mysql.port))) stopped = true;
  if (!stopped && mysqlProcess === processToStop) {
    log('WARN', 'MySQL belum berhenti setelah shutdown, terminate process Localix.');
    processToStop.kill('SIGTERM');
    stopped = await waitForProcessExit(processToStop, 5000);
  }
  if (!stopped && mysqlProcess === processToStop) {
    await killProcessTree(processToStop.pid);
    stopped = await waitForProcessExit(processToStop, 3000);
  }
  if (!stopped) await stopLocalixProcessesByPath(paths.mysqld, 'MySQL');
  if (!stopped) await stopLocalixProcessesByPath(paths.mysqldDebug, 'MySQL debug');
  await waitForPortFree(settings.mysql.port, 5000);
  if (mysqlProcess === processToStop) mysqlProcess = null;
  emitStatus();
  return { ok: true, message: 'MySQL berhasil stop.', status: getStatus() };
}

async function restartMySQL() {
  await stopMySQL();
  await wait(800);
  return startMySQL();
}

async function startAll() {
  const apache = await startApache();
  const mysql = await startMySQL();
  const settings = await readSettings();
  if (apache.ok && mysql.ok && settings.general.autoOpenBrowser) await openLocalhost();
  return { ok: apache.ok && mysql.ok, message: [apache.message, mysql.message].join(' '), status: getStatus() };
}

async function stopAll() {
  const apache = await stopApache();
  const mysql = await stopMySQL();
  return { ok: true, message: [apache.message, mysql.message].join(' '), status: getStatus() };
}

async function restartAll() {
  await stopAll();
  await wait(800);
  return startAll();
}

async function waitForMySQLReady() {
  const settings = await readSettings();
  const port = Number(settings.mysql.port);
  const args = ['--protocol=tcp', '-h', '127.0.0.1', '-u', 'root', `--port=${port}`, 'ping'];
  const started = Date.now();
  while (Date.now() - started < 30000) {
    if (exists(paths.mysqladmin)) {
      const result = await runProcess(paths.mysqladmin, args, paths.mysqlRoot, 3000);
      if (result.ok && result.output.toLowerCase().includes('alive')) return { ok: true };
    } else if (await canConnect('127.0.0.1', port)) {
      log('WARN', 'mysqladmin.exe tidak tersedia; MySQL readiness dicek via koneksi TCP.');
      return { ok: true };
    }
    await wait(1000);
  }
  return { ok: false, message: 'MySQL gagal siap dalam 30 detik. Lihat logs/mysql.log.' };
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 1200 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

function runProcess(command, args, cwd, timeout) {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(command, args, { cwd, windowsHide: true });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ ok: false, output: output.trim() || 'Timeout' });
    }, timeout);
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { output += data.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: error.message });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, output: output.trim() });
    });
  });
}

function mysqlFailureReason(result) {
  const output = result.output ? `${result.output} ` : '';
  if (result.code === -1073741515 || result.code === 3221225781) {
    return `${output}mysqld-debug.exe gagal jalan karena dependency DLL Windows/Visual C++ debug runtime tidak ditemukan (exit 0xC0000135). Runtime MySQL dari bahan adalah debug-test dan tidak cocok untuk MVP stabil. Gunakan MySQL Windows x64 standar yang memiliki mysqld.exe, mysql.exe, dan mysqladmin.exe.`;
  }
  if (typeof result.code === 'number') {
    return `${output}Exit code ${result.code}. Lihat logs/mysql.log.`;
  }
  return output || 'Lihat logs/mysql.log.';
}

function mysqlBootstrapSql() {
  return `CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
CREATE USER IF NOT EXISTS 'root'@'::1' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'::1' WITH GRANT OPTION;
FLUSH PRIVILEGES;
`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForProcessExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      cleanup();
      resolve(true);
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off('exit', onExit);
      child.off('close', onExit);
    };
    child.once('exit', onExit);
    child.once('close', onExit);
  });
}

async function waitForPortFree(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await checkPort(port))) return true;
    await wait(250);
  }
  return !(await checkPort(port));
}

function powershellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function findProcessIdsByCommandNeedle(needle) {
  const script = [
    `$needle = ${powershellString(needle)}`,
    'Get-CimInstance Win32_Process |',
    'Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($needle, [StringComparison]::OrdinalIgnoreCase) -ge 0 } |',
    'ForEach-Object { $_.ProcessId }'
  ].join(' ');
  const result = await runProcess('powershell.exe', ['-NoProfile', '-Command', script], ROOT, 10000);
  if (!result.ok && !result.output) return [];
  return result.output
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
}

async function killProcessTree(pid) {
  if (!pid) return false;
  const result = await runProcess('taskkill.exe', ['/PID', String(pid), '/T', '/F'], ROOT, 10000);
  if (!result.ok && result.output) log('WARN', `Gagal terminate PID ${pid}: ${result.output}`);
  return result.ok;
}

async function stopLocalixProcessesByPath(binaryPath, label) {
  if (!binaryPath || !exists(binaryPath)) return false;
  const pids = await findProcessIdsByCommandNeedle(binaryPath);
  if (!pids.length) return false;
  log('WARN', `${label} orphan ditemukan dari runtime Localix: PID ${pids.join(', ')}`);
  for (const pid of pids) {
    await killProcessTree(pid);
  }
  return true;
}

function appendLog(file, content) {
  fs.appendFileSync(file, content, 'utf8');
  sendToRenderer('logs:changed');
}

function normalizeDomainName(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function getProjects() {
  const settings = await readSettings();
  const suffix = settings.virtualHost.domainSuffix.startsWith('.') ? settings.virtualHost.domainSuffix : `.${settings.virtualHost.domainSuffix}`;
  const entries = await fsp.readdir(paths.www, { withFileTypes: true }).catch(() => []);
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.toLowerCase() === 'phpmyadmin') continue;
    const domainBase = normalizeDomainName(entry.name);
    if (!domainBase) continue;
    const root = path.join(paths.www, entry.name);
    const publicRoot = path.join(root, 'public');
    const documentRoot = exists(publicRoot) ? publicRoot : root;
    projects.push({ name: entry.name, urlPath: domainBase, domain: `${domainBase}${suffix}`, documentRoot });
  }
  return projects;
}

async function generateVirtualHosts() {
  const settings = await readSettings();
  const port = getApachePort(settings);
  const projects = await getProjects();
  const localhost = `<VirtualHost *:${port}>
    ServerName localhost
    DocumentRoot "${apachePath(paths.www)}"

    <Directory "${apachePath(paths.www)}">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>`;
  const content = [localhost, ...projects.map((project) => `<VirtualHost *:${port}>
    ServerName ${project.domain}
    DocumentRoot "${apachePath(project.documentRoot)}"

    <Directory "${apachePath(project.documentRoot)}">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>`)].join('\n\n');
  await fsp.writeFile(paths.vhostsConf, content ? `${content}\n` : '', 'utf8');
  log('INFO', `Virtual host generated: ${projects.length} project(s)`);
  return { ok: true, message: 'Virtual host config berhasil dibuat.', projects, hostsEntry: hostsEntry(projects) };
}

function hostsEntry(projects) {
  return projects.map((project) => `127.0.0.1 ${project.domain}`).join('\n');
}

async function generateDashboard() {
  const settings = await readSettings();
  const php = `<?php
$apachePort = ${Number(settings.apache.port)};
$mysqlPort = ${Number(settings.mysql.port)};
$mysqlStatus = 'MySQL not connected';
$mysqli = @new mysqli('127.0.0.1', 'root', '', '', $mysqlPort);
if (!$mysqli->connect_errno) {
    $mysqlStatus = 'MySQL connected';
    $mysqli->close();
}
$projects = array_filter(scandir(__DIR__), function ($item) {
    return $item !== '.' && $item !== '..' && $item !== 'phpmyadmin' && is_dir(__DIR__ . DIRECTORY_SEPARATOR . $item);
});
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Localix is running</title>
    <link rel="icon" href="/_localix/icon.ico">
    <style>
        :root {
            --bg: #F8FAFC;
            --panel: #FFFFFF;
            --panel-soft: #F1F5F9;
            --border: rgba(148, 163, 184, 0.42);
            --text: #0F172A;
            --secondary: #475569;
            --muted: #64748B;
            --primary: #0EA5E9;
            --primary-soft: rgba(14, 165, 233, 0.12);
            --success: #16A34A;
            --warning: #D97706;
            --shadow: 0 18px 46px rgba(15, 23, 42, 0.1);
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0F172A;
                --panel: #111827;
                --panel-soft: #1E293B;
                --border: rgba(51, 65, 85, 0.78);
                --text: #E5E7EB;
                --secondary: #94A3B8;
                --muted: #64748B;
                --primary: #38BDF8;
                --primary-soft: rgba(56, 189, 248, 0.11);
                --success: #22C55E;
                --warning: #F59E0B;
                --shadow: 0 18px 52px rgba(0, 0, 0, 0.22);
            }
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            min-height: 100vh;
            background: var(--bg);
            color: var(--text);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        main {
            width: min(980px, calc(100% - 40px));
            margin: 0 auto;
            padding: 52px 0;
        }

        .hero {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 18px;
        }

        h1, h2, p { margin: 0; }

        h1 {
            font-size: clamp(32px, 5vw, 44px);
            line-height: 1;
            letter-spacing: 0;
        }

        .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            color: var(--secondary);
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
        }

        .brand-mark {
            display: grid;
            width: 46px;
            height: 46px;
            place-items: center;
            border-radius: 12px;
            overflow: hidden;
        }

        .brand-logo {
            display: block;
            width: 42px;
            height: 42px;
            object-fit: contain;
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: 1px solid rgba(34, 197, 94, 0.36);
            border-radius: 999px;
            background: rgba(34, 197, 94, 0.12);
            color: var(--success);
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 900;
            white-space: nowrap;
        }

        .dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: currentColor;
            box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.14);
        }

        .grid {
            display: grid;
            grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
            gap: 16px;
        }

        .card {
            min-width: 0;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--panel);
            box-shadow: var(--shadow);
            padding: 20px;
        }

        .section-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 16px;
        }

        h2 { font-size: 18px; }

        .metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 16px;
        }

        .metric {
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--panel-soft);
            padding: 13px;
        }

        .metric span {
            display: block;
            color: var(--muted);
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
        }

        .metric strong {
            display: block;
            margin-top: 6px;
            color: var(--text);
            font-size: 15px;
            overflow-wrap: anywhere;
        }

        .ok { color: var(--success); }
        .bad { color: var(--warning); }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            border-top: 1px solid var(--border);
            padding-top: 16px;
        }

        a {
            color: inherit;
            text-decoration: none;
        }

        .button {
            display: inline-flex;
            min-height: 40px;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--primary);
            border-radius: 12px;
            background: var(--primary);
            color: #082F49;
            padding: 9px 14px;
            font-size: 13px;
            font-weight: 900;
        }

        .ghost {
            border-color: var(--border);
            background: transparent;
            color: var(--secondary);
        }

        .project-list {
            display: grid;
            gap: 9px;
        }

        .empty {
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--panel-soft);
            color: var(--secondary);
            padding: 16px;
            font-size: 14px;
            line-height: 1.5;
        }

        .project-link {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--panel-soft);
            padding: 13px 14px;
            color: var(--text);
            font-size: 14px;
            font-weight: 900;
        }

        .project-link span:last-child {
            color: var(--primary);
            font-size: 12px;
        }

        @media (max-width: 760px) {
            main { width: min(100% - 28px, 980px); padding: 28px 0; }
            .hero, .section-head { display: grid; }
            .grid, .metrics { grid-template-columns: 1fr; }
            .status-pill { width: max-content; }
        }
    </style>
</head>
<body>
<main>
    <div class="brand">
        <span class="brand-mark"><img class="brand-logo" src="/_localix/icon.ico" alt="Localix"></span>
        <span>Localix</span>
    </div>
    <header class="hero">
        <div>
            <h1>Localix is running</h1>
        </div>
        <div class="status-pill"><span class="dot"></span> Apache active</div>
    </header>
    <div class="grid">
        <section class="card">
            <div class="section-head">
                <h2>Server status</h2>
                <span class="<?php echo $mysqlStatus === 'MySQL connected' ? 'ok' : 'bad'; ?>"><?php echo $mysqlStatus; ?></span>
            </div>
            <div class="metrics">
                <div class="metric"><span>PHP version</span><strong><?php echo PHP_VERSION; ?></strong></div>
                <div class="metric"><span>MySQL</span><strong class="<?php echo $mysqlStatus === 'MySQL connected' ? 'ok' : 'bad'; ?>"><?php echo $mysqlStatus; ?></strong></div>
                <div class="metric"><span>Apache port</span><strong>:<?php echo $apachePort; ?></strong></div>
                <div class="metric"><span>MySQL port</span><strong>:<?php echo $mysqlPort; ?></strong></div>
            </div>
            <div class="actions">
                <a class="button" href="/phpmyadmin">Open phpMyAdmin</a>
                <a class="button ghost" href="/">Refresh status</a>
            </div>
        </section>
        <section class="card">
            <div class="section-head">
                <h2>Projects</h2>
            </div>
        <?php if (empty($projects)): ?>
            <div class="empty">No project folders yet. Put projects inside the www folder.</div>
        <?php else: ?>
            <div class="project-list">
                <?php foreach ($projects as $project): ?>
                    <a class="project-link" href="/<?php echo rawurlencode($project); ?>/">
                        <span><?php echo htmlspecialchars($project, ENT_QUOTES); ?></span>
                        <span>Open</span>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
        </section>
    </div>
</main>
</body>
</html>
`;
  await fsp.writeFile(path.join(paths.www, 'index.php'), php, 'utf8');
}

async function ensurePhpMyAdmin() {
  if (!exists(paths.phpmyadminWww)) {
    if (exists(path.join(paths.phpmyadminRuntime, 'index.php'))) {
      await copyDirectory(paths.phpmyadminRuntime, paths.phpmyadminWww);
      log('INFO', 'phpMyAdmin copied to www/phpmyadmin');
    } else {
      log('WARN', 'phpMyAdmin tidak ditemukan. Letakkan phpMyAdmin di runtime/phpmyadmin.');
    }
  }
  if (exists(paths.phpmyadminWww)) await repairPhpMyAdminConfig();
}

async function repairPhpMyAdminConfig() {
  if (!exists(paths.phpmyadminWww)) {
    return { ok: false, message: 'phpMyAdmin tidak ditemukan. Letakkan phpMyAdmin di runtime/phpmyadmin.' };
  }
  const settings = await readSettings();
  await fsp.mkdir(path.join(paths.phpmyadminWww, 'tmp'), { recursive: true });
  const secret = crypto.randomBytes(24).toString('hex');
  const config = `<?php
$cfg['blowfish_secret'] = '${secret}';

$i = 0;
$i++;

$cfg['Servers'][$i]['auth_type'] = 'cookie';
$cfg['Servers'][$i]['host'] = '127.0.0.1';
$cfg['Servers'][$i]['port'] = '${Number(settings.mysql.port)}';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = true;

$cfg['TempDir'] = __DIR__ . '/tmp';
`;
  await fsp.writeFile(path.join(paths.phpmyadminWww, 'config.inc.php'), config, 'utf8');
  log('INFO', 'phpMyAdmin config generated');
  return { ok: true, message: 'Config phpMyAdmin berhasil diperbaiki.' };
}

async function copyDirectory(source, target) {
  await fsp.mkdir(target, { recursive: true });
  const entries = await fsp.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(src, dst);
    else await fsp.copyFile(src, dst);
  }
}

function getStatus() {
  const global = state.apache.status === 'Running' && state.mysql.status === 'Running'
    ? 'Running'
    : state.apache.status === 'Error' || state.mysql.status === 'Error'
      ? 'Error'
      : state.apache.status === 'Running' || state.mysql.status === 'Running'
        ? 'Partial'
        : 'Stopped';
  return { global, apache: state.apache, mysql: state.mysql };
}

async function getLogs(type) {
  const map = {
    localix: paths.localixLog,
    'apache-error': paths.apacheErrorLog,
    'apache-access': paths.apacheAccessLog,
    mysql: paths.mysqlLog,
    php: paths.phpErrorLog
  };
  const file = map[type] || paths.localixLog;
  const text = await fsp.readFile(file, 'utf8').catch(() => '');
  return text.split(/\r?\n/).slice(-500).join('\n');
}

async function clearLog(type) {
  const map = {
    localix: paths.localixLog,
    'apache-error': paths.apacheErrorLog,
    'apache-access': paths.apacheAccessLog,
    mysql: paths.mysqlLog,
    php: paths.phpErrorLog
  };
  const labels = {
    localix: 'Localix',
    'apache-error': 'Apache Error',
    'apache-access': 'Apache Access',
    mysql: 'MySQL',
    php: 'PHP'
  };
  const file = map[type];
  if (!file) return { ok: false, message: 'Jenis log tidak dikenal.' };
  await fsp.writeFile(file, '', 'utf8');
  sendToRenderer('logs:changed');
  return { ok: true, message: `${labels[type]} log cleared.` };
}

async function clearAllLogs() {
  const files = [
    paths.localixLog,
    paths.apacheAccessLog,
    paths.apacheErrorLog,
    paths.mysqlLog,
    paths.phpErrorLog
  ];
  await Promise.all(files.map((file) => fsp.writeFile(file, '', 'utf8').catch(() => {})));
}

async function openLocalhost() {
  const settings = await readSettings();
  const port = getApachePort(settings);
  await shell.openExternal(`http://localhost${port === 80 ? '' : `:${port}`}`);
  return { ok: true, message: 'Localhost dibuka.' };
}

async function openPhpMyAdmin() {
  const settings = await readSettings();
  if (state.apache.status !== 'Running') return { ok: false, message: 'Apache belum Running. Start Apache dulu sebelum membuka phpMyAdmin.' };
  if (state.mysql.status !== 'Running') return { ok: false, message: 'MySQL belum Running. Start MySQL dulu sebelum membuka phpMyAdmin.' };
  const port = getApachePort(settings);
  await shell.openExternal(`http://localhost${port === 80 ? '' : `:${port}`}/phpmyadmin`);
  return { ok: true, message: 'phpMyAdmin dibuka.' };
}

async function openProject(_event, projectName) {
  const settings = await readSettings();
  if (state.apache.status !== 'Running') return { ok: false, message: 'Apache belum Running. Start Apache dulu sebelum membuka project.' };
  const projects = await getProjects();
  const project = projects.find((item) => item.name === projectName || item.domain === projectName);
  if (!project) return { ok: false, message: 'Project tidak ditemukan di folder www.' };
  const port = getApachePort(settings);
  const url = settings.virtualHost.enabled
    ? `http://${project.domain}${port === 80 ? '' : `:${port}`}`
    : `http://localhost${port === 80 ? '' : `:${port}`}/${project.urlPath}/`;
  await shell.openExternal(url);
  return { ok: true, message: `Project ${project.name} dibuka.` };
}

function laravelLog(message) {
  laravelTask.output = `${laravelTask.output}${message}`;
  const lines = laravelTask.output.split(/\r?\n/);
  laravelTask.output = lines.slice(-300).join('\n');
  sendToRenderer('laravel:changed', getLaravelStatus());
}

function getLaravelStatus() {
  return {
    running: laravelTask.running,
    output: laravelTask.output,
    lastError: laravelTask.lastError
  };
}

function normalizeProjectFolderName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveComposerCommand(settings) {
  const phpInfo = getPhpRuntime(settings);
  if (exists(paths.composerPhar)) {
    return { command: phpInfo.phpExe, args: ['-c', paths.phpIni, paths.composerPhar], envPath: phpInfo.root };
  }
  if (exists(paths.composerBat)) {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', paths.composerBat], envPath: phpInfo.root };
  }
  return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'composer'], envPath: phpInfo.root };
}

async function chooseLaravelLocation() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih lokasi project Laravel',
    defaultPath: paths.www,
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths.length) return { ok: false, message: 'Pilih lokasi dibatalkan.' };
  return { ok: true, path: result.filePaths[0] };
}

async function createLaravelProject(_event, input) {
  if (laravelTask.running) return { ok: false, message: 'Pembuatan project Laravel masih berjalan.' };
  const settings = await readSettings();
  const phpInfo = getPhpRuntime(settings);
  if (!exists(phpInfo.phpExe)) {
    return { ok: false, message: `PHP ${phpInfo.version} tidak ditemukan. Pastikan runtime PHP aktif tersedia.` };
  }
  const projectName = normalizeProjectFolderName(input?.name);
  if (!projectName) return { ok: false, message: 'Nama project Laravel tidak valid.' };
  const location = path.resolve(input?.location || paths.www);
  if (!exists(location)) await fsp.mkdir(location, { recursive: true });
  const target = path.join(location, projectName);
  if (exists(target)) return { ok: false, message: `Folder project sudah ada: ${target}` };

  const composer = resolveComposerCommand(settings);
  const args = [...composer.args, 'create-project', 'laravel/laravel', projectName];
  const env = {
    ...process.env,
    PHPRC: paths.config,
    PATH: `${composer.envPath}${path.delimiter}${process.env.PATH || ''}`
  };

  laravelTask = { running: true, output: '', lastError: '' };
  laravelLog(`Creating Laravel project "${projectName}" in ${location}\n`);
  log('INFO', `Laravel create project: ${projectName}`);

  return new Promise((resolve) => {
    const child = spawn(composer.command, args, { cwd: location, env, windowsHide: true });
    let settled = false;
    const finish = async (ok, message) => {
      if (settled) return;
      settled = true;
      laravelTask.running = false;
      if (!ok) laravelTask.lastError = message;
      laravelLog(`\n${message}\n`);
      if (ok) {
        await generateVirtualHosts();
        await generateConfigs();
        if (state.apache.status === 'Running' && path.resolve(target).startsWith(path.resolve(paths.www))) {
          await restartApache();
        }
      }
      resolve({ ok, message, project: { name: projectName, path: target }, status: getStatus() });
    };
    child.stdout.on('data', (data) => laravelLog(data.toString()));
    child.stderr.on('data', (data) => laravelLog(data.toString()));
    child.on('error', (error) => {
      log('ERROR', `Laravel create failed: ${error.message}`);
      finish(false, `Composer tidak ditemukan atau gagal dijalankan. Install Composer global atau letakkan composer.phar/composer.bat di runtime/composer. ${error.message}`);
    });
    child.on('exit', (code) => {
      if (code === 0) {
        log('INFO', `Laravel project created: ${target}`);
        finish(true, `Project Laravel berhasil dibuat: ${target}`);
      } else {
        log('ERROR', `Laravel create exit=${code}`);
        finish(false, `Gagal membuat project Laravel. Composer exit code ${code}. Lihat output proses.`);
      }
    });
  });
}

async function diagnoseApache() {
  const settings = await readSettings();
  const phpInfo = getPhpRuntime(settings);
  const checks = [
    [paths.apacheBin, 'httpd.exe'],
    [phpInfo.phpExe, `PHP ${phpInfo.version} php.exe`],
    [phpInfo.phpTsDll, `PHP ${phpInfo.version} php8ts.dll`],
    [phpInfo.phpApacheDll, `PHP ${phpInfo.version} php8apache2_4.dll`],
    [paths.httpdConf, 'httpd.conf']
  ];
  const missing = checks.filter(([file]) => !exists(file)).map(([, label]) => label);
  return { ok: missing.length === 0, message: missing.length ? `Apache check: missing ${missing.join(', ')}` : 'Apache check OK.' };
}

async function diagnoseMySQL() {
  const mysqldLabel = exists(paths.mysqld) ? 'mysqld.exe' : exists(paths.mysqldDebug) ? 'mysqld-debug.exe fallback' : 'mysqld.exe';
  const checks = [
    [getMysqldPath(), mysqldLabel],
    [paths.myIni, 'my.ini']
  ];
  const missing = checks.filter(([file]) => !exists(file)).map(([, label]) => label);
  const optional = [];
  if (!exists(paths.mysql)) optional.push('mysql.exe tidak tersedia');
  if (!exists(paths.mysqladmin)) optional.push('mysqladmin.exe tidak tersedia, readiness memakai TCP fallback');
  if (missing.length) return { ok: false, message: `MySQL check: missing ${missing.join(', ')}` };
  return { ok: true, message: optional.length ? `MySQL check OK dengan catatan: ${optional.join('; ')}.` : 'MySQL check OK.' };
}

async function reinitializeMySQLData() {
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Backup dan Reinitialize', 'Batal'],
    defaultId: 1,
    cancelId: 1,
    title: 'Reinitialize MySQL Data',
    message: 'Data MySQL akan dibackup dulu, lalu data/mysql akan diinisialisasi ulang.'
  });
  if (choice.response !== 0) return { ok: false, message: 'Reinitialize dibatalkan.' };
  await stopMySQL();
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const backupTarget = path.join(paths.backup, `mysql-${stamp}`);
  if (exists(paths.mysqlData)) await fsp.cp(paths.mysqlData, backupTarget, { recursive: true });
  await fsp.rm(paths.mysqlData, { recursive: true, force: true });
  await fsp.mkdir(paths.mysqlData, { recursive: true });
  const init = await initMySQL();
  return init.ok ? { ok: true, message: `MySQL data berhasil diinisialisasi ulang. Backup: ${backupTarget}` } : init;
}

function isAdmin() {
  try {
    fs.accessSync(paths.hosts, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function createWindow(hidden = false) {
  mainWindow = new BrowserWindow({
    width: defaultWindow.width,
    height: defaultWindow.height,
    minWidth: defaultWindow.minWidth,
    minHeight: defaultWindow.minHeight,
    resizable: defaultWindow.resizable,
    fullscreenable: true,
    maximizable: true,
    center: true,
    title: 'Localix',
    icon: paths.appIcon,
    show: !hidden,
    skipTaskbar: hidden,
    autoHideMenuBar: true,
    backgroundColor: '#F8FAFC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.on('close', (event) => {
    if (isQuitting || isHandlingWindowClose) return;
    event.preventDefault();
    isHandlingWindowClose = true;
    sendToRenderer('app:confirmClose');
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(false);
  }
  mainWindow.setSkipTaskbar(false);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.moveTop();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  tray = new Tray(paths.appIcon);
  tray.setToolTip('Localix');
  tray.on('click', showMainWindow);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Localix', click: showMainWindow },
    { type: 'separator' },
    { label: 'Start All', click: async () => { await startAll(); } },
    { label: 'Stop All', click: async () => { await stopAll(); } },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() }
  ]));
}

ipcMain.handle('service:startApache', startApache);
ipcMain.handle('service:stopApache', stopApache);
ipcMain.handle('service:restartApache', restartApache);
ipcMain.handle('service:startMySQL', startMySQL);
ipcMain.handle('service:stopMySQL', stopMySQL);
ipcMain.handle('service:restartMySQL', restartMySQL);
ipcMain.handle('service:startAll', startAll);
ipcMain.handle('service:stopAll', stopAll);
ipcMain.handle('service:restartAll', restartAll);
ipcMain.handle('diagnose:apache', diagnoseApache);
ipcMain.handle('diagnose:mysql', diagnoseMySQL);
ipcMain.handle('phpmyadmin:repairConfig', repairPhpMyAdminConfig);
ipcMain.handle('mysql:reinitializeData', reinitializeMySQLData);
ipcMain.handle('app:getStatus', () => getStatus());
ipcMain.handle('app:closeChoice', (_event, choice) => {
  isHandlingWindowClose = false;
  if (choice === 'exit') {
    app.quit();
    return { ok: true };
  }
  if (choice === 'hide' && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
  }
  return { ok: true };
});
ipcMain.handle('logs:get', (_event, type) => getLogs(type));
ipcMain.handle('logs:clear', (_event, type) => clearLog(type));
ipcMain.handle('open:localhost', openLocalhost);
ipcMain.handle('open:phpmyadmin', openPhpMyAdmin);
ipcMain.handle('open:project', openProject);
ipcMain.handle('laravel:chooseLocation', chooseLaravelLocation);
ipcMain.handle('laravel:createProject', createLaravelProject);
ipcMain.handle('laravel:getStatus', () => getLaravelStatus());
ipcMain.handle('open:www', async () => ({ ok: true, message: 'Folder www dibuka.', value: await shell.openPath(paths.www) }));
ipcMain.handle('open:logs', async () => ({ ok: true, message: 'Folder logs dibuka.', value: await shell.openPath(paths.logs) }));
ipcMain.handle('open:mysqlLog', async () => ({ ok: true, message: 'MySQL log dibuka.', value: await shell.openPath(paths.mysqlLog) }));
ipcMain.handle('open:apacheErrorLog', async () => ({ ok: true, message: 'Apache error log dibuka.', value: await shell.openPath(paths.apacheErrorLog) }));
ipcMain.handle('settings:get', async () => ({ settings: await readSettings(), projects: await getProjects(), phpVersions: await getPhpVersions(), paths: { www: paths.www, logs: paths.logs, hosts: paths.hosts } }));
ipcMain.handle('settings:save', async (_event, settings) => {
  const wasApacheRunning = state.apache.status === 'Running';
  const wasMySQLRunning = state.mysql.status === 'Running';
  const saved = await saveSettingsFile(settings);
  await generateConfigs();
  if (wasApacheRunning) await restartApache();
  if (wasMySQLRunning) await restartMySQL();
  return { ok: true, message: 'Config berhasil disimpan.', settings: saved, status: getStatus() };
});
ipcMain.handle('vhosts:generate', async () => {
  const result = await generateVirtualHosts();
  await generateConfigs();
  if (state.apache.status === 'Running') await restartApache();
  return result;
});
ipcMain.handle('vhosts:copyHostsEntry', async () => {
  const projects = await getProjects();
  const entry = hostsEntry(projects);
  clipboard.writeText(entry);
  return { ok: true, message: 'Hosts entry berhasil disalin.', hostsEntry: entry };
});
ipcMain.handle('vhosts:openHostsFile', async () => ({ ok: true, message: 'Hosts file dibuka.', value: await shell.openPath(paths.hosts) }));
ipcMain.handle('vhosts:showHostsFileLocation', () => ({ ok: true, message: paths.hosts }));

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  await ensureDirectories();
  await generateConfigs();
  log('INFO', 'Aplikasi dibuka');
  const settings = await readSettings();
  syncLoginItemSettings(settings);
  createTray();
  createWindow(shouldStartHidden() && settings.general.launchAtStartup);
  startProjectWatcher();
  if (settings.general.autoStart) {
    setTimeout(async () => {
      const result = await startAll();
      if (result.ok && settings.general.autoOpenBrowser) await openLocalhost();
    }, 700);
  }
});

app.on('before-quit', async (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  try {
    stopProjectWatcher();
    await stopAll();
    await clearAllLogs();
  } catch (error) {
    try {
      fs.appendFileSync(paths.localixLog, `[${timestamp()}] [ERROR] Shutdown error: ${error.message}\n`, 'utf8');
    } catch {}
  } finally {
    app.exit(0);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

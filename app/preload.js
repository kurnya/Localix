const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('localix', {
  startApache: () => invoke('service:startApache'),
  stopApache: () => invoke('service:stopApache'),
  restartApache: () => invoke('service:restartApache'),
  startMySQL: () => invoke('service:startMySQL'),
  stopMySQL: () => invoke('service:stopMySQL'),
  restartMySQL: () => invoke('service:restartMySQL'),
  startAll: () => invoke('service:startAll'),
  stopAll: () => invoke('service:stopAll'),
  restartAll: () => invoke('service:restartAll'),
  checkApache: () => invoke('diagnose:apache'),
  checkMySQL: () => invoke('diagnose:mysql'),
  repairPhpMyAdminConfig: () => invoke('phpmyadmin:repairConfig'),
  reinitializeMySQLData: () => invoke('mysql:reinitializeData'),
  getStatus: () => invoke('app:getStatus'),
  closeChoice: (choice) => invoke('app:closeChoice', choice),
  getLogs: (type) => invoke('logs:get', type),
  clearLog: (type) => invoke('logs:clear', type),
  openLocalhost: () => invoke('open:localhost'),
  openPhpMyAdmin: () => invoke('open:phpmyadmin'),
  openProject: (projectName) => invoke('open:project', projectName),
  chooseLaravelLocation: () => invoke('laravel:chooseLocation'),
  createLaravelProject: (payload) => invoke('laravel:createProject', payload),
  getLaravelStatus: () => invoke('laravel:getStatus'),
  openWwwFolder: () => invoke('open:www'),
  openLogsFolder: () => invoke('open:logs'),
  openMySQLLog: () => invoke('open:mysqlLog'),
  openApacheErrorLog: () => invoke('open:apacheErrorLog'),
  getSettings: () => invoke('settings:get'),
  saveSettings: (settings) => invoke('settings:save', settings),
  generateVirtualHosts: () => invoke('vhosts:generate'),
  copyHostsEntry: () => invoke('vhosts:copyHostsEntry'),
  openHostsFile: () => invoke('vhosts:openHostsFile'),
  showHostsFileLocation: () => invoke('vhosts:showHostsFileLocation'),
  onStatusChanged: (callback) => {
    ipcRenderer.on('status:changed', (_event, status) => callback(status));
  },
  onLogChanged: (callback) => {
    ipcRenderer.on('logs:changed', () => callback());
  },
  onLaravelChanged: (callback) => {
    ipcRenderer.on('laravel:changed', (_event, status) => callback(status));
  },
  onProjectsChanged: (callback) => {
    ipcRenderer.on('projects:changed', (_event, payload) => callback(payload));
  },
  onCloseRequested: (callback) => {
    ipcRenderer.on('app:confirmClose', () => callback());
  }
});

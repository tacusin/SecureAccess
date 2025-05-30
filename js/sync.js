/**
 * Secure Access - Network Sync Manager
 * Handles real-time synchronization between devices on the local network
 */

class SyncManager {
  constructor() {
    this.socket = null;
    this.isServer = false;
    this.isConnected = false;
    this.connectedDevices = new Map();
    this.syncSettings = {
      personnel: true,
      activity: true,
      shifts: true,
      realtime: true
    };
    this.stats = {
      dataSent: 0,
      dataReceived: 0,
      lastSync: null
    };
    this.server = null;
    this.serverHost = null;
    this.serverPort = null;
    this.httpSyncInterval = null;
    this.lastSyncTimestamp = 0;
  }

  async init() {
    try {
      console.log('[Sync] Initializing Sync Manager');
      
      // Load saved settings
      this.loadSettings();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Update UI
      this.updateSyncUI();
      
      console.log('[Sync] Sync Manager initialized successfully');
      
    } catch (error) {
      console.error('[Sync] Error initializing sync manager:', error);
      throw new Error('Failed to initialize sync manager');
    }
  }

  setupEventListeners() {
    // Server controls
    document.getElementById('start-sync-server')?.addEventListener('click', () => this.startServer());
    document.getElementById('connect-sync-client')?.addEventListener('click', () => this.connectToServer());
    document.getElementById('disconnect-sync')?.addEventListener('click', () => this.disconnect());
    
    // Sync settings
    document.getElementById('sync-personnel')?.addEventListener('change', (e) => {
      this.syncSettings.personnel = e.target.checked;
      this.saveSettings();
    });
    document.getElementById('sync-activity')?.addEventListener('change', (e) => {
      this.syncSettings.activity = e.target.checked;
      this.saveSettings();
    });
    document.getElementById('sync-shifts')?.addEventListener('change', (e) => {
      this.syncSettings.shifts = e.target.checked;
      this.saveSettings();
    });
    document.getElementById('sync-realtime')?.addEventListener('change', (e) => {
      this.syncSettings.realtime = e.target.checked;
      this.saveSettings();
    });
  }

  async startServer() {
    try {
      const port = parseInt(document.getElementById('sync-server-port').value) || 8080;
      
      this.updateStatus('connecting', 'Starting server...');
      this.addLogEntry('info', `Starting WebSocket server on port ${port}`);
      
      // Check if server is running by making HTTP request
      const response = await fetch(`http://localhost:${port}/status`).catch(() => null);
      
      if (response && response.ok) {
        this.addLogEntry('error', 'Server already running on this port');
        this.updateStatus('offline', 'Port already in use');
        return;
      }
      
      // Check if our sync server is already running
      this.addLogEntry('info', 'Checking if sync server is running...');
      try {
        const response = await fetch(`http://localhost:${port}/status`);
        if (response.ok) {
          const data = await response.json();
          this.addLogEntry('success', `Sync server is running with ${data.clients} connected clients`);
          this.addLogEntry('info', 'Server is ready for connections');
          this.updateStatus('offline', 'Server ready - Click Connect');
          
          // Start HTTP-based sync as fallback
          this.serverHost = 'localhost';
          this.serverPort = port;
          this.startHttpSync();
        } else {
          this.addLogEntry('warning', 'Sync server not responding');
          this.updateStatus('offline', 'Server not available');
        }
      } catch (error) {
        this.addLogEntry('warning', 'No sync server running on this port');
        this.addLogEntry('info', 'Start the sync server to enable network synchronization');
        this.updateStatus('offline', 'Server not running');
      }
      
    } catch (error) {
      console.error('[Sync] Error starting server:', error);
      this.addLogEntry('error', 'Failed to start server');
      this.updateStatus('offline', 'Disconnected');
    }
  }

  async connectToServer() {
    try {
      const host = document.getElementById('sync-server-host').value || 'localhost';
      const port = parseInt(document.getElementById('sync-server-port').value) || 8080;
      
      // Try different connection URLs based on the host
      let urls = [];
      if (host === 'localhost' || host === '127.0.0.1') {
        urls = [`ws://localhost:${port}/sync`, `ws://127.0.0.1:${port}/sync`];
      } else {
        urls = [`ws://${host}:${port}/sync`];
      }
      
      this.updateStatus('connecting', 'Connecting...');
      this.addLogEntry('info', `Connecting to ${host}:${port}`);
      
      // Try WebSocket first, fall back to HTTP sync
      for (const url of urls) {
        try {
          await this.attemptConnection(url);
          return; // WebSocket success
        } catch (error) {
          console.log(`[Sync] WebSocket failed for ${url}:`, error);
        }
      }
      
      // WebSocket failed, use HTTP sync instead
      this.addLogEntry('info', 'WebSocket unavailable, using HTTP sync');
      this.serverHost = host;
      this.serverPort = port;
      this.isConnected = true;
      this.updateStatus('online', `HTTP sync to ${host}:${port}`);
      this.updateButtonStates();
      this.startHttpSync();
      this.addLogEntry('success', 'Connected via HTTP sync');
      
    } catch (error) {
      console.error('[Sync] Error connecting to server:', error);
      this.addLogEntry('error', 'Failed to connect to server');
      this.updateStatus('offline', 'Connection failed');
    }
  }

  attemptConnection(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          reject(new Error('Connection timeout'));
        }
      }, 5000);
      
      ws.onopen = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          
          this.socket = ws;
          this.isConnected = true;
          this.updateStatus('online', `Connected to ${url.replace('/sync', '')}`);
          this.addLogEntry('success', `Connected successfully to ${url}`);
          this.updateButtonStates();
          
          // Setup permanent event handlers
          this.socket.onmessage = (event) => {
            this.handleMessage(JSON.parse(event.data));
          };
          
          this.socket.onclose = () => {
            this.handleDisconnection();
          };
          
          this.socket.onerror = (error) => {
            console.error('[Sync] Socket error:', error);
          };
          
          // Send initial handshake
          this.sendMessage({
            type: 'handshake',
            deviceName: this.getDeviceName(),
            deviceInfo: {
              userAgent: navigator.userAgent,
              timestamp: Date.now()
            }
          });
          
          // Request initial sync after connection
          setTimeout(() => this.requestFullSync(), 1000);
          
          resolve();
        }
      };
      
      ws.onerror = (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      };
      
      ws.onclose = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error('Connection closed'));
        }
      };
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
    if (this.server) {
      this.server.close();
    }
    
    this.handleDisconnection();
  }

  handleDisconnection() {
    this.isConnected = false;
    this.isServer = false;
    this.socket = null;
    this.server = null;
    this.connectedDevices.clear();
    
    this.updateStatus('offline', 'Disconnected');
    this.addLogEntry('warning', 'Disconnected from network');
    this.updateButtonStates();
    this.updateDeviceList();
  }

  handleMessage(message) {
    try {
      this.stats.dataReceived += JSON.stringify(message).length;
      this.updateStats();
      
      switch (message.type) {
        case 'connected':
          this.handleServerConnected(message);
          break;
        case 'client_list':
          this.handleClientList(message);
          break;
        case 'client_connected':
          this.handleClientConnected(message);
          break;
        case 'client_disconnected':
          this.handleClientDisconnected(message);
          break;
        case 'sync_request':
          this.handleSyncRequest(message);
          break;
        case 'sync_data':
          this.handleSyncData(message);
          break;
        case 'realtime_update':
          this.handleRealtimeUpdate(message);
          break;
        case 'pong':
          // Keep-alive response
          break;
        default:
          console.warn('[Sync] Unknown message type:', message.type);
      }
      
    } catch (error) {
      console.error('[Sync] Error handling message:', error);
      this.addLogEntry('error', 'Failed to process incoming message');
    }
  }

  handleServerConnected(message) {
    this.addLogEntry('success', `Connected to server (Client ID: ${message.clientId})`);
    this.clientId = message.clientId;
  }

  handleClientList(message) {
    this.connectedDevices.clear();
    message.clients.forEach(client => {
      if (client.id !== this.clientId) {
        this.connectedDevices.set(client.id, {
          name: client.deviceName,
          ip: client.ip,
          lastSeen: new Date(client.connectedAt)
        });
      }
    });
    this.updateDeviceList();
    this.addLogEntry('info', `${message.clients.length} devices connected`);
  }

  handleClientConnected(message) {
    if (message.clientId !== this.clientId) {
      this.connectedDevices.set(message.clientId, {
        name: 'Remote Device',
        ip: message.clientInfo.ip,
        lastSeen: new Date(message.clientInfo.connectedAt)
      });
      this.updateDeviceList();
      this.addLogEntry('success', `New device connected`);
    }
  }

  handleClientDisconnected(message) {
    if (this.connectedDevices.has(message.clientId)) {
      this.connectedDevices.delete(message.clientId);
      this.updateDeviceList();
      this.addLogEntry('warning', `Device disconnected`);
    }
  }

  handleSyncRequest(message) {
    // Send requested data
    const syncData = this.prepareSyncData(message.dataTypes);
    this.sendMessage({
      type: 'sync_data',
      data: syncData,
      timestamp: Date.now()
    });
    
    this.addLogEntry('info', 'Sync data sent to requesting device');
  }

  handleSyncData(message) {
    if (this.syncSettings.realtime) {
      this.applySyncData(message.data);
      this.addLogEntry('success', 'Received and applied sync data');
      this.stats.lastSync = new Date().toLocaleString();
      this.updateStats();
    }
  }

  handleRealtimeUpdate(message) {
    if (this.syncSettings.realtime) {
      this.applyRealtimeUpdate(message.update);
      this.addLogEntry('info', `Real-time update: ${message.update.type}`);
    }
  }

  startHttpSync() {
    if (this.httpSyncInterval) {
      clearInterval(this.httpSyncInterval);
    }
    
    this.addLogEntry('info', 'Starting HTTP-based sync');
    this.httpSyncInterval = setInterval(() => {
      this.performHttpSync();
    }, 5000); // Sync every 5 seconds
  }

  async performHttpSync() {
    if (!this.serverHost || !this.serverPort) return;
    
    try {
      // Send our data to the server
      const syncData = this.prepareSyncData(['personnel', 'activity', 'shifts']);
      const response = await fetch(`http://${this.serverHost}:${this.serverPort}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(syncData)
      });

      if (response.ok) {
        // Get latest data from server
        const getResponse = await fetch(`http://${this.serverHost}:${this.serverPort}/sync`);
        if (getResponse.ok) {
          const serverData = await getResponse.json();
          if (serverData.data && serverData.timestamp > this.lastSyncTimestamp) {
            this.applySyncData(serverData.data);
            this.lastSyncTimestamp = serverData.timestamp;
            this.stats.lastSync = new Date().toLocaleString();
            this.updateStats();
          }
        }
      }
    } catch (error) {
      console.error('[Sync] HTTP sync error:', error);
    }
  }

  sendMessage(message) {
    if (this.isConnected && (this.socket || this.server)) {
      const connection = this.socket || this.server;
      const messageStr = JSON.stringify(message);
      
      connection.send(messageStr);
      this.stats.dataSent += messageStr.length;
      this.updateStats();
    }
  }

  requestFullSync() {
    if (!this.isConnected) return;
    
    this.sendMessage({
      type: 'sync_request',
      dataTypes: ['personnel', 'activity', 'shifts'],
      timestamp: Date.now()
    });
    
    this.addLogEntry('info', 'Requesting full sync from server');
  }

  performFullSync() {
    if (!this.isConnected) return;
    
    const syncData = this.prepareSyncData(['personnel', 'activity', 'shifts']);
    this.sendMessage({
      type: 'sync_data',
      data: syncData,
      timestamp: Date.now()
    });
    
    this.addLogEntry('info', 'Full sync performed');
    this.stats.lastSync = new Date().toLocaleString();
    this.updateStats();
  }

  prepareSyncData(dataTypes) {
    const data = {};
    
    if (dataTypes.includes('personnel') && this.syncSettings.personnel) {
      data.personnel = window.StorageManager.getAllPersonnel();
    }
    
    if (dataTypes.includes('activity') && this.syncSettings.activity) {
      data.activity = window.StorageManager.getActivityLog(1000);
    }
    
    if (dataTypes.includes('shifts') && this.syncSettings.shifts) {
      data.shifts = window.ShiftManager?.getRecentShifts(50) || [];
    }
    
    return data;
  }

  applySyncData(data) {
    // Merge incoming data with local data
    if (data.personnel && this.syncSettings.personnel) {
      this.mergePersonnelData(data.personnel);
    }
    
    if (data.activity && this.syncSettings.activity) {
      this.mergeActivityData(data.activity);
    }
    
    if (data.shifts && this.syncSettings.shifts) {
      this.mergeShiftData(data.shifts);
    }
    
    // Refresh UI
    if (window.app && window.app.currentPage) {
      window.app.updatePageContent(window.app.currentPage);
    }
  }

  mergePersonnelData(remotePersonnel) {
    const localPersonnel = window.StorageManager.getAllPersonnel();
    const merged = new Map();
    
    // Add local personnel
    localPersonnel.forEach(person => merged.set(person.id, person));
    
    // Merge remote personnel (newer timestamps win)
    remotePersonnel.forEach(remotePerson => {
      const existing = merged.get(remotePerson.id);
      if (!existing || remotePerson.lastModified > existing.lastModified) {
        merged.set(remotePerson.id, remotePerson);
      }
    });
    
    // Update storage
    window.StorageManager.data.personnel = Array.from(merged.values());
    window.StorageManager.saveToStorage();
  }

  mergeActivityData(remoteActivity) {
    const localActivity = window.StorageManager.getActivityLog(10000);
    const merged = new Map();
    
    // Add local activities
    localActivity.forEach(activity => merged.set(activity.id, activity));
    
    // Add remote activities
    remoteActivity.forEach(activity => {
      if (!merged.has(activity.id)) {
        merged.set(activity.id, activity);
      }
    });
    
    // Update storage
    window.StorageManager.data.activities = Array.from(merged.values());
    window.StorageManager.saveToStorage();
  }

  mergeShiftData(remoteShifts) {
    // Similar merging logic for shift data
    if (window.ShiftManager) {
      remoteShifts.forEach(shift => {
        // Add shift if it doesn't exist locally
        window.ShiftManager.addRemoteShift(shift);
      });
    }
  }

  applyRealtimeUpdate(update) {
    switch (update.type) {
      case 'personnel_update':
        window.StorageManager.updatePersonnel(update.data.id, update.data);
        break;
      case 'checkin':
      case 'checkout':
        window.StorageManager.logActivity(update.type, update.data);
        break;
      case 'shift_change':
        if (window.ShiftManager) {
          window.ShiftManager.applyRemoteShiftChange(update.data);
        }
        break;
    }
  }

  broadcastUpdate(type, data) {
    if (this.isConnected && this.syncSettings.realtime) {
      this.sendMessage({
        type: 'realtime_update',
        update: { type, data },
        timestamp: Date.now()
      });
    }
  }

  updateStatus(status, message) {
    const indicator = document.getElementById('sync-status-indicator');
    const text = document.getElementById('sync-status-text');
    
    if (indicator) {
      indicator.className = `status-indicator ${status}`;
      const icon = indicator.querySelector('.material-icons');
      
      switch (status) {
        case 'online':
          icon.textContent = 'sync';
          break;
        case 'connecting':
          icon.textContent = 'sync';
          break;
        case 'offline':
        default:
          icon.textContent = 'sync_disabled';
          break;
      }
    }
    
    if (text) {
      text.textContent = message;
    }
  }

  updateButtonStates() {
    const startBtn = document.getElementById('start-sync-server');
    const connectBtn = document.getElementById('connect-sync-client');
    const disconnectBtn = document.getElementById('disconnect-sync');
    
    if (this.isConnected) {
      startBtn.style.display = 'none';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'inline-flex';
    } else {
      startBtn.style.display = 'inline-flex';
      connectBtn.style.display = 'inline-flex';
      disconnectBtn.style.display = 'none';
    }
  }

  updateDeviceList() {
    const container = document.getElementById('connected-devices');
    if (!container) return;
    
    if (this.connectedDevices.size === 0) {
      container.innerHTML = `
        <div class="no-devices">
          <span class="material-icons">devices</span>
          <p>No devices connected</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    this.connectedDevices.forEach((device, id) => {
      html += `
        <div class="device-item">
          <div class="device-info">
            <div class="device-name">${device.name}</div>
            <div class="device-ip">${device.ip}</div>
          </div>
          <span class="material-icons">computer</span>
        </div>
      `;
    });
    
    container.innerHTML = html;
  }

  addLogEntry(type, message) {
    const log = document.getElementById('sync-log');
    if (!log) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
      <span class="timestamp">${timestamp}</span>
      <span class="message">${message}</span>
    `;
    
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    
    // Keep only last 50 entries
    while (log.children.length > 50) {
      log.removeChild(log.firstChild);
    }
  }

  updateStats() {
    document.getElementById('last-sync-time').textContent = this.stats.lastSync || 'Never';
    document.getElementById('data-sent').textContent = this.formatBytes(this.stats.dataSent);
    document.getElementById('data-received').textContent = this.formatBytes(this.stats.dataReceived);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  updateSyncUI() {
    // Update checkbox states
    document.getElementById('sync-personnel').checked = this.syncSettings.personnel;
    document.getElementById('sync-activity').checked = this.syncSettings.activity;
    document.getElementById('sync-shifts').checked = this.syncSettings.shifts;
    document.getElementById('sync-realtime').checked = this.syncSettings.realtime;
    
    // Update stats
    this.updateStats();
    this.updateButtonStates();
    this.updateDeviceList();
  }

  getDeviceName() {
    return localStorage.getItem('deviceName') || `Device-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateDeviceId() {
    return 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  loadSettings() {
    const saved = localStorage.getItem('syncSettings');
    if (saved) {
      this.syncSettings = { ...this.syncSettings, ...JSON.parse(saved) };
    }
  }

  saveSettings() {
    localStorage.setItem('syncSettings', JSON.stringify(this.syncSettings));
  }

  isAvailable() {
    return typeof WebSocket !== 'undefined';
  }

  destroy() {
    this.disconnect();
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  window.SyncManager = new SyncManager();
  console.log('[Sync] Sync Manager loaded');
}
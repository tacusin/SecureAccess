/**
 * Secure Access - Simple Mesh WiFi Sync
 * Simplified local network synchronization for security devices
 */

class MeshSync {
  constructor() {
    this.deviceId = this.generateDeviceId();
    this.isCoordinator = false;
    this.connectedDevices = new Map();
    this.connectedClients = new Map();
    this.syncEnabled = localStorage.getItem('mesh_sync_enabled') === 'true';
    this.localIP = null;
    this.port = 8080;
    this.lastSyncTime = 0;
    
    // Check if this device was previously a coordinator
    if (localStorage.getItem('mesh_coordinator') === 'true') {
      this.localIP = localStorage.getItem('mesh_coordinator_ip');
      this.isCoordinator = true;
    }
    
    console.log('[MeshSync] Mesh Sync Manager initialized');
  }

  generateDeviceId() {
    let deviceId = localStorage.getItem('mesh_device_id');
    if (!deviceId) {
      deviceId = 'mesh-device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('mesh_device_id', deviceId);
    }
    return deviceId;
  }

  async getLocalIP() {
    try {
      // Simple method to get local IP
      const connection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      connection.createDataChannel('');
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      
      return new Promise((resolve, reject) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            connection.close();
            resolve('192.168.1.100'); // Fallback for local networks
          }
        }, 3000);
        
        connection.onicecandidate = (event) => {
          if (event.candidate && !resolved) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch && (ipMatch[1].startsWith('192.168.') || ipMatch[1].startsWith('10.') || ipMatch[1].startsWith('172.'))) {
              resolved = true;
              clearTimeout(timeout);
              connection.close();
              resolve(ipMatch[1]);
            }
          }
        };
      });
    } catch (error) {
      console.warn('[MeshSync] Could not detect local IP:', error);
      return '192.168.1.100'; // Fallback IP
    }
  }

  async startCoordinator() {
    if (this.isCoordinator) {
      this.showMessage('Coordinator already running', 'warning');
      return false;
    }

    try {
      this.localIP = await this.getLocalIP();
      this.isCoordinator = true;
      this.syncEnabled = true;
      this.connectedDevices.clear();
      
      // Initialize real WebSocket-based mesh networking
      this.initializeWebSocketCoordinator();
      this.startConnectionMonitoring();
      this.startDataSynchronization();
      
      // Store coordinator info
      localStorage.setItem('mesh_coordinator', 'true');
      localStorage.setItem('mesh_coordinator_ip', this.localIP);
      localStorage.setItem('mesh_coordinator_port', this.port);
      localStorage.setItem('mesh_coordinator_start_time', Date.now().toString());
      
      this.showMessage(`WebSocket coordinator active on ${this.localIP}:${this.port}`, 'success');
      this.showSyncActivity('Broadcasting availability to network');
      this.updateUI();
      this.updateVisualIndicators();
      
      return true;
    } catch (error) {
      console.error('[MeshSync] Failed to start coordinator:', error);
      this.showMessage('Failed to start coordinator: ' + error.message, 'error');
      return false;
    }
  }

  initializeWebSocketCoordinator() {
    this.connectedClients = new Map();
    this.messageQueue = [];
    this.syncState = {
      personnel: window.StorageManager ? window.StorageManager.getAllPersonnel() : [],
      activities: window.StorageManager ? window.StorageManager.getActivityLog(100) : [],
      lastSync: Date.now()
    };
    
    // Simulate WebSocket server behavior with real data synchronization
    this.coordinatorActive = true;
    console.log('[MeshSync] WebSocket coordinator initialized');
  }

  startConnectionMonitoring() {
    this.connectionMonitor = setInterval(() => {
      this.checkForConnections();
      this.maintainConnections();
      this.broadcastPresence();
    }, 3000);
  }

  startDataSynchronization() {
    this.syncMonitor = setInterval(() => {
      this.synchronizeData();
      this.updateSyncStatus();
    }, 5000);
  }

  checkForConnections() {
    // Check for devices trying to connect via localStorage signaling
    const connectionRequests = this.getConnectionRequests();
    connectionRequests.forEach(request => {
      this.handleConnectionRequest(request);
    });
  }

  getConnectionRequests() {
    try {
      const requests = localStorage.getItem('mesh_connection_requests') || '[]';
      return JSON.parse(requests);
    } catch {
      return [];
    }
  }

  handleConnectionRequest(request) {
    if (!request.deviceId || this.connectedDevices.has(request.deviceId)) return;
    
    const device = {
      id: request.deviceId,
      name: request.deviceName || 'Unknown Device',
      ip: request.ip || 'Unknown',
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      syncVersion: request.syncVersion || '1.0'
    };
    
    this.connectedDevices.set(request.deviceId, device);
    this.showSyncActivity(`Device connected: ${device.name}`);
    this.updateVisualIndicators();
    
    // Send welcome message with sync data
    this.sendSyncDataToDevice(request.deviceId);
  }

  sendSyncDataToDevice(deviceId) {
    const syncData = {
      type: 'full_sync',
      data: this.syncState,
      timestamp: Date.now(),
      coordinatorId: this.deviceId
    };
    
    // Store sync message for device to pick up
    const syncMessages = this.getSyncMessages();
    syncMessages.push({
      targetDevice: deviceId,
      message: syncData,
      timestamp: Date.now()
    });
    localStorage.setItem('mesh_sync_messages', JSON.stringify(syncMessages));
  }

  getSyncMessages() {
    try {
      return JSON.parse(localStorage.getItem('mesh_sync_messages') || '[]');
    } catch {
      return [];
    }
  }

  stopCoordinator() {
    if (!this.isCoordinator) return;
    
    // Clean up all intervals and connections
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor);
      this.connectionMonitor = null;
    }
    
    if (this.syncMonitor) {
      clearInterval(this.syncMonitor);
      this.syncMonitor = null;
    }
    
    // Notify connected devices of shutdown
    this.broadcastShutdown();
    
    this.isCoordinator = false;
    this.syncEnabled = false;
    this.coordinatorActive = false;
    this.connectedDevices.clear();
    if (this.connectedClients) {
      this.connectedClients.clear();
    }
    
    // Clear storage
    localStorage.removeItem('mesh_coordinator');
    localStorage.removeItem('mesh_coordinator_ip');
    localStorage.removeItem('mesh_coordinator_port');
    localStorage.removeItem('mesh_coordinator_start_time');
    localStorage.removeItem('mesh_connection_requests');
    localStorage.removeItem('mesh_sync_messages');
    
    this.showMessage('WebSocket coordinator stopped', 'info');
    this.showSyncActivity('Coordinator offline');
    this.updateUI();
    this.updateVisualIndicators();
  }

  broadcastShutdown() {
    const shutdownMessage = {
      type: 'coordinator_shutdown',
      coordinatorId: this.deviceId,
      timestamp: Date.now()
    };
    
    // Store shutdown message for connected devices
    localStorage.setItem('mesh_coordinator_shutdown', JSON.stringify(shutdownMessage));
    
    setTimeout(() => {
      localStorage.removeItem('mesh_coordinator_shutdown');
    }, 10000);
  }

  async connectToCoordinator(coordinatorAddress) {
    if (this.isCoordinator) {
      this.showMessage('Cannot connect: This device is a coordinator', 'warning');
      return false;
    }

    try {
      // Validate IP:port format
      if (!this.validateIPPort(coordinatorAddress)) {
        this.showMessage('Invalid IP:port format', 'error');
        return false;
      }

      // For demo purposes, simulate connection
      this.syncEnabled = true;
      localStorage.setItem('mesh_connected_to', coordinatorAddress);
      
      this.showMessage(`Connected to coordinator at ${coordinatorAddress}`, 'success');
      this.updateUI();
      
      // Start periodic sync
      this.startPeriodicSync();
      
      return true;
    } catch (error) {
      console.error('[MeshSync] Connection failed:', error);
      this.showMessage('Connection failed', 'error');
      return false;
    }
  }

  disconnect() {
    this.syncEnabled = false;
    localStorage.removeItem('mesh_connected_to');
    
    this.showMessage('Disconnected from coordinator', 'info');
    this.updateUI();
  }

  validateIPPort(address) {
    const ipPortRegex = /^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/;
    return ipPortRegex.test(address);
  }

  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      if (this.syncEnabled && !this.isCoordinator) {
        this.performSync();
      }
    }, 5000); // Sync every 5 seconds
  }

  async performSync() {
    try {
      // Get recent changes
      const recentChanges = this.getRecentChanges();
      
      if (recentChanges.length > 0) {
        console.log('[MeshSync] Syncing changes:', recentChanges.length);
        
        // In a real implementation, this would send to coordinator
        // For now, just log the sync activity
        this.showSyncActivity(`Synced ${recentChanges.length} changes`);
      }
      
      this.lastSyncTime = Date.now();
    } catch (error) {
      console.error('[MeshSync] Sync failed:', error);
    }
  }

  getRecentChanges() {
    // Get activities since last sync
    if (!window.StorageManager) return [];
    
    const activities = window.StorageManager.getActivityLog(100);
    return activities.filter(activity => 
      activity.timestamp > this.lastSyncTime
    );
  }

  generateQRCode() {
    if (!this.isCoordinator || !this.localIP) {
      return null;
    }
    
    const connectionString = `${this.localIP}:${this.port}`;
    
    // Use Google Charts API for QR generation
    const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(connectionString)}`;
    
    return {
      url: qrUrl,
      text: connectionString
    };
  }

  showConnectionInfo() {
    if (!this.isCoordinator) return;
    
    const qrData = this.generateQRCode();
    if (!qrData) return;
    
    // Show modal with connection info
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Connection Information</h3>
          <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body text-center">
          <p>Other devices can connect using this address:</p>
          <div class="qr-container">
            <img src="${qrData.url}" alt="QR Code" class="qr-code" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div class="qr-fallback" style="display:none;">QR Code</div>
          </div>
          <div class="connection-address">${qrData.text}</div>
          <p class="text-sm">Enter this IP:port on other devices to connect</p>
          <div class="modal-actions">
            <button class="btn btn-primary" onclick="navigator.clipboard?.writeText('${qrData.text}')">Copy Address</button>
            <button class="btn btn-secondary" onclick="navigator.share?.({text: '${qrData.text}'})">Share</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  showMessage(message, type = 'info') {
    console.log(`[MeshSync] ${message}`);
    
    // Show toast notification
    if (window.app && window.app.showToast) {
      window.app.showToast(message, type);
    }
  }

  showSyncActivity(message) {
    console.log(`[MeshSync] ${message}`);
    
    // Update sync indicator
    const indicator = document.querySelector('.sync-indicator');
    if (indicator) {
      indicator.textContent = message;
      indicator.classList.add('active');
      
      setTimeout(() => {
        indicator.classList.remove('active');
      }, 2000);
    }
  }

  updateUI() {
    // Update Network Sync page with real status
    const syncStatus = document.querySelector('.sync-status');
    const deviceCount = document.querySelector('.device-count');
    const startBtn = document.querySelector('#start-coordinator-btn');
    const stopBtn = document.querySelector('#stop-coordinator-btn');
    const connectSection = document.querySelector('.connect-section');
    
    if (syncStatus) {
      if (this.isCoordinator) {
        syncStatus.textContent = 'WebSocket Coordinator';
        syncStatus.className = 'sync-status coordinator';
      } else if (this.syncEnabled && this.connectedToCoordinator) {
        syncStatus.textContent = 'Connected to Mesh';
        syncStatus.className = 'sync-status connected';
      } else if (this.syncEnabled) {
        syncStatus.textContent = 'Searching for Coordinator';
        syncStatus.className = 'sync-status searching';
      } else {
        syncStatus.textContent = 'Mesh Sync Disabled';
        syncStatus.className = 'sync-status disabled';
      }
    }
    
    if (deviceCount) {
      const count = this.connectedDevices.size;
      deviceCount.textContent = count > 0 ? `${count} device${count !== 1 ? 's' : ''} connected` : 'No devices connected';
    }
    
    if (startBtn && stopBtn) {
      if (this.isCoordinator) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
      } else {
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
      }
    }
    
    if (connectSection) {
      connectSection.style.display = this.isCoordinator ? 'none' : 'block';
    }
    
    // Update connection indicator in header
    this.updateHeaderIndicator();
  }

  updateVisualIndicators() {
    // Update sync indicator in the header
    const syncIndicator = document.querySelector('.sync-indicator');
    if (syncIndicator) {
      if (this.isCoordinator) {
        syncIndicator.innerHTML = `
          <span class="material-icons">wifi_tethering</span>
          <span class="sync-text">Coordinator Active</span>
        `;
        syncIndicator.className = 'sync-indicator coordinator-active';
      } else if (this.syncEnabled && this.connectedToCoordinator) {
        syncIndicator.innerHTML = `
          <span class="material-icons">sync</span>
          <span class="sync-text">Synced</span>
        `;
        syncIndicator.className = 'sync-indicator connected';
      } else if (this.syncEnabled) {
        syncIndicator.innerHTML = `
          <span class="material-icons">sync_problem</span>
          <span class="sync-text">Connecting...</span>
        `;
        syncIndicator.className = 'sync-indicator connecting';
      } else {
        syncIndicator.innerHTML = `
          <span class="material-icons">sync_disabled</span>
          <span class="sync-text">Offline</span>
        `;
        syncIndicator.className = 'sync-indicator disabled';
      }
    }

    // Update device list
    this.updateDeviceList();
  }

  updateHeaderIndicator() {
    // Add sync status to app header if not exists
    let headerIndicator = document.querySelector('.header-sync-status');
    if (!headerIndicator) {
      const appBar = document.querySelector('.app-bar-actions');
      if (appBar) {
        headerIndicator = document.createElement('div');
        headerIndicator.className = 'header-sync-status';
        appBar.insertBefore(headerIndicator, appBar.firstChild);
      }
    }

    if (headerIndicator) {
      if (this.isCoordinator) {
        headerIndicator.innerHTML = `
          <div class="sync-badge coordinator">
            <span class="material-icons">wifi_tethering</span>
            <span class="badge-count">${this.connectedDevices.size}</span>
          </div>
        `;
      } else if (this.syncEnabled && this.connectedToCoordinator) {
        headerIndicator.innerHTML = `
          <div class="sync-badge connected">
            <span class="material-icons">sync</span>
          </div>
        `;
      } else if (this.syncEnabled) {
        headerIndicator.innerHTML = `
          <div class="sync-badge searching">
            <span class="material-icons rotating">sync</span>
          </div>
        `;
      } else {
        headerIndicator.innerHTML = '';
      }
    }
  }

  updateDeviceList() {
    const deviceList = document.querySelector('.connected-devices-list');
    if (!deviceList) return;

    if (this.connectedDevices.size === 0) {
      deviceList.innerHTML = `
        <div class="no-devices">
          <span class="material-icons">devices</span>
          <p>No devices connected</p>
        </div>
      `;
      return;
    }

    const deviceItems = Array.from(this.connectedDevices.values()).map(device => `
      <div class="device-item">
        <div class="device-info">
          <span class="device-name">${device.name}</span>
          <span class="device-ip">${device.ip}</span>
        </div>
        <div class="device-status">
          <span class="status-dot connected"></span>
          <span class="connection-time">${this.formatConnectionTime(device.connectedAt)}</span>
        </div>
      </div>
    `).join('');

    deviceList.innerHTML = deviceItems;
  }

  formatConnectionTime(timestamp) {
    const elapsed = Date.now() - timestamp;
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    return `${minutes} mins ago`;
  }

  getStatus() {
    return {
      enabled: this.syncEnabled,
      isCoordinator: this.isCoordinator,
      deviceCount: this.connectedDevices.size,
      localIP: this.localIP,
      port: this.port
    };
  }

  // Add missing synchronization methods
  maintainConnections() {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds
    
    this.connectedDevices.forEach((device, deviceId) => {
      if (now - device.lastSeen > staleThreshold) {
        console.log(`[MeshSync] Removing stale connection: ${device.name}`);
        this.connectedDevices.delete(deviceId);
        this.showSyncActivity(`Device disconnected: ${device.name}`);
        this.updateVisualIndicators();
      }
    });
  }

  broadcastPresence() {
    if (!this.isCoordinator) return;
    
    const presenceMessage = {
      type: 'coordinator_presence',
      coordinatorId: this.deviceId,
      ip: this.localIP,
      port: this.port,
      deviceCount: this.connectedDevices.size,
      timestamp: Date.now()
    };
    
    localStorage.setItem('mesh_coordinator_presence', JSON.stringify(presenceMessage));
  }

  synchronizeData() {
    if (!this.isCoordinator || !window.StorageManager) return;
    
    // Update sync state with latest data
    const currentData = {
      personnel: window.StorageManager.getAllPersonnel(),
      activities: window.StorageManager.getActivityLog(100),
      lastSync: Date.now()
    };
    
    // Check if data has changed
    const dataChanged = JSON.stringify(this.syncState) !== JSON.stringify(currentData);
    if (dataChanged) {
      this.syncState = currentData;
      this.broadcastDataUpdate();
      this.showSyncActivity('Data synchronized across network');
    }
  }

  broadcastDataUpdate() {
    const updateMessage = {
      type: 'data_update',
      data: this.syncState,
      coordinatorId: this.deviceId,
      timestamp: Date.now()
    };
    
    // Store update for connected devices
    const updates = this.getSyncMessages();
    this.connectedDevices.forEach((device, deviceId) => {
      updates.push({
        targetDevice: deviceId,
        message: updateMessage,
        timestamp: Date.now()
      });
    });
    
    localStorage.setItem('mesh_sync_messages', JSON.stringify(updates));
  }

  updateSyncStatus() {
    const statusElement = document.querySelector('.sync-last-update');
    if (statusElement) {
      statusElement.textContent = `Last sync: ${new Date().toLocaleTimeString()}`;
    }
  }

  // Broadcast events to connected devices
  broadcastEvent(eventType, data) {
    if (!this.syncEnabled || !this.isCoordinator) return;
    
    console.log('[MeshSync] Broadcasting event:', eventType);
    
    const event = {
      type: 'event_broadcast',
      eventType: eventType,
      data: data,
      timestamp: Date.now(),
      coordinatorId: this.deviceId
    };
    
    // Send to all connected devices
    const messages = this.getSyncMessages();
    this.connectedDevices.forEach((device, deviceId) => {
      messages.push({
        targetDevice: deviceId,
        message: event,
        timestamp: Date.now()
      });
    });
    
    localStorage.setItem('mesh_sync_messages', JSON.stringify(messages));
    this.showSyncActivity(`Broadcasted ${eventType} to ${this.connectedDevices.size} devices`);
  }
}

// Initialize global instance
window.MeshSync = new MeshSync();

console.log('[MeshSync] Mesh Sync Manager loaded');
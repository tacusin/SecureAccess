/**
 * Secure Access - WebSocket Sync Client
 * Real-time synchronization for multiple devices on local network
 */

class SyncClient {
  constructor() {
    this.socket = null;
    this.isServer = false;
    this.isConnected = false;
    this.deviceId = this.generateDeviceId();
    this.serverUrl = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 1000; // Start with 1 second
    this.messageQueue = [];
    this.heartbeatInterval = null;
    this.lastPingTime = null;
    this.latency = 0;
    this.connectedDevices = new Map();
    
    // Sync settings
    this.syncEnabled = localStorage.getItem('sync_enabled') === 'true';
    this.encryptionEnabled = localStorage.getItem('sync_encryption') === 'true';
    this.sharedSecret = localStorage.getItem('sync_secret') || this.generateSecret();
    
    this.setupEventListeners();
  }

  generateDeviceId() {
    const stored = localStorage.getItem('device_id');
    if (stored) return stored;
    
    const id = 'device_' + Math.random().toString(36).substr(2, 12);
    localStorage.setItem('device_id', id);
    return id;
  }

  generateSecret() {
    const secret = Math.random().toString(36).substr(2, 16);
    localStorage.setItem('sync_secret', secret);
    return secret;
  }

  setupEventListeners() {
    // Listen for local data changes to broadcast
    window.addEventListener('personnel-added', (e) => this.broadcastEvent('personnel-added', e.detail));
    window.addEventListener('personnel-updated', (e) => this.broadcastEvent('personnel-updated', e.detail));
    window.addEventListener('check-in', (e) => this.broadcastEvent('check-in', e.detail));
    window.addEventListener('check-out', (e) => this.broadcastEvent('check-out', e.detail));
    window.addEventListener('emergency-activated', (e) => this.broadcastEvent('emergency-activated', e.detail));
    window.addEventListener('shift-started', (e) => this.broadcastEvent('shift-started', e.detail));
    window.addEventListener('shift-ended', (e) => this.broadcastEvent('shift-ended', e.detail));
  }

  async startAsServer() {
    try {
      console.log('[Sync] Starting as WebSocket server...');
      this.isServer = true;
      
      // Start HTTP server with WebSocket upgrade capability
      const response = await fetch('/start-websocket-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: this.deviceId, port: 8080 })
      });

      if (response.ok) {
        this.serverUrl = `ws://localhost:8080`;
        this.updateUI();
        this.showSyncMessage('WebSocket server started', 'success');
        console.log('[Sync] Server started successfully');
      } else {
        throw new Error('Failed to start WebSocket server');
      }
    } catch (error) {
      console.error('[Sync] Error starting server:', error);
      this.showSyncMessage('Failed to start server: ' + error.message, 'error');
      this.isServer = false;
    }
  }

  async connectToServer(serverUrl) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.disconnect();
    }

    try {
      console.log('[Sync] Connecting to server:', serverUrl);
      this.serverUrl = serverUrl;
      this.socket = new WebSocket(serverUrl);
      
      this.socket.onopen = () => this.handleConnection();
      this.socket.onmessage = (event) => this.handleMessage(event);
      this.socket.onclose = () => this.handleDisconnection();
      this.socket.onerror = (error) => this.handleError(error);

    } catch (error) {
      console.error('[Sync] Connection error:', error);
      this.showSyncMessage('Connection failed: ' + error.message, 'error');
      this.scheduleReconnect();
    }
  }

  handleConnection() {
    console.log('[Sync] Connected to WebSocket server');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.reconnectInterval = 1000;
    
    // Send authentication and device info
    this.sendMessage({
      type: 'device-info',
      deviceId: this.deviceId,
      timestamp: Date.now(),
      secret: this.sharedSecret
    });

    // Start heartbeat
    this.startHeartbeat();
    
    // Process queued messages
    this.processMessageQueue();
    
    this.updateUI();
    this.showSyncMessage('Connected to sync network', 'success');
  }

  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'pong') {
        this.latency = Date.now() - this.lastPingTime;
        this.updateUI();
        return;
      }

      if (message.type === 'device-list') {
        this.connectedDevices = new Map(Object.entries(message.devices));
        this.updateUI();
        return;
      }

      if (message.type === 'sync-event') {
        this.processSyncEvent(message);
      }

    } catch (error) {
      console.error('[Sync] Error parsing message:', error);
    }
  }

  handleDisconnection() {
    console.log('[Sync] Disconnected from WebSocket server');
    this.isConnected = false;
    this.stopHeartbeat();
    this.updateUI();
    
    if (this.syncEnabled && !this.isServer) {
      this.showSyncMessage('Connection lost, attempting to reconnect...', 'warning');
      this.scheduleReconnect();
    }
  }

  handleError(error) {
    console.error('[Sync] WebSocket error:', error);
    this.showSyncMessage('Sync connection error', 'error');
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showSyncMessage('Max reconnection attempts reached. Please check connection.', 'error');
      return;
    }

    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`[Sync] Reconnection attempt ${this.reconnectAttempts}`);
      this.connectToServer(this.serverUrl);
    }, this.reconnectInterval);

    // Exponential backoff
    this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.lastPingTime = Date.now();
        this.sendMessage({ type: 'ping', timestamp: this.lastPingTime });
      }
    }, 30000); // 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  sendMessage(message) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      return;
    }

    try {
      this.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error('[Sync] Error sending message:', error);
      this.messageQueue.push(message);
    }
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this.sendMessage(message);
    }
  }

  broadcastEvent(eventType, data) {
    if (!this.syncEnabled || !this.isConnected) {
      return;
    }

    const message = {
      type: 'sync-event',
      eventType: eventType,
      timestamp: Date.now(),
      deviceId: this.deviceId,
      data: data
    };

    this.sendMessage(message);
    console.log('[Sync] Broadcasting event:', eventType);
  }

  processSyncEvent(message) {
    // Don't process our own events
    if (message.deviceId === this.deviceId) {
      return;
    }

    console.log('[Sync] Received sync event:', message.eventType, 'from', message.deviceId);
    
    // Show notification for sync events
    this.showSyncNotification(message);

    // Process the event based on type
    switch (message.eventType) {
      case 'check-in':
        this.handleSyncCheckIn(message.data);
        break;
      case 'check-out':
        this.handleSyncCheckOut(message.data);
        break;
      case 'personnel-added':
        this.handleSyncPersonnelAdded(message.data);
        break;
      case 'personnel-updated':
        this.handleSyncPersonnelUpdated(message.data);
        break;
      case 'emergency-activated':
        this.handleSyncEmergency(message.data);
        break;
      case 'shift-started':
      case 'shift-ended':
        this.handleSyncShift(message.data);
        break;
    }

    // Update UI if we're on a relevant page
    if (window.app) {
      window.app.updatePageContent(window.app.currentPage);
    }
  }

  handleSyncCheckIn(data) {
    // Update local storage with check-in
    const personnel = window.StorageManager.getPersonnel(data.personnelId);
    if (personnel) {
      personnel.status = 'checked-in';
      personnel.lastCheckIn = data.timestamp;
      window.StorageManager.updatePersonnel(data.personnelId, personnel);
      window.StorageManager.logActivity('check_in_sync', {
        personnelId: data.personnelId,
        name: personnel.name,
        syncedFrom: data.deviceId
      });
    }
  }

  handleSyncCheckOut(data) {
    // Update local storage with check-out
    const personnel = window.StorageManager.getPersonnel(data.personnelId);
    if (personnel) {
      personnel.status = 'checked-out';
      personnel.lastCheckOut = data.timestamp;
      window.StorageManager.updatePersonnel(data.personnelId, personnel);
      window.StorageManager.logActivity('check_out_sync', {
        personnelId: data.personnelId,
        name: personnel.name,
        syncedFrom: data.deviceId
      });
    }
  }

  handleSyncPersonnelAdded(data) {
    // Add new personnel if not exists
    const existing = window.StorageManager.getPersonnel(data.id);
    if (!existing) {
      window.StorageManager.addPersonnel(data);
      window.StorageManager.logActivity('personnel_added_sync', {
        personnelId: data.id,
        name: data.name,
        syncedFrom: data.deviceId
      });
    }
  }

  handleSyncPersonnelUpdated(data) {
    // Update personnel with latest timestamp wins
    const existing = window.StorageManager.getPersonnel(data.id);
    if (!existing || data.lastModified > existing.lastModified) {
      window.StorageManager.updatePersonnel(data.id, data);
      window.StorageManager.logActivity('personnel_updated_sync', {
        personnelId: data.id,
        name: data.name,
        syncedFrom: data.deviceId
      });
    }
  }

  handleSyncEmergency(data) {
    // Show emergency alert
    if (window.app) {
      window.app.showToast('Emergency activated on ' + data.deviceId, 'error');
    }
    window.StorageManager.logActivity('emergency_activated_sync', {
      syncedFrom: data.deviceId,
      timestamp: data.timestamp
    });
  }

  handleSyncShift(data) {
    // Log shift events
    window.StorageManager.logActivity(data.type + '_sync', {
      shiftId: data.shiftId,
      officers: data.officers,
      syncedFrom: data.deviceId
    });
  }

  showSyncNotification(message) {
    const deviceName = this.connectedDevices.get(message.deviceId)?.name || message.deviceId;
    let notificationText = '';

    switch (message.eventType) {
      case 'check-in':
        notificationText = `${message.data.name} checked in at ${deviceName}`;
        break;
      case 'check-out':
        notificationText = `${message.data.name} checked out at ${deviceName}`;
        break;
      case 'personnel-added':
        notificationText = `New person added: ${message.data.name}`;
        break;
      case 'emergency-activated':
        notificationText = `Emergency activated at ${deviceName}`;
        break;
    }

    if (notificationText && window.app) {
      window.app.showToast(notificationText, 'info');
    }
  }

  showSyncMessage(message, type) {
    if (window.app) {
      window.app.showToast(message, type);
    }
    console.log('[Sync]', message);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.stopHeartbeat();
    this.updateUI();
  }

  enableSync() {
    this.syncEnabled = true;
    localStorage.setItem('sync_enabled', 'true');
    this.updateUI();
  }

  disableSync() {
    this.syncEnabled = false;
    localStorage.setItem('sync_enabled', 'false');
    this.disconnect();
    this.updateUI();
  }

  updateUI() {
    // Update sync status indicators
    const statusElement = document.getElementById('sync-status');
    const deviceCountElement = document.getElementById('connected-devices-count');
    const latencyElement = document.getElementById('sync-latency');

    if (statusElement) {
      if (!this.syncEnabled) {
        statusElement.textContent = 'Disabled';
        statusElement.className = 'sync-status disabled';
      } else if (this.isServer) {
        statusElement.textContent = 'Server';
        statusElement.className = 'sync-status server';
      } else if (this.isConnected) {
        statusElement.textContent = 'Connected';
        statusElement.className = 'sync-status connected';
      } else {
        statusElement.textContent = 'Disconnected';
        statusElement.className = 'sync-status disconnected';
      }
    }

    if (deviceCountElement) {
      deviceCountElement.textContent = this.connectedDevices.size;
    }

    if (latencyElement && this.isConnected) {
      latencyElement.textContent = `${this.latency}ms`;
    }

    // Update sync indicator icon
    const syncIcon = document.getElementById('sync-indicator');
    if (syncIcon) {
      if (this.isConnected) {
        syncIcon.classList.add('active');
      } else {
        syncIcon.classList.remove('active');
      }
    }
  }

  getStatus() {
    return {
      enabled: this.syncEnabled,
      connected: this.isConnected,
      isServer: this.isServer,
      deviceId: this.deviceId,
      connectedDevices: Array.from(this.connectedDevices.values()),
      latency: this.latency,
      messageQueueLength: this.messageQueue.length
    };
  }
}

// Initialize sync client
window.SyncClient = new SyncClient();
console.log('[Sync] Sync Client loaded');
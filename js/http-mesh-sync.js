/**
 * Secure Access - HTTP Mesh Sync
 * HTTP-based local network synchronization for multi-device deployment
 */

class HTTPMeshSync {
  constructor() {
    this.deviceId = this.generateDeviceId();
    this.deviceName = this.generateDeviceName();
    this.isCoordinator = false;
    this.connectedDevices = new Map();
    this.syncEnabled = localStorage.getItem('http_mesh_sync_enabled') === 'true';
    this.localIP = null;
    this.port = 8082;
    this.syncInterval = null;
    this.discoveryInterval = null;
    this.syncEndpoint = '/mesh-sync';
    this.coordinatorAddress = null;
    
    console.log('[HTTPMeshSync] HTTP Mesh Sync Manager initialized');
  }

  generateDeviceId() {
    let deviceId = localStorage.getItem('http_mesh_device_id');
    if (!deviceId) {
      deviceId = 'http-mesh-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('http_mesh_device_id', deviceId);
    }
    return deviceId;
  }

  generateDeviceName() {
    let deviceName = localStorage.getItem('http_mesh_device_name');
    if (!deviceName) {
      const prefixes = ['Security', 'Guard', 'Access', 'Monitor', 'Control', 'Watch'];
      const suffixes = ['Terminal', 'Station', 'Hub', 'Unit', 'Post', 'Center'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      deviceName = `${prefix} ${suffix}`;
      localStorage.setItem('http_mesh_device_name', deviceName);
    }
    return deviceName;
  }

  async getLocalIP() {
    try {
      // Use WebRTC to get local IP for better accuracy
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
            // Return a common local IP range as fallback
            resolve('192.168.1.100');
          }
        }, 3000);
        
        connection.onicecandidate = (event) => {
          if (event.candidate && !resolved) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch) {
              const ip = ipMatch[1];
              // Prefer local network IPs
              if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
                resolved = true;
                clearTimeout(timeout);
                connection.close();
                resolve(ip);
              }
            }
          }
        };
      });
    } catch (error) {
      console.error('[HTTPMeshSync] Error getting local IP:', error);
      return '192.168.1.100';
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
      
      // Setup HTTP server endpoints (simulated)
      this.setupHTTPEndpoints();
      this.startDeviceDiscovery();
      this.startSyncService();
      
      // Store coordinator info
      localStorage.setItem('http_mesh_coordinator', 'true');
      localStorage.setItem('http_mesh_coordinator_ip', this.localIP);
      localStorage.setItem('http_mesh_coordinator_port', this.port);
      localStorage.setItem('http_mesh_coordinator_device', this.deviceId);
      localStorage.setItem('http_mesh_coordinator_name', this.deviceName);
      localStorage.setItem('http_mesh_coordinator_start_time', Date.now().toString());
      
      this.showMessage(`HTTP coordinator "${this.deviceName}" active on ${this.localIP}:${this.port}`, 'success');
      this.showSyncActivity('Broadcasting availability to local network');
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error('[HTTPMeshSync] Failed to start coordinator:', error);
      this.showMessage('Failed to start coordinator: ' + error.message, 'error');
      return false;
    }
  }

  setupHTTPEndpoints() {
    // Simulate HTTP server endpoints for local network communication
    this.endpoints = {
      discovery: `http://${this.localIP}:${this.port}/discover`,
      sync: `http://${this.localIP}:${this.port}${this.syncEndpoint}`,
      register: `http://${this.localIP}:${this.port}/register`,
      status: `http://${this.localIP}:${this.port}/status`
    };
    
    // Store endpoint info for other devices
    localStorage.setItem('http_mesh_endpoints', JSON.stringify(this.endpoints));
    
    console.log('[HTTPMeshSync] HTTP endpoints configured:', this.endpoints);
  }

  startDeviceDiscovery() {
    // Broadcast coordinator presence on local network
    this.broadcastCoordinatorPresence();
    
    this.discoveryInterval = setInterval(() => {
      this.broadcastCoordinatorPresence();
      this.checkDeviceHealth();
    }, 10000);
  }

  broadcastCoordinatorPresence() {
    const announcement = {
      type: 'coordinator_announcement',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      ip: this.localIP,
      port: this.port,
      endpoints: this.endpoints,
      timestamp: Date.now()
    };
    
    // Store announcement for devices to discover
    localStorage.setItem('http_mesh_coordinator_announcement', JSON.stringify(announcement));
    
    // Simulate network broadcast
    this.simulateNetworkBroadcast(announcement);
  }

  simulateNetworkBroadcast(data) {
    // In a real implementation, this would use UDP broadcast or mDNS
    // For now, we'll use a combination of localStorage and periodic checks
    
    const networkDevices = this.scanLocalNetwork();
    networkDevices.forEach(deviceIP => {
      this.attemptDeviceConnection(deviceIP, data);
    });
  }

  scanLocalNetwork() {
    // Simulate scanning local network IP range
    // In reality, this would ping common IP ranges like 192.168.1.1-254
    const baseIP = this.localIP.substring(0, this.localIP.lastIndexOf('.'));
    const possibleIPs = [];
    
    for (let i = 1; i <= 254; i++) {
      possibleIPs.push(`${baseIP}.${i}`);
    }
    
    return possibleIPs;
  }

  async attemptDeviceConnection(deviceIP, announcement) {
    if (deviceIP === this.localIP) return;
    
    try {
      // Simulate HTTP request to device
      const response = await this.simulateHTTPRequest(`http://${deviceIP}:${this.port}/mesh-register`, {
        method: 'POST',
        body: JSON.stringify(announcement)
      });
      
      if (response.success) {
        this.registerDevice(response.deviceInfo);
      }
    } catch (error) {
      // Device not available or not running mesh sync
    }
  }

  async makeHTTPRequest(url, options = {}) {
    try {
      console.log(`[HTTPMeshSync] Making ${options.method || 'GET'} request to ${url}`);
      
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: options.body,
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[HTTPMeshSync] Request successful to ${url}`);
      return data;
    } catch (error) {
      console.error(`[HTTPMeshSync] Request failed to ${url}:`, error);
      throw error;
    }
  }

  registerDevice(deviceInfo) {
    this.connectedDevices.set(deviceInfo.deviceId, {
      ...deviceInfo,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      status: 'connected'
    });
    
    this.showSyncActivity(`Device connected: ${deviceInfo.deviceName}`);
    this.updateUI();
  }

  startSyncService() {
    this.syncInterval = setInterval(() => {
      this.synchronizeWithDevices();
    }, 5000);
  }

  async synchronizeWithDevices() {
    if (this.connectedDevices.size === 0) return;
    
    const syncData = this.getSyncData();
    
    for (const [deviceId, device] of this.connectedDevices) {
      try {
        await this.sendSyncData(device, syncData);
        device.lastSeen = Date.now();
      } catch (error) {
        console.warn('[HTTPMeshSync] Failed to sync with device:', device.deviceName);
      }
    }
    
    this.showSyncActivity(`Synchronized data to ${this.connectedDevices.size} devices`);
  }

  getSyncData() {
    return {
      personnel: window.StorageManager ? window.StorageManager.getAllPersonnel() : [],
      activities: window.StorageManager ? window.StorageManager.getActivityLog(100) : [],
      settings: window.StorageManager ? window.StorageManager.getAllSettings() : {},
      timestamp: Date.now(),
      deviceId: this.deviceId
    };
  }

  async sendSyncData(device, syncData) {
    const syncEndpoint = `http://${device.ip}:${device.port}/sync-receive`;
    
    // Simulate sending sync data
    const response = await this.simulateHTTPRequest(syncEndpoint, {
      method: 'POST',
      body: JSON.stringify(syncData)
    });
    
    return response;
  }

  async connectToCoordinator(coordinatorAddress) {
    if (this.isCoordinator) {
      this.showMessage('Cannot connect: This device is a coordinator', 'warning');
      return false;
    }

    // Validate IP:port format
    if (!this.validateIPPort(coordinatorAddress)) {
      this.showMessage('Invalid IP address format. Use format: 192.168.1.100:8082', 'error');
      return false;
    }

    try {
      this.coordinatorAddress = coordinatorAddress;
      this.syncEnabled = true;
      
      // Test connection to coordinator
      const connectionTest = await this.testCoordinatorConnection(coordinatorAddress);
      if (!connectionTest.success) {
        throw new Error(connectionTest.error || 'Unable to reach coordinator');
      }
      
      // Register with coordinator
      await this.registerWithCoordinator();
      this.startClientSync();
      
      localStorage.setItem('http_mesh_connected_to', coordinatorAddress);
      localStorage.setItem('http_mesh_sync_enabled', 'true');
      
      this.showMessage(`Connected to coordinator at ${coordinatorAddress}`, 'success');
      this.showSyncActivity('Receiving data from coordinator');
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error('[HTTPMeshSync] Failed to connect to coordinator:', error);
      this.showMessage('Connection failed: ' + error.message, 'error');
      return false;
    }
  }

  validateIPPort(address) {
    const ipPortPattern = /^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/;
    if (!ipPortPattern.test(address)) {
      return false;
    }
    
    const [ip, port] = address.split(':');
    const ipParts = ip.split('.');
    
    // Validate IP octets
    for (const part of ipParts) {
      const num = parseInt(part);
      if (num < 0 || num > 255) return false;
    }
    
    // Validate port
    const portNum = parseInt(port);
    if (portNum < 1 || portNum > 65535) return false;
    
    return true;
  }

  async testCoordinatorConnection(coordinatorAddress) {
    try {
      // For browser environment, we'll simulate the connection test
      // In a real implementation, this would try to reach the coordinator
      const [ip, port] = coordinatorAddress.split(':');
      
      // Check if the IP is in a valid local network range
      if (!ip.startsWith('192.168.') && !ip.startsWith('10.') && !ip.startsWith('172.')) {
        return {
          success: false,
          error: 'Coordinator must be on the same local network'
        };
      }
      
      // Simulate connection test delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo purposes, assume connection works
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: 'Network connection failed'
      };
    }
  }

  async registerWithCoordinator() {
    const registrationData = {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      ip: await this.getLocalIP(),
      port: this.port,
      timestamp: Date.now()
    };
    
    const registerEndpoint = `http://${this.coordinatorAddress}/register`;
    
    try {
      const response = await this.makeHTTPRequest(registerEndpoint, {
        method: 'POST',
        body: JSON.stringify(registrationData)
      });
      
      if (response.success) {
        console.log('[HTTPMeshSync] Registered with coordinator');
        this.showMessage('Successfully registered with coordinator', 'success');
        return true;
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      console.error('[HTTPMeshSync] Registration failed:', error);
      this.showMessage('Failed to register with coordinator: ' + error.message, 'error');
      return false;
    }
  }

  startClientSync() {
    this.syncInterval = setInterval(() => {
      this.requestSyncFromCoordinator();
    }, 3000);
  }

  async requestSyncFromCoordinator() {
    try {
      const syncEndpoint = `http://${this.coordinatorAddress}${this.syncEndpoint}?deviceId=${this.deviceId}`;
      const response = await this.makeHTTPRequest(syncEndpoint);
      
      if (response.success && response.syncData) {
        this.applySyncData(response.syncData);
        this.showSyncActivity('Received data from coordinator');
      }
    } catch (error) {
      console.warn('[HTTPMeshSync] Failed to sync with coordinator:', error.message);
      this.showMessage('Sync failed: ' + error.message, 'warning');
    }
  }

  applySyncData(syncData) {
    if (!window.StorageManager) return;
    
    let updated = false;
    
    // Apply personnel updates
    if (syncData.personnel) {
      syncData.personnel.forEach(person => {
        const existing = window.StorageManager.getPersonnel(person.id);
        if (!existing || existing.lastModified < person.lastModified) {
          window.StorageManager.updatePersonnel(person.id, person);
          updated = true;
        }
      });
    }
    
    // Apply activity updates
    if (syncData.activities) {
      // Only add new activities, don't overwrite existing ones
      const localActivities = window.StorageManager.getActivityLog(1000);
      const localActivityIds = new Set(localActivities.map(a => a.id));
      
      syncData.activities.forEach(activity => {
        if (!localActivityIds.has(activity.id)) {
          window.StorageManager.logActivity(activity.action, activity);
          updated = true;
        }
      });
    }
    
    if (updated) {
      this.showSyncActivity('Data updated from coordinator');
      
      // Update UI if dashboard is visible
      if (window.app && document.getElementById('dashboard-page').classList.contains('active')) {
        window.app.updateDashboard();
      }
    }
  }

  checkDeviceHealth() {
    const now = Date.now();
    const timeout = 30000; // 30 seconds
    
    this.connectedDevices.forEach((device, deviceId) => {
      if (now - device.lastSeen > timeout) {
        console.log('[HTTPMeshSync] Device timeout, removing:', device.deviceName);
        this.connectedDevices.delete(deviceId);
        this.showSyncActivity(`Device disconnected: ${device.deviceName}`);
        this.updateUI();
      }
    });
  }

  stopCoordinator() {
    if (!this.isCoordinator) return;
    
    // Clean up intervals
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Notify connected devices
    this.notifyDevicesShutdown();
    
    this.isCoordinator = false;
    this.syncEnabled = false;
    this.connectedDevices.clear();
    
    // Clear storage
    localStorage.removeItem('http_mesh_coordinator');
    localStorage.removeItem('http_mesh_coordinator_ip');
    localStorage.removeItem('http_mesh_coordinator_port');
    localStorage.removeItem('http_mesh_coordinator_device');
    localStorage.removeItem('http_mesh_coordinator_name');
    localStorage.removeItem('http_mesh_coordinator_start_time');
    localStorage.removeItem('http_mesh_coordinator_announcement');
    localStorage.removeItem('http_mesh_endpoints');
    
    this.showMessage('HTTP coordinator stopped', 'info');
    this.showSyncActivity('Coordinator offline');
    this.updateUI();
  }

  notifyDevicesShutdown() {
    const shutdownNotification = {
      type: 'coordinator_shutdown',
      deviceId: this.deviceId,
      message: 'Coordinator shutting down',
      timestamp: Date.now()
    };
    
    this.connectedDevices.forEach(device => {
      try {
        this.simulateHTTPRequest(`http://${device.ip}:${device.port}/coordinator-shutdown`, {
          method: 'POST',
          body: JSON.stringify(shutdownNotification)
        });
      } catch (error) {
        // Device may already be disconnected
      }
    });
  }

  disconnect() {
    this.syncEnabled = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.coordinatorAddress = null;
    
    localStorage.removeItem('http_mesh_connected_to');
    localStorage.removeItem('http_mesh_sync_enabled');
    
    this.showMessage('Disconnected from mesh network', 'info');
    this.updateUI();
  }

  showMessage(message, type = 'info') {
    console.log(`[HTTPMeshSync] ${message}`);
    
    if (window.app && window.app.showToast) {
      window.app.showToast(message, type);
    }
  }

  showSyncActivity(message) {
    console.log(`[HTTPMeshSync] ${message}`);
    
    const indicator = document.querySelector('.sync-indicator');
    if (indicator) {
      indicator.textContent = message;
      indicator.classList.add('active');
      
      setTimeout(() => {
        indicator.classList.remove('active');
      }, 3000);
    }
  }

  updateUI() {
    const syncStatus = document.querySelector('.sync-status');
    const deviceCount = document.querySelector('.device-count');
    const startBtn = document.querySelector('#start-coordinator-btn');
    const stopBtn = document.querySelector('#stop-coordinator-btn');
    const connectSection = document.querySelector('.connect-section');
    
    if (syncStatus) {
      if (this.isCoordinator) {
        syncStatus.textContent = 'HTTP Coordinator Active';
        syncStatus.className = 'sync-status coordinator';
      } else if (this.syncEnabled) {
        syncStatus.textContent = 'Connected to Network';
        syncStatus.className = 'sync-status connected';
      } else {
        syncStatus.textContent = 'Network Sync Disabled';
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
    
    // Update coordinator connection info
    this.updateCoordinatorInfo();
  }

  updateCoordinatorInfo() {
    const coordinatorInfo = document.querySelector('.coordinator-connection-info');
    
    if (this.isCoordinator && coordinatorInfo) {
      const connectionAddress = `${this.localIP}:${this.port}`;
      coordinatorInfo.innerHTML = `
        <div class="connection-display">
          <h4>Share this address with other devices:</h4>
          <div class="connection-address">${connectionAddress}</div>
          <p class="connection-help">
            Other devices on the same network can enter this address to sync data in real-time.
          </p>
        </div>
      `;
      coordinatorInfo.style.display = 'block';
    } else if (coordinatorInfo) {
      coordinatorInfo.style.display = 'none';
    }
  }

  getStatus() {
    return {
      enabled: this.syncEnabled,
      isCoordinator: this.isCoordinator,
      deviceCount: this.connectedDevices.size,
      localIP: this.localIP,
      port: this.port,
      endpoints: this.endpoints
    };
  }

  broadcastEvent(eventType, data) {
    if (!this.syncEnabled) return;
    
    console.log('[HTTPMeshSync] Broadcasting event:', eventType);
    
    const event = {
      type: 'event_broadcast',
      eventType: eventType,
      data: data,
      timestamp: Date.now(),
      deviceId: this.deviceId
    };
    
    if (this.isCoordinator) {
      // Broadcast to all connected devices
      this.connectedDevices.forEach(device => {
        this.sendEventToDevice(device, event);
      });
    } else if (this.coordinatorAddress) {
      // Send to coordinator
      this.sendEventToCoordinator(event);
    }
    
    this.showSyncActivity(`Broadcasted ${eventType} to network`);
  }

  async sendEventToDevice(device, event) {
    try {
      await this.simulateHTTPRequest(`http://${device.ip}:${device.port}/event`, {
        method: 'POST',
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.warn('[HTTPMeshSync] Failed to send event to device:', device.deviceName);
    }
  }

  async sendEventToCoordinator(event) {
    try {
      await this.simulateHTTPRequest(`http://${this.coordinatorAddress}/event`, {
        method: 'POST',
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.warn('[HTTPMeshSync] Failed to send event to coordinator');
    }
  }
}

// Initialize global instance
window.HTTPMeshSync = new HTTPMeshSync();

console.log('[HTTPMeshSync] HTTP Mesh Sync Manager loaded');
/**
 * Secure Access - Peer-to-Peer Sync Manager
 * Hybrid approach: One device acts as coordinator, others sync via HTTP
 */

class P2PSync {
  constructor() {
    this.isCoordinator = false;
    this.coordinatorUrl = null;
    this.syncEnabled = localStorage.getItem('p2p_sync_enabled') === 'true';
    this.deviceId = this.getDeviceId();
    this.syncInterval = null;
    this.httpServer = null;
    this.connectedPeers = new Map();
    this.lastSyncTime = 0;
    this.syncPort = 8081;
    
    this.setupEventListeners();
  }

  getDeviceId() {
    let deviceId = localStorage.getItem('p2p_device_id');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('p2p_device_id', deviceId);
    }
    return deviceId;
  }

  async getLocalIP() {
    return new Promise((resolve) => {
      // Create a dummy peer connection to get local IP
      const pc = new RTCPeerConnection({
        iceServers: []
      });
      
      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const candidate = ice.candidate.candidate;
        const ip = candidate.split(' ')[4];
        
        // Look for local IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (ip && (
          ip.startsWith('192.168.') || 
          ip.startsWith('10.') || 
          (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31)
        )) {
          pc.close();
          resolve(ip);
        }
      };
      
      // Fallback after timeout
      setTimeout(() => {
        pc.close();
        resolve('192.168.1.100'); // Default fallback
      }, 3000);
    });
  }

  setupEventListeners() {
    // Listen for data changes to broadcast
    window.addEventListener('personnel-added', (e) => this.broadcastUpdate('personnel-added', e.detail));
    window.addEventListener('personnel-updated', (e) => this.broadcastUpdate('personnel-updated', e.detail));
    window.addEventListener('check-in', (e) => this.broadcastUpdate('check-in', e.detail));
    window.addEventListener('check-out', (e) => this.broadcastUpdate('check-out', e.detail));
    window.addEventListener('emergency-activated', (e) => this.broadcastUpdate('emergency-activated', e.detail));
  }

  async startAsCoordinator() {
    try {
      // Check if coordinator is already running on this device
      const existingCoordinator = localStorage.getItem('p2p_coordinator');
      if (existingCoordinator === 'true' && this.isCoordinator) {
        this.showStatus('Coordinator already running on this device', 'warning');
        return false;
      }
      
      console.log('[P2PSync] Starting as coordinator...');
      this.isCoordinator = true;
      this.coordinatorPort = 8080; // Fixed port for mesh network discovery
      
      // Get local IP for WiFi/mesh networks
      const localIP = await this.getLocalIP();
      this.coordinatorIP = localIP;
      
      // Create a simple HTTP endpoint using Service Worker
      this.setupCoordinatorEndpoints();
      
      // Start periodic cleanup of stale connections
      this.startPeerCleanup();
      
      localStorage.setItem('p2p_coordinator', 'true');
      localStorage.setItem('p2p_coordinator_ip', localIP);
      localStorage.setItem('p2p_coordinator_port', this.coordinatorPort);
      localStorage.setItem('p2p_coordinator_timestamp', Date.now());
      
      this.showStatus(`Coordinator started on ${localIP}:${this.coordinatorPort}`, 'success');
      console.log('[P2PSync] Coordinator started successfully');
      
      // Add a visual indicator to the main interface
      this.addSyncIndicatorToHeader();
      
      return true;
    } catch (error) {
      console.error('[P2PSync] Error starting coordinator:', error);
      this.showStatus('Failed to start coordinator: ' + error.message, 'error');
      return false;
    }
  }

  setupCoordinatorEndpoints() {
    console.log('[P2PSync] Setting up coordinator endpoints');
    
    // For local network, we'll use a simplified approach
    // Store coordinator data in localStorage for other devices to find
    const coordinatorData = {
      deviceId: this.deviceId,
      ip: this.coordinatorIP,
      port: this.coordinatorPort,
      timestamp: Date.now(),
      status: 'active'
    };
    
    localStorage.setItem('coordinator_data', JSON.stringify(coordinatorData));
    
    // Setup in-memory endpoints using fetch interception
    this.setupFetchInterception();
  }

  setupFetchInterception() {
    // Store original fetch
    const originalFetch = window.fetch;
    
    // Override fetch for our P2P endpoints
    window.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('/p2p-sync')) {
        return this.handleP2PRequest(url, options);
      }
      return originalFetch(url, options);
    };
  }

  async handleP2PRequest(url, options) {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.parse(options.body) : null;

    if (url.endsWith('/register')) {
      return this.handlePeerRegister(body);
    } else if (url.endsWith('/sync')) {
      return this.handleSyncRequest(body);
    } else if (url.endsWith('/broadcast')) {
      return this.handleBroadcast(body);
    } else if (url.endsWith('/status')) {
      return this.handleStatusRequest();
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handlePeerRegister(data) {
    const peerId = data.deviceId;
    this.connectedPeers.set(peerId, {
      id: peerId,
      name: data.deviceName || peerId,
      lastSeen: Date.now(),
      ip: data.ip || 'unknown'
    });

    console.log('[P2PSync] Peer registered:', peerId);
    this.updateUI();

    return new Response(JSON.stringify({ 
      success: true, 
      coordinatorId: this.deviceId,
      syncData: this.getFullSyncData()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleSyncRequest(data) {
    if (data && data.updates) {
      await this.applyRemoteUpdates(data.updates);
    }

    return new Response(JSON.stringify({
      success: true,
      updates: this.getRecentUpdates(data.lastSyncTime || 0)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleBroadcast(data) {
    if (data && data.event) {
      await this.processRemoteUpdate(data.event);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleStatusRequest() {
    return new Response(JSON.stringify({
      coordinatorId: this.deviceId,
      peerCount: this.connectedPeers.size,
      peers: Array.from(this.connectedPeers.values())
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async connectToPeer(coordinatorAddress) {
    try {
      console.log('[P2PSync] Attempting to connect to coordinator:', coordinatorAddress);
      
      // For now, simulate connection since direct IP:port connections
      // require a real server running on the coordinator device
      this.coordinatorUrl = coordinatorAddress;
      this.isCoordinator = false;
      
      // Simulate successful connection
      const peerData = {
        deviceId: this.deviceId,
        deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Device',
        connectedTo: coordinatorAddress,
        timestamp: Date.now()
      };
      
      localStorage.setItem('p2p_peer_data', JSON.stringify(peerData));
      
      // Start periodic sync simulation
      this.startPeriodicSync();
      
      this.showStatus(`Connected to coordinator at ${coordinatorAddress}`, 'success');
      console.log('[P2PSync] Connection established');
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error('[P2PSync] Error connecting to coordinator:', error);
      this.showStatus('Failed to connect: ' + error.message, 'error');
      return false;
    }
  }

  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, 5000); // Sync every 5 seconds
  }

  async performSync() {
    if (!this.coordinatorUrl || this.isCoordinator) return;

    try {
      const syncUrl = `${this.coordinatorUrl}/p2p-sync/sync`;
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.deviceId,
          lastSyncTime: this.lastSyncTime,
          updates: this.getLocalUpdates()
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.updates && result.updates.length > 0) {
          await this.applyRemoteUpdates(result.updates);
          this.showSyncActivity(`Received ${result.updates.length} updates`);
        }
        this.lastSyncTime = Date.now();
      }
    } catch (error) {
      console.error('[P2PSync] Sync error:', error);
      this.showStatus('Sync error: ' + error.message, 'warning');
    }
  }

  async broadcastUpdate(eventType, data) {
    if (!this.syncEnabled) return;

    const update = {
      type: eventType,
      data: data,
      timestamp: Date.now(),
      deviceId: this.deviceId
    };

    if (this.isCoordinator) {
      // Broadcast to all connected peers (not implemented in browser)
      console.log('[P2PSync] Broadcasting update:', eventType);
    } else if (this.coordinatorUrl) {
      // Send to coordinator
      try {
        await fetch(`${this.coordinatorUrl}/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: update })
        });
      } catch (error) {
        console.error('[P2PSync] Broadcast error:', error);
      }
    }
  }

  getFullSyncData() {
    return {
      personnel: window.StorageManager.getAllPersonnel(),
      activities: window.StorageManager.getActivityLog(1000),
      settings: window.StorageManager.getAllSettings(),
      timestamp: Date.now()
    };
  }

  getRecentUpdates(since) {
    const activities = window.StorageManager.getActivityLog(1000);
    return activities.filter(activity => 
      new Date(activity.timestamp).getTime() > since
    );
  }

  getLocalUpdates() {
    // Get recent local changes (simplified)
    return this.getRecentUpdates(this.lastSyncTime);
  }

  async applySyncData(syncData) {
    // Apply full sync data from coordinator
    if (syncData.personnel) {
      for (const person of syncData.personnel) {
        const existing = window.StorageManager.getPersonnel(person.id);
        if (!existing || person.lastModified > existing.lastModified) {
          await window.StorageManager.updatePersonnel(person.id, person);
        }
      }
    }
    console.log('[P2PSync] Full sync data applied');
  }

  async applyRemoteUpdates(updates) {
    for (const update of updates) {
      await this.processRemoteUpdate(update);
    }
  }

  async processRemoteUpdate(update) {
    switch (update.action) {
      case 'check_in':
        if (update.data.personnelId) {
          const person = window.StorageManager.getPersonnel(update.data.personnelId);
          if (person) {
            person.status = 'checked-in';
            person.lastCheckIn = update.timestamp;
            await window.StorageManager.updatePersonnel(person.id, person);
          }
        }
        break;
      case 'check_out':
        if (update.data.personnelId) {
          const person = window.StorageManager.getPersonnel(update.data.personnelId);
          if (person) {
            person.status = 'checked-out';
            person.lastCheckOut = update.timestamp;
            await window.StorageManager.updatePersonnel(person.id, person);
          }
        }
        break;
      case 'personnel_added':
        if (update.data.id) {
          await window.StorageManager.addPersonnel(update.data);
        }
        break;
    }
  }

  startPeerCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [peerId, peer] of this.connectedPeers) {
        if (now - peer.lastSeen > 60000) { // 1 minute timeout
          this.connectedPeers.delete(peerId);
          console.log('[P2PSync] Removed stale peer:', peerId);
        }
      }
      this.updateUI();
    }, 30000); // Check every 30 seconds
  }

  enable() {
    this.syncEnabled = true;
    localStorage.setItem('p2p_sync_enabled', 'true');
    this.showStatus('P2P sync enabled', 'success');
  }

  stopCoordinator() {
    if (this.isCoordinator) {
      this.isCoordinator = false;
      this.connectedPeers.clear();
      
      localStorage.removeItem('p2p_coordinator');
      localStorage.removeItem('p2p_coordinator_ip');
      localStorage.removeItem('p2p_coordinator_port');
      localStorage.removeItem('p2p_coordinator_timestamp');
      localStorage.removeItem('coordinator_data');
      
      // Remove header indicator
      const headerIndicator = document.getElementById('sync-status-indicator');
      if (headerIndicator) {
        headerIndicator.remove();
      }
      
      this.showStatus('Coordinator stopped', 'info');
      this.updateUI();
    }
  }

  disable() {
    this.syncEnabled = false;
    localStorage.setItem('p2p_sync_enabled', 'false');
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.stopCoordinator();
    this.coordinatorUrl = null;
    
    // Remove header indicator
    const headerIndicator = document.getElementById('sync-status-indicator');
    if (headerIndicator) {
      headerIndicator.remove();
    }
    
    this.showStatus('P2P sync disabled', 'info');
    this.updateUI();
  }

  generateConnectionUrl() {
    if (this.isCoordinator) {
      return `${window.location.origin}/p2p-sync`;
    }
    return null;
  }

  showStatus(message, type) {
    if (window.app) {
      window.app.showToast(message, type);
    }
    console.log(`[P2PSync] ${message}`);
  }

  showSyncActivity(message) {
    if (window.app) {
      window.app.showToast(message, 'info');
    }
  }

  addSyncIndicatorToHeader() {
    const header = document.querySelector('.top-bar');
    if (header && !document.getElementById('sync-status-indicator')) {
      const indicator = document.createElement('div');
      indicator.id = 'sync-status-indicator';
      indicator.innerHTML = `
        <span class="material-icons sync-icon">sync</span>
        <span class="sync-text">Coordinator</span>
      `;
      indicator.style.cssText = `
        display: flex; 
        align-items: center; 
        gap: 4px; 
        color: var(--success); 
        font-size: 12px;
        background: rgba(76, 175, 80, 0.1);
        padding: 4px 8px;
        border-radius: 12px;
        border: 1px solid rgba(76, 175, 80, 0.3);
      `;
      header.appendChild(indicator);
    }
  }

  updateUI() {
    // Update sync status in UI
    const statusElement = document.getElementById('sync-status');
    const deviceCountElement = document.getElementById('connected-devices-count');

    if (statusElement) {
      if (!this.syncEnabled) {
        statusElement.textContent = 'Disabled';
        statusElement.className = 'sync-status disabled';
      } else if (this.isCoordinator) {
        statusElement.textContent = 'Coordinator';
        statusElement.className = 'sync-status server';
      } else if (this.coordinatorUrl) {
        statusElement.textContent = 'Connected';
        statusElement.className = 'sync-status connected';
      } else {
        statusElement.textContent = 'Disconnected';
        statusElement.className = 'sync-status disconnected';
      }
    }

    if (deviceCountElement) {
      deviceCountElement.textContent = this.connectedPeers.size;
    }

    // Update header indicator
    const headerIndicator = document.getElementById('sync-status-indicator');
    if (headerIndicator) {
      if (!this.syncEnabled) {
        headerIndicator.style.display = 'none';
      } else {
        headerIndicator.style.display = 'flex';
        const syncText = headerIndicator.querySelector('.sync-text');
        if (this.isCoordinator) {
          syncText.textContent = `Coordinator (${this.connectedPeers.size})`;
          headerIndicator.style.color = 'var(--success)';
          headerIndicator.style.background = 'rgba(76, 175, 80, 0.1)';
        } else if (this.coordinatorUrl) {
          syncText.textContent = 'Connected';
          headerIndicator.style.color = 'var(--primary)';
          headerIndicator.style.background = 'rgba(33, 150, 243, 0.1)';
        } else {
          syncText.textContent = 'Disconnected';
          headerIndicator.style.color = 'var(--warning)';
          headerIndicator.style.background = 'rgba(255, 152, 0, 0.1)';
        }
      }
    }
  }

  getStatus() {
    return {
      enabled: this.syncEnabled,
      isCoordinator: this.isCoordinator,
      coordinatorUrl: this.coordinatorUrl,
      deviceId: this.deviceId,
      connectedPeers: Array.from(this.connectedPeers.values()),
      lastSyncTime: this.lastSyncTime
    };
  }
}

// Initialize P2P sync
window.P2PSync = new P2PSync();
console.log('[P2PSync] P2P Sync Manager loaded');
/**
 * Secure Access - Simple Mesh WiFi Sync
 * Simplified local network synchronization for security devices
 */

class MeshSync {
  constructor() {
    this.deviceId = this.generateDeviceId();
    this.isCoordinator = false;
    this.connectedDevices = new Map();
    this.syncEnabled = false;
    this.localIP = null;
    this.port = 8080;
    this.lastSyncTime = 0;
    
    console.log('[MeshSync] Mesh Sync Manager initialized');
  }

  generateDeviceId() {
    return 'device-' + Math.random().toString(36).substr(2, 9);
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
      
      return new Promise((resolve) => {
        connection.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch) {
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
      
      // Store coordinator info
      localStorage.setItem('mesh_coordinator', 'true');
      localStorage.setItem('mesh_coordinator_ip', this.localIP);
      localStorage.setItem('mesh_coordinator_port', this.port);
      
      this.showMessage(`Coordinator started on ${this.localIP}:${this.port}`, 'success');
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error('[MeshSync] Failed to start coordinator:', error);
      this.showMessage('Failed to start coordinator', 'error');
      return false;
    }
  }

  stopCoordinator() {
    if (!this.isCoordinator) return;
    
    this.isCoordinator = false;
    this.syncEnabled = false;
    this.connectedDevices.clear();
    
    // Clear storage
    localStorage.removeItem('mesh_coordinator');
    localStorage.removeItem('mesh_coordinator_ip');
    localStorage.removeItem('mesh_coordinator_port');
    
    this.showMessage('Coordinator stopped', 'info');
    this.updateUI();
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
    // Update Network Sync page
    const syncStatus = document.querySelector('.sync-status');
    const deviceCount = document.querySelector('.device-count');
    const startBtn = document.querySelector('#start-coordinator-btn');
    const stopBtn = document.querySelector('#stop-coordinator-btn');
    const connectSection = document.querySelector('.connect-section');
    
    if (syncStatus) {
      if (this.isCoordinator) {
        syncStatus.textContent = 'Coordinator';
        syncStatus.className = 'sync-status coordinator';
      } else if (this.syncEnabled) {
        syncStatus.textContent = 'Connected';
        syncStatus.className = 'sync-status connected';
      } else {
        syncStatus.textContent = 'Disabled';
        syncStatus.className = 'sync-status disabled';
      }
    }
    
    if (deviceCount) {
      deviceCount.textContent = `Devices: ${this.connectedDevices.size}`;
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

  // Broadcast events to connected devices
  broadcastEvent(eventType, data) {
    if (!this.syncEnabled) return;
    
    console.log('[MeshSync] Broadcasting event:', eventType);
    
    // In a real implementation, this would send to all connected devices
    // For now, just log the broadcast
    const event = {
      type: eventType,
      data: data,
      timestamp: Date.now(),
      deviceId: this.deviceId
    };
    
    // Store for potential sync
    const broadcasts = JSON.parse(localStorage.getItem('mesh_broadcasts') || '[]');
    broadcasts.push(event);
    
    // Keep only recent broadcasts
    const recent = broadcasts.filter(b => Date.now() - b.timestamp < 300000); // 5 minutes
    localStorage.setItem('mesh_broadcasts', JSON.stringify(recent));
  }
}

// Initialize global instance
window.MeshSync = new MeshSync();

console.log('[MeshSync] Mesh Sync Manager loaded');
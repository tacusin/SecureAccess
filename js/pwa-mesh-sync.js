/**
 * Secure Access - PWA Mesh Sync
 * Browser-native real-time synchronization using WebRTC Data Channels and Broadcast Channel API
 */

class PWAMeshSync {
  constructor() {
    this.deviceId = this.generateDeviceId();
    this.deviceName = this.generateDeviceName();
    this.isCoordinator = false;
    this.syncEnabled = false;
    
    this.connectedPeers = new Map();
    this.dataChannel = null;
    this.broadcastChannel = null;
    this.signalingChannel = null;
    
    // WebRTC configuration for local network
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };
    
    this.init();
  }

  async init() {
    // Initialize Broadcast Channel for same-browser communication
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('security-mesh-sync');
      this.broadcastChannel.onmessage = (event) => {
        this.handleBroadcastMessage(event.data);
      };
    }
    
    // Initialize shared worker for cross-tab coordination
    if (typeof SharedWorker !== 'undefined') {
      try {
        this.initSharedWorker();
      } catch (error) {
        console.warn('[PWAMeshSync] SharedWorker not available, using broadcast only');
      }
    }
    
    console.log('[PWAMeshSync] PWA Mesh Sync initialized');
  }

  initSharedWorker() {
    // Create shared worker for cross-tab synchronization
    const workerCode = `
      class MeshSyncWorker {
        constructor() {
          this.ports = [];
          this.coordinatorPort = null;
          this.syncData = {
            personnel: [],
            activities: [],
            settings: {},
            lastUpdate: Date.now()
          };
        }

        handleMessage(port, data) {
          switch (data.type) {
            case 'register':
              this.registerPort(port, data);
              break;
            case 'become_coordinator':
              this.setCoordinator(port, data);
              break;
            case 'sync_request':
              this.handleSyncRequest(port, data);
              break;
            case 'sync_data':
              this.handleSyncData(port, data);
              break;
          }
        }

        registerPort(port, data) {
          this.ports.push({ port, deviceId: data.deviceId, deviceName: data.deviceName });
          port.postMessage({ type: 'registered', success: true });
        }

        setCoordinator(port, data) {
          this.coordinatorPort = port;
          this.broadcastToAll({ type: 'coordinator_changed', coordinatorId: data.deviceId });
        }

        handleSyncRequest(port, data) {
          port.postMessage({ 
            type: 'sync_response', 
            syncData: this.syncData,
            deviceCount: this.ports.length
          });
        }

        handleSyncData(port, data) {
          this.mergeSyncData(data.syncData);
          this.broadcastToAll({ type: 'data_update', syncData: this.syncData }, port);
        }

        mergeSyncData(newData) {
          if (newData.personnel) {
            this.syncData.personnel = this.mergeArrayData(this.syncData.personnel, newData.personnel);
          }
          if (newData.activities) {
            this.syncData.activities = this.mergeArrayData(this.syncData.activities, newData.activities);
          }
          if (newData.settings) {
            this.syncData.settings = { ...this.syncData.settings, ...newData.settings };
          }
          this.syncData.lastUpdate = Date.now();
        }

        mergeArrayData(existing, newData) {
          const merged = [...existing];
          newData.forEach(item => {
            const existingIndex = merged.findIndex(existing => existing.id === item.id);
            if (existingIndex >= 0) {
              if (item.lastModified > merged[existingIndex].lastModified) {
                merged[existingIndex] = item;
              }
            } else {
              merged.push(item);
            }
          });
          return merged;
        }

        broadcastToAll(message, excludePort = null) {
          this.ports.forEach(({ port }) => {
            if (port !== excludePort) {
              port.postMessage(message);
            }
          });
        }
      }

      const worker = new MeshSyncWorker();

      self.onconnect = function(e) {
        const port = e.ports[0];
        port.onmessage = function(event) {
          worker.handleMessage(port, event.data);
        };
        port.start();
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    this.sharedWorker = new SharedWorker(workerUrl);
    this.sharedWorker.port.onmessage = (event) => {
      this.handleWorkerMessage(event.data);
    };
    
    // Register with shared worker
    this.sharedWorker.port.postMessage({
      type: 'register',
      deviceId: this.deviceId,
      deviceName: this.deviceName
    });
    
    this.sharedWorker.port.start();
  }

  handleWorkerMessage(data) {
    switch (data.type) {
      case 'registered':
        console.log('[PWAMeshSync] Registered with shared worker');
        break;
      case 'coordinator_changed':
        this.updateCoordinatorStatus(data.coordinatorId);
        break;
      case 'data_update':
        this.applySyncData(data.syncData);
        break;
      case 'sync_response':
        this.applySyncData(data.syncData);
        this.updateUI();
        break;
    }
  }

  handleBroadcastMessage(data) {
    switch (data.type) {
      case 'coordinator_announcement':
        if (data.deviceId !== this.deviceId && !this.isCoordinator) {
          this.handleCoordinatorDiscovery(data);
        }
        break;
      case 'sync_request':
        if (this.isCoordinator && data.targetId === this.deviceId) {
          this.handlePeerSyncRequest(data);
        }
        break;
      case 'sync_data':
        if (data.targetId === this.deviceId) {
          this.applySyncData(data.syncData);
        }
        break;
      case 'peer_disconnect':
        this.handlePeerDisconnect(data.deviceId);
        break;
    }
  }

  async startCoordinator() {
    if (this.isCoordinator) {
      this.showMessage('Coordinator already running', 'warning');
      return false;
    }

    try {
      this.isCoordinator = true;
      this.syncEnabled = true;
      this.connectedPeers.clear();
      
      // Announce coordinator status
      this.announceCoordinator();
      
      // Set up periodic announcements
      this.coordinatorInterval = setInterval(() => {
        this.announceCoordinator();
      }, 5000);
      
      // Register with shared worker as coordinator
      if (this.sharedWorker) {
        this.sharedWorker.port.postMessage({
          type: 'become_coordinator',
          deviceId: this.deviceId
        });
      }
      
      // Store coordinator info
      localStorage.setItem('pwa_mesh_coordinator', 'true');
      localStorage.setItem('pwa_mesh_coordinator_device', this.deviceId);
      localStorage.setItem('pwa_mesh_coordinator_name', this.deviceName);
      
      this.showMessage(`PWA coordinator "${this.deviceName}" active`, 'success');
      this.showSyncActivity('Broadcasting availability to browser tabs and local apps');
      this.updateUI();
      
      return true;
    } catch (error) {
      console.error('[PWAMeshSync] Failed to start coordinator:', error);
      this.showMessage('Failed to start coordinator: ' + error.message, 'error');
      return false;
    }
  }

  announceCoordinator() {
    const announcement = {
      type: 'coordinator_announcement',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      timestamp: Date.now(),
      connectedPeers: this.connectedPeers.size
    };
    
    // Broadcast to same-browser tabs
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(announcement);
    }
    
    // Store announcement for discovery
    localStorage.setItem('pwa_mesh_coordinator_announcement', JSON.stringify(announcement));
  }

  handleCoordinatorDiscovery(announcement) {
    console.log('[PWAMeshSync] Discovered coordinator:', announcement.deviceName);
    
    if (!this.isCoordinator && this.syncEnabled) {
      this.connectToCoordinator(announcement);
    }
  }

  connectToCoordinator(coordinatorInfo) {
    this.coordinatorId = coordinatorInfo.deviceId;
    this.coordinatorName = coordinatorInfo.deviceName;
    
    // Start periodic sync with coordinator
    this.startCoordinatorSync();
    
    this.showMessage(`Connected to coordinator: ${coordinatorInfo.deviceName}`, 'success');
    this.updateUI();
  }

  startCoordinatorSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      this.requestSyncFromCoordinator();
    }, 3000);
  }

  requestSyncFromCoordinator() {
    const syncRequest = {
      type: 'sync_request',
      deviceId: this.deviceId,
      targetId: this.coordinatorId,
      timestamp: Date.now()
    };
    
    // Send via broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(syncRequest);
    }
    
    // Send via shared worker
    if (this.sharedWorker) {
      this.sharedWorker.port.postMessage({
        type: 'sync_request',
        deviceId: this.deviceId
      });
    }
  }

  handlePeerSyncRequest(request) {
    if (!this.isCoordinator) return;
    
    const syncData = this.getSyncData();
    const response = {
      type: 'sync_data',
      deviceId: this.deviceId,
      targetId: request.deviceId,
      syncData: syncData,
      timestamp: Date.now()
    };
    
    // Send response
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(response);
    }
    
    this.showSyncActivity(`Sent sync data to ${request.deviceId}`);
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

  applySyncData(syncData) {
    if (!window.StorageManager || !syncData) return;
    
    console.log('[PWAMeshSync] Applying sync data from coordinator');
    
    // Apply personnel updates
    if (syncData.personnel && Array.isArray(syncData.personnel)) {
      syncData.personnel.forEach(person => {
        const existing = window.StorageManager.getPersonnel(person.id);
        if (!existing || person.lastModified > existing.lastModified) {
          window.StorageManager.updatePersonnel(person.id, person);
        }
      });
    }
    
    // Apply settings updates
    if (syncData.settings) {
      Object.entries(syncData.settings).forEach(([key, value]) => {
        window.StorageManager.setSetting(key, value);
      });
    }
    
    this.showSyncActivity('Data synchronized from coordinator');
  }

  stopCoordinator() {
    if (!this.isCoordinator) return;
    
    this.isCoordinator = false;
    
    if (this.coordinatorInterval) {
      clearInterval(this.coordinatorInterval);
      this.coordinatorInterval = null;
    }
    
    // Notify peers of shutdown
    const shutdownNotification = {
      type: 'coordinator_shutdown',
      deviceId: this.deviceId,
      timestamp: Date.now()
    };
    
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(shutdownNotification);
    }
    
    localStorage.removeItem('pwa_mesh_coordinator');
    localStorage.removeItem('pwa_mesh_coordinator_device');
    localStorage.removeItem('pwa_mesh_coordinator_announcement');
    
    this.connectedPeers.clear();
    this.showMessage('Coordinator stopped', 'info');
    this.updateUI();
  }

  enableSync() {
    this.syncEnabled = true;
    localStorage.setItem('pwa_mesh_sync_enabled', 'true');
    
    // Look for existing coordinator
    this.discoverCoordinator();
    
    this.showMessage('PWA mesh sync enabled', 'success');
    this.updateUI();
  }

  disableSync() {
    this.syncEnabled = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.isCoordinator) {
      this.stopCoordinator();
    }
    
    localStorage.setItem('pwa_mesh_sync_enabled', 'false');
    this.showMessage('PWA mesh sync disabled', 'info');
    this.updateUI();
  }

  discoverCoordinator() {
    const announcement = localStorage.getItem('pwa_mesh_coordinator_announcement');
    if (announcement) {
      try {
        const coordinatorInfo = JSON.parse(announcement);
        if (coordinatorInfo.deviceId !== this.deviceId) {
          this.handleCoordinatorDiscovery(coordinatorInfo);
        }
      } catch (error) {
        console.warn('[PWAMeshSync] Invalid coordinator announcement');
      }
    }
  }

  updateUI() {
    const syncStatus = document.querySelector('.sync-status');
    const deviceCount = document.querySelector('.device-count');
    
    if (syncStatus) {
      if (this.isCoordinator) {
        syncStatus.textContent = 'PWA Coordinator Active';
        syncStatus.className = 'sync-status coordinator';
      } else if (this.syncEnabled && this.coordinatorId) {
        syncStatus.textContent = 'Connected to PWA Coordinator';
        syncStatus.className = 'sync-status connected';
      } else if (this.syncEnabled) {
        syncStatus.textContent = 'Searching for Coordinator';
        syncStatus.className = 'sync-status searching';
      } else {
        syncStatus.textContent = 'PWA Sync Disabled';
        syncStatus.className = 'sync-status disabled';
      }
    }
    
    if (deviceCount) {
      const count = this.connectedPeers.size;
      deviceCount.textContent = count > 0 ? `${count} device${count !== 1 ? 's' : ''} connected` : 'No devices connected';
    }
    
    this.updateCoordinatorInfo();
  }

  updateCoordinatorInfo() {
    const coordinatorInfo = document.querySelector('.coordinator-connection-info');
    
    if (this.isCoordinator && coordinatorInfo) {
      coordinatorInfo.innerHTML = `
        <div class="connection-display">
          <h4>PWA Coordinator Active</h4>
          <div class="connection-address">Browser-based mesh network</div>
          <p class="connection-help">
            Other browser tabs and PWA instances can automatically connect to sync data in real-time.
            Works across tabs, windows, and PWA installations on the same device.
          </p>
        </div>
      `;
      coordinatorInfo.classList.add('active');
    } else if (coordinatorInfo) {
      coordinatorInfo.classList.remove('active');
    }
  }

  getStatus() {
    return {
      enabled: this.syncEnabled,
      isCoordinator: this.isCoordinator,
      deviceCount: this.connectedPeers.size,
      coordinatorId: this.coordinatorId,
      deviceId: this.deviceId
    };
  }

  generateDeviceId() {
    return 'pwa-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  generateDeviceName() {
    const deviceType = navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';
    return `Security ${deviceType} PWA`;
  }

  showMessage(message, type = 'info') {
    console.log(`[PWAMeshSync] ${message}`);
    
    if (window.app && window.app.showToast) {
      window.app.showToast(message, type);
    }
  }

  showSyncActivity(message) {
    console.log(`[PWAMeshSync] ${message}`);
    
    const indicator = document.querySelector('.sync-indicator');
    if (indicator) {
      indicator.classList.add('active');
      setTimeout(() => {
        indicator.classList.remove('active');
      }, 2000);
    }
  }
}

// Initialize global instance
window.PWAMeshSync = new PWAMeshSync();

console.log('[PWAMeshSync] PWA Mesh Sync Manager loaded');
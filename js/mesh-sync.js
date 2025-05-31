/**
 * Secure Access - WebRTC Multi-Peer Sync
 * Real-time peer-to-peer synchronization across devices on local network
 */

class MeshSync {
  constructor() {
    this.deviceId = this.generateDeviceId();
    this.deviceName = this.generateDeviceName();
    this.isCoordinator = false;
    this.connectedPeers = new Map();
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.syncEnabled = localStorage.getItem('mesh_sync_enabled') === 'true';
    this.localIP = null;
    this.port = 8080;
    this.lastSyncTime = 0;
    this.signalingChannel = 'mesh_sync_signaling';
    this.discoveryInterval = null;
    this.heartbeatInterval = null;
    this.syncMonitor = null;
    
    // Check if this device was previously a coordinator
    if (localStorage.getItem('mesh_coordinator') === 'true') {
      this.localIP = localStorage.getItem('mesh_coordinator_ip');
      this.isCoordinator = true;
    }
    
    console.log('[MeshSync] WebRTC Mesh Sync Manager initialized');
  }

  generateDeviceId() {
    let deviceId = localStorage.getItem('mesh_device_id');
    if (!deviceId) {
      deviceId = 'mesh-device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('mesh_device_id', deviceId);
    }
    return deviceId;
  }

  generateDeviceName() {
    let deviceName = localStorage.getItem('mesh_device_name');
    if (!deviceName) {
      const adjectives = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot', 'Guard', 'Hotel'];
      const nouns = ['Station', 'Terminal', 'Post', 'Unit', 'Base', 'Center', 'Hub', 'Node'];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      deviceName = `${adj} ${noun}`;
      localStorage.setItem('mesh_device_name', deviceName);
    }
    return deviceName;
  }

  async getLocalIP() {
    try {
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
            resolve('10.9.96.17'); // Fallback IP
          }
        }, 3000);
        
        connection.onicecandidate = (event) => {
          if (event.candidate && !resolved) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch && ipMatch[1].startsWith('192.168.') || ipMatch[1].startsWith('10.')) {
              resolved = true;
              clearTimeout(timeout);
              connection.close();
              resolve(ipMatch[1]);
            }
          }
        };
      });
    } catch (error) {
      console.error('[MeshSync] Error getting local IP:', error);
      return '10.9.96.17'; // Fallback IP
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
      this.connectedPeers.clear();
      
      // Initialize WebRTC coordinator
      await this.initializeWebRTCCoordinator();
      this.startPeerDiscovery();
      this.startDataSynchronization();
      
      // Store coordinator info
      localStorage.setItem('mesh_coordinator', 'true');
      localStorage.setItem('mesh_coordinator_ip', this.localIP);
      localStorage.setItem('mesh_coordinator_device', this.deviceId);
      localStorage.setItem('mesh_coordinator_name', this.deviceName);
      localStorage.setItem('mesh_coordinator_start_time', Date.now().toString());
      
      // Broadcast coordinator presence
      this.broadcastCoordinatorPresence();
      
      this.showMessage(`WebRTC coordinator "${this.deviceName}" active`, 'success');
      this.showSyncActivity('Waiting for peer connections');
      this.updateUI();
      this.updateVisualIndicators();
      
      return true;
    } catch (error) {
      console.error('[MeshSync] Failed to start coordinator:', error);
      this.showMessage('Failed to start coordinator: ' + error.message, 'error');
      return false;
    }
  }

  async initializeWebRTCCoordinator() {
    this.peerConnections.clear();
    this.dataChannels.clear();
    
    // Set up signaling via localStorage/BroadcastChannel for local network discovery
    this.setupSignalingChannel();
    
    console.log('[MeshSync] WebRTC coordinator initialized');
  }

  setupSignalingChannel() {
    // Use BroadcastChannel for same-origin signaling
    if ('BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(this.signalingChannel);
      this.broadcastChannel.onmessage = (event) => {
        this.handleSignalingMessage(event.data);
      };
    }
    
    // Fallback to localStorage events for cross-tab communication
    window.addEventListener('storage', (event) => {
      if (event.key === this.signalingChannel && event.newValue) {
        try {
          const message = JSON.parse(event.newValue);
          this.handleSignalingMessage(message);
        } catch (error) {
          console.warn('[MeshSync] Invalid signaling message:', error);
        }
      }
    });
  }

  async handleSignalingMessage(message) {
    if (message.targetDevice && message.targetDevice !== this.deviceId) {
      return; // Message not for this device
    }

    console.log('[MeshSync] Received signaling message:', message.type, 'from', message.sourceDevice);

    switch (message.type) {
      case 'discover_coordinator':
        if (this.isCoordinator) {
          this.respondToDiscovery(message.sourceDevice, message.deviceName);
        }
        break;
      case 'coordinator_response':
        if (!this.isCoordinator) {
          await this.initiateConnection(message.sourceDevice, message.coordinatorName);
        }
        break;
      case 'connection_request':
        if (this.isCoordinator) {
          await this.handleConnectionRequest(message);
        }
        break;
      case 'webrtc_offer':
        await this.handleWebRTCOffer(message);
        break;
      case 'webrtc_answer':
        await this.handleWebRTCAnswer(message);
        break;
      case 'ice_candidate':
        await this.handleICECandidate(message);
        break;
    }
  }

  startPeerDiscovery() {
    if (this.discoveryInterval) return;
    
    this.setupSignalingChannel();
    
    this.discoveryInterval = setInterval(() => {
      if (!this.isCoordinator) {
        this.discoverCoordinator();
      }
      this.maintainPeerConnections();
    }, 5000);
    
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 10000);
  }

  discoverCoordinator() {
    this.sendSignalingMessage({
      type: 'discover_coordinator',
      sourceDevice: this.deviceId,
      deviceName: this.deviceName,
      timestamp: Date.now()
    });
  }

  respondToDiscovery(sourceDevice, deviceName) {
    this.sendSignalingMessage({
      type: 'coordinator_response',
      targetDevice: sourceDevice,
      sourceDevice: this.deviceId,
      coordinatorName: this.deviceName,
      coordinatorIP: this.localIP,
      timestamp: Date.now()
    });
  }

  async initiateConnection(coordinatorId, coordinatorName) {
    console.log('[MeshSync] Initiating connection to coordinator:', coordinatorName);
    
    this.sendSignalingMessage({
      type: 'connection_request',
      targetDevice: coordinatorId,
      sourceDevice: this.deviceId,
      deviceName: this.deviceName,
      timestamp: Date.now()
    });
  }

  sendSignalingMessage(message) {
    // Use BroadcastChannel if available
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(message);
    }
    
    // Also use localStorage for cross-browser communication
    localStorage.setItem(this.signalingChannel, JSON.stringify(message));
    
    // Clear the message after a short delay
    setTimeout(() => {
      localStorage.removeItem(this.signalingChannel);
    }, 1000);
  }

  async handleConnectionRequest(message) {
    const peerId = message.sourceDevice;
    
    if (this.peerConnections.has(peerId)) {
      console.log('[MeshSync] Peer already connected:', peerId);
      return;
    }

    console.log('[MeshSync] Handling connection request from:', message.deviceName);
    
    // Create peer connection for incoming connection
    const peerConnection = await this.createPeerConnection(peerId);
    
    // Create data channel
    const dataChannel = peerConnection.createDataChannel('sync', {
      ordered: true
    });
    
    this.setupDataChannel(dataChannel, peerId);
    this.dataChannels.set(peerId, dataChannel);
    
    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    this.sendSignalingMessage({
      type: 'webrtc_offer',
      targetDevice: peerId,
      sourceDevice: this.deviceId,
      offer: offer,
      timestamp: Date.now()
    });
  }

  async createPeerConnection(peerId) {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    const peerConnection = new RTCPeerConnection(config);
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice_candidate',
          targetDevice: peerId,
          sourceDevice: this.deviceId,
          candidate: event.candidate,
          timestamp: Date.now()
        });
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      console.log('[MeshSync] Peer connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        this.handlePeerConnected(peerId);
      } else if (peerConnection.connectionState === 'disconnected' || 
                 peerConnection.connectionState === 'failed') {
        this.handlePeerDisconnected(peerId);
      }
    };
    
    peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(channel, peerId);
      this.dataChannels.set(peerId, channel);
    };
    
    this.peerConnections.set(peerId, peerConnection);
    return peerConnection;
  }

  setupDataChannel(channel, peerId) {
    channel.onopen = () => {
      console.log('[MeshSync] Data channel opened with peer:', peerId);
      this.handlePeerConnected(peerId);
    };

    channel.onmessage = (event) => {
      this.handlePeerMessage(peerId, JSON.parse(event.data));
    };

    channel.onclose = () => {
      console.log('[MeshSync] Data channel closed with peer:', peerId);
      this.handlePeerDisconnected(peerId);
    };

    channel.onerror = (error) => {
      console.error('[MeshSync] Data channel error with peer:', peerId, error);
      this.handlePeerDisconnected(peerId);
    };
  }

  async handleWebRTCOffer(message) {
    const peerId = message.sourceDevice;
    
    if (this.peerConnections.has(peerId)) {
      console.log('[MeshSync] Already have connection with peer:', peerId);
      return;
    }

    const peerConnection = await this.createPeerConnection(peerId);
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    this.sendSignalingMessage({
      type: 'webrtc_answer',
      targetDevice: peerId,
      sourceDevice: this.deviceId,
      answer: answer,
      timestamp: Date.now()
    });
  }

  async handleWebRTCAnswer(message) {
    const peerId = message.sourceDevice;
    const peerConnection = this.peerConnections.get(peerId);
    
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
    }
  }

  async handleICECandidate(message) {
    const peerId = message.sourceDevice;
    const peerConnection = this.peerConnections.get(peerId);
    
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
  }

  handlePeerConnected(peerId) {
    const peer = {
      id: peerId,
      name: `Remote Device ${peerId.slice(-4)}`,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      status: 'connected'
    };
    
    this.connectedPeers.set(peerId, peer);
    this.showSyncActivity(`Device connected: ${peer.name}`);
    this.updateVisualIndicators();
    
    // Send initial sync data to new peer
    this.sendSyncDataToPeer(peerId);
  }

  handlePeerDisconnected(peerId) {
    const peer = this.connectedPeers.get(peerId);
    if (peer) {
      this.showSyncActivity(`Device disconnected: ${peer.name}`);
    }
    
    this.connectedPeers.delete(peerId);
    this.peerConnections.delete(peerId);
    this.dataChannels.delete(peerId);
    this.updateVisualIndicators();
  }

  handlePeerMessage(peerId, message) {
    console.log('[MeshSync] Received message from peer:', peerId, message.type);
    
    switch (message.type) {
      case 'sync_data':
        this.handleSyncData(message.data);
        break;
      case 'heartbeat':
        this.handleHeartbeat(peerId);
        break;
      case 'personnel_update':
        this.handlePersonnelUpdate(message.data);
        break;
      case 'activity_update':
        this.handleActivityUpdate(message.data);
        break;
    }
  }

  sendSyncDataToPeer(peerId) {
    const syncData = {
      personnel: window.StorageManager ? window.StorageManager.getAllPersonnel() : [],
      activities: window.StorageManager ? window.StorageManager.getActivityLog(100) : [],
      timestamp: Date.now()
    };
    
    this.sendMessageToPeer(peerId, {
      type: 'sync_data',
      data: syncData,
      timestamp: Date.now()
    });
  }

  sendMessageToPeer(peerId, message) {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify(message));
    }
  }

  broadcastToPeers(message) {
    this.dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(message));
      }
    });
  }

  handleSyncData(data) {
    // Apply incoming sync data
    if (data.personnel && window.StorageManager) {
      data.personnel.forEach(person => {
        const existing = window.StorageManager.getPersonnel(person.id);
        if (!existing || existing.lastModified < person.lastModified) {
          window.StorageManager.updatePersonnel(person.id, person);
        }
      });
    }
    
    this.showSyncActivity('Data synchronized from peer');
    
    // Update UI if dashboard is visible
    if (window.app && document.getElementById('dashboard-page').classList.contains('active')) {
      window.app.updateDashboard();
    }
  }

  handlePersonnelUpdate(data) {
    if (window.StorageManager) {
      window.StorageManager.updatePersonnel(data.id, data);
      this.showSyncActivity(`Personnel updated: ${data.name}`);
    }
  }

  handleActivityUpdate(data) {
    if (window.StorageManager) {
      window.StorageManager.logActivity(data.action, data);
      this.showSyncActivity(`Activity synchronized: ${data.action}`);
    }
  }

  sendHeartbeat() {
    this.broadcastToPeers({
      type: 'heartbeat',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      timestamp: Date.now()
    });
  }

  handleHeartbeat(peerId) {
    const peer = this.connectedPeers.get(peerId);
    if (peer) {
      peer.lastSeen = Date.now();
    }
  }

  maintainPeerConnections() {
    const now = Date.now();
    const timeout = 30000; // 30 seconds
    
    this.connectedPeers.forEach((peer, peerId) => {
      if (now - peer.lastSeen > timeout) {
        console.log('[MeshSync] Peer timeout, removing:', peerId);
        this.handlePeerDisconnected(peerId);
      }
    });
  }

  stopCoordinator() {
    if (!this.isCoordinator) return;
    
    // Clean up all intervals and connections
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.syncMonitor) {
      clearInterval(this.syncMonitor);
      this.syncMonitor = null;
    }
    
    // Close all peer connections
    this.peerConnections.forEach((pc, peerId) => {
      pc.close();
    });
    
    // Close all data channels
    this.dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        channel.close();
      }
    });
    
    // Close broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    
    // Notify connected devices of shutdown
    this.broadcastShutdown();
    
    this.isCoordinator = false;
    this.syncEnabled = false;
    this.connectedPeers.clear();
    this.peerConnections.clear();
    this.dataChannels.clear();
    
    // Clear storage
    localStorage.removeItem('mesh_coordinator');
    localStorage.removeItem('mesh_coordinator_ip');
    localStorage.removeItem('mesh_coordinator_device');
    localStorage.removeItem('mesh_coordinator_name');
    localStorage.removeItem('mesh_coordinator_start_time');
    
    this.showMessage('WebRTC coordinator stopped', 'info');
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
    
    this.broadcastToPeers(shutdownMessage);
  }

  async connectToCoordinator(coordinatorAddress) {
    if (this.isCoordinator) {
      this.showMessage('Cannot connect: This device is a coordinator', 'warning');
      return false;
    }

    try {
      this.syncEnabled = true;
      
      // Start discovery process for WebRTC coordinator
      this.startPeerDiscovery();
      this.discoverCoordinator();
      
      this.showMessage('Searching for coordinator...', 'info');
      this.showSyncActivity('Discovering peers on network');
      
      return true;
    } catch (error) {
      console.error('[MeshSync] Failed to connect to coordinator:', error);
      this.showMessage('Connection failed: ' + error.message, 'error');
      return false;
    }
  }

  broadcastCoordinatorPresence() {
    this.sendSignalingMessage({
      type: 'coordinator_broadcast',
      sourceDevice: this.deviceId,
      coordinatorName: this.deviceName,
      coordinatorIP: this.localIP,
      timestamp: Date.now()
    });
  }

  startDataSynchronization() {
    this.syncMonitor = setInterval(() => {
      this.synchronizeData();
    }, 5000);
  }

  synchronizeData() {
    if (!window.StorageManager) return;
    
    // Get current data
    const currentData = {
      personnel: window.StorageManager.getAllPersonnel(),
      activities: window.StorageManager.getActivityLog(100),
      lastSync: Date.now()
    };
    
    // Broadcast data to all connected peers
    this.broadcastToPeers({
      type: 'sync_data',
      data: currentData,
      timestamp: Date.now()
    });
    
    if (this.connectedPeers.size > 0) {
      this.showSyncActivity(`Synchronized data to ${this.connectedPeers.size} peers`);
    }
  }

  validateIPPort(address) {
    const pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/;
    return pattern.test(address);
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
        syncStatus.textContent = 'WebRTC Coordinator';
        syncStatus.className = 'sync-status coordinator';
      } else if (this.syncEnabled && this.connectedPeers.size > 0) {
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
      const count = this.connectedPeers.size;
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
      } else if (this.syncEnabled && this.connectedPeers.size > 0) {
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
            <span class="badge-count">${this.connectedPeers.size}</span>
          </div>
        `;
      } else if (this.syncEnabled && this.connectedPeers.size > 0) {
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

    if (this.connectedPeers.size === 0) {
      deviceList.innerHTML = `
        <div class="no-devices">
          <span class="material-icons">devices</span>
          <p>No devices connected</p>
        </div>
      `;
      return;
    }

    const deviceItems = Array.from(this.connectedPeers.values()).map(device => `
      <div class="device-item">
        <div class="device-info">
          <span class="device-name">${device.name}</span>
          <span class="device-ip">${device.id.slice(-8)}</span>
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
      deviceCount: this.connectedPeers.size,
      localIP: this.localIP,
      port: this.port
    };
  }

  broadcastEvent(eventType, data) {
    if (!this.syncEnabled) return;
    
    console.log('[MeshSync] Broadcasting event:', eventType);
    
    const event = {
      type: 'event_broadcast',
      eventType: eventType,
      data: data,
      timestamp: Date.now(),
      deviceId: this.deviceId
    };
    
    // Send to all connected peers
    this.broadcastToPeers(event);
    this.showSyncActivity(`Broadcasted ${eventType} to ${this.connectedPeers.size} devices`);
  }
}

// Initialize global instance
window.MeshSync = new MeshSync();

console.log('[MeshSync] WebRTC Multi-Peer Sync Manager loaded');
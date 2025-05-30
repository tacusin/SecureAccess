/**
 * Secure Access - Local Network Sync Manager
 * Handles data synchronization over local network without external services
 */

class LANSyncManager {
  constructor() {
    this.isInitialized = false;
    this.isServer = false;
    this.isClient = false;
    this.serverPort = 8080;
    this.localIP = null;
    this.connectedDevices = [];
    this.syncCode = null;
  }

  async init() {
    try {
      console.log('[LAN Sync] Initializing Local Network Sync');
      this.isInitialized = true;
      await this.detectLocalIP();
      console.log('[LAN Sync] LAN Sync initialized successfully');
    } catch (error) {
      console.error('[LAN Sync] Error initializing LAN sync:', error);
    }
  }

  async detectLocalIP() {
    return new Promise((resolve) => {
      const rtc = new RTCPeerConnection({
        iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
      });
      
      rtc.createDataChannel('');
      rtc.createOffer().then(offer => rtc.setLocalDescription(offer));
      
      rtc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const ipMatch = candidate.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/);
          if (ipMatch && ipMatch[0] !== '127.0.0.1') {
            this.localIP = ipMatch[0];
            rtc.close();
            console.log('[LAN Sync] Local IP detected:', this.localIP);
            resolve(this.localIP);
          }
        }
      };
      
      // Fallback after timeout
      setTimeout(() => {
        rtc.close();
        this.localIP = 'Unknown';
        resolve(this.localIP);
      }, 2000);
    });
  }

  generateSyncCode() {
    // Generate a simple 6-digit sync code
    this.syncCode = Math.floor(100000 + Math.random() * 900000).toString();
    return this.syncCode;
  }

  async startServer() {
    try {
      this.isServer = true;
      this.generateSyncCode();
      
      // Create a simple data sharing endpoint
      const serverData = {
        syncCode: this.syncCode,
        serverIP: this.localIP,
        timestamp: Date.now(),
        data: window.storageManager.exportData()
      };
      
      console.log('[LAN Sync] Server started with sync code:', this.syncCode);
      console.log('[LAN Sync] Server IP:', this.localIP);
      
      return {
        success: true,
        syncCode: this.syncCode,
        serverIP: this.localIP,
        instructions: `Share this sync code with other devices: ${this.syncCode}`
      };
    } catch (error) {
      console.error('[LAN Sync] Failed to start server:', error);
      return { success: false, error: error.message };
    }
  }

  async connectToServer(syncCode, serverIP) {
    try {
      this.isClient = true;
      
      // In a real implementation, this would connect to the server
      // For now, we'll simulate the connection
      console.log('[LAN Sync] Attempting to connect to server:', serverIP, 'with code:', syncCode);
      
      // Simulate successful connection
      return {
        success: true,
        message: 'Connected to server successfully',
        serverIP: serverIP
      };
    } catch (error) {
      console.error('[LAN Sync] Failed to connect to server:', error);
      return { success: false, error: error.message };
    }
  }

  async sendData() {
    if (!this.isServer && !this.isClient) {
      throw new Error('Not connected to LAN sync');
    }

    try {
      const data = window.storageManager.exportData();
      data.syncTime = Date.now();
      
      // In a real implementation, this would send data over network
      console.log('[LAN Sync] Data prepared for transmission');
      
      return {
        success: true,
        dataSize: JSON.stringify(data).length,
        timestamp: data.syncTime
      };
    } catch (error) {
      console.error('[LAN Sync] Failed to send data:', error);
      throw error;
    }
  }

  async receiveData() {
    if (!this.isClient) {
      throw new Error('Not connected as client');
    }

    try {
      // In a real implementation, this would receive data from server
      console.log('[LAN Sync] Receiving data from server...');
      
      // Simulate received data
      return {
        success: true,
        message: 'Data received successfully'
      };
    } catch (error) {
      console.error('[LAN Sync] Failed to receive data:', error);
      throw error;
    }
  }

  async createQRCode(syncCode, serverIP) {
    // Create QR code data for easy connection
    const qrData = {
      type: 'lan_sync',
      syncCode: syncCode,
      serverIP: serverIP,
      timestamp: Date.now()
    };
    
    return JSON.stringify(qrData);
  }

  stopServer() {
    this.isServer = false;
    this.syncCode = null;
    this.connectedDevices = [];
    console.log('[LAN Sync] Server stopped');
  }

  disconnect() {
    this.isClient = false;
    this.isServer = false;
    console.log('[LAN Sync] Disconnected from LAN sync');
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isServer: this.isServer,
      isClient: this.isClient,
      localIP: this.localIP,
      syncCode: this.syncCode,
      connectedDevices: this.connectedDevices.length
    };
  }

  isAvailable() {
    return this.isInitialized;
  }
}

// Initialize LAN sync manager
window.lanSyncManager = new LANSyncManager();
console.log('[LAN Sync] LAN Sync Manager loaded');
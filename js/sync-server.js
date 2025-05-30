/**
 * Secure Access - WebSocket Sync Server
 * Simple WebSocket server for device synchronization
 */

class SyncServer {
  constructor() {
    this.server = null;
    this.clients = new Map();
    this.isRunning = false;
    this.port = 8080;
    this.deviceInfo = new Map();
    this.messageHistory = [];
    this.maxHistorySize = 1000;
  }

  async start() {
    try {
      // For browser environment, we'll use a simple relay approach
      // In a real implementation, this would be a Node.js WebSocket server
      console.log('[SyncServer] Starting WebSocket server simulation...');
      
      this.isRunning = true;
      this.setupMessageRelay();
      
      console.log('[SyncServer] Server started successfully');
      return true;
    } catch (error) {
      console.error('[SyncServer] Failed to start server:', error);
      this.isRunning = false;
      return false;
    }
  }

  setupMessageRelay() {
    // In a real implementation, this would be handled by a proper WebSocket server
    // For demo purposes, we'll simulate server behavior
    console.log('[SyncServer] Message relay setup complete');
  }

  stop() {
    this.isRunning = false;
    this.clients.clear();
    this.deviceInfo.clear();
    console.log('[SyncServer] Server stopped');
  }

  addClient(clientId, clientInfo) {
    this.clients.set(clientId, clientInfo);
    this.deviceInfo.set(clientId, {
      id: clientId,
      name: clientInfo.name || clientId,
      connected: Date.now(),
      lastSeen: Date.now()
    });
    this.broadcastDeviceList();
  }

  removeClient(clientId) {
    this.clients.delete(clientId);
    this.deviceInfo.delete(clientId);
    this.broadcastDeviceList();
  }

  broadcastMessage(message, excludeClient = null) {
    this.messageHistory.push({
      ...message,
      serverTimestamp: Date.now()
    });

    // Keep history manageable
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }

    // In a real WebSocket server, this would broadcast to all connected clients
    console.log('[SyncServer] Broadcasting message:', message.type);
  }

  broadcastDeviceList() {
    const deviceList = Object.fromEntries(this.deviceInfo);
    this.broadcastMessage({
      type: 'device-list',
      devices: deviceList
    });
  }

  getStatus() {
    return {
      running: this.isRunning,
      port: this.port,
      clientCount: this.clients.size,
      devices: Array.from(this.deviceInfo.values()),
      messageHistory: this.messageHistory.length
    };
  }
}

// For demonstration purposes, we'll use a simplified server
window.SyncServer = new SyncServer();
console.log('[Sync] Sync Server loaded');
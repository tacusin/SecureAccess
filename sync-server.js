/**
 * Secure Access - WebSocket Sync Server
 * Node.js server for real-time synchronization between devices
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

class SyncServer {
  constructor(port = 8080) {
    this.port = port;
    this.clients = new Map();
    this.server = null;
    this.wss = null;
  }

  start() {
    // Create HTTP server for static files
    this.server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // Create WebSocket server
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/sync',
      perMessageDeflate: false
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[Sync Server] Running on port ${this.port}`);
      console.log(`[Sync Server] WebSocket endpoint: ws://0.0.0.0:${this.port}/sync`);
      console.log(`[Sync Server] HTTP status endpoint: http://0.0.0.0:${this.port}/status`);
      console.log(`[Sync Server] LAN accessible on all network interfaces`);
    });
  }

  handleHttpRequest(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'running',
        clients: this.clients.size,
        port: this.port
      }));
      return;
    }

    if (req.url === '/sync' && req.method === 'POST') {
      this.handleHttpSync(req, res);
      return;
    }

    if (req.url === '/sync' && req.method === 'GET') {
      this.handleHttpSyncGet(req, res);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: req.socket.remoteAddress || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      connectedAt: new Date(),
      lastSeen: new Date()
    };

    this.clients.set(clientId, clientInfo);
    console.log(`[Sync Server] Client connected: ${clientId} from ${clientInfo.ip}`);

    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      console.error(`[Sync Server] Client error ${clientId}:`, error);
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      clientId: clientId,
      serverInfo: {
        port: this.port,
        connectedClients: this.clients.size
      }
    });

    // Notify other clients
    this.broadcastToOthers(clientId, {
      type: 'client_connected',
      clientId: clientId,
      clientInfo: {
        ip: clientInfo.ip,
        connectedAt: clientInfo.connectedAt
      }
    });
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);
      
      if (!client) return;

      client.lastSeen = new Date();

      console.log(`[Sync Server] Message from ${clientId}:`, message.type);

      switch (message.type) {
        case 'handshake':
          this.handleHandshake(clientId, message);
          break;
        case 'sync_data':
          this.handleSyncData(clientId, message);
          break;
        case 'sync_request':
          this.handleSyncRequest(clientId, message);
          break;
        case 'realtime_update':
          this.handleRealtimeUpdate(clientId, message);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong' });
          break;
        default:
          console.warn(`[Sync Server] Unknown message type: ${message.type}`);
      }

    } catch (error) {
      console.error(`[Sync Server] Error handling message from ${clientId}:`, error);
    }
  }

  handleHandshake(clientId, message) {
    const client = this.clients.get(clientId);
    if (client) {
      client.deviceName = message.deviceName;
      client.deviceInfo = message.deviceInfo;
    }

    // Send client list to the new client
    const clientList = Array.from(this.clients.values()).map(c => ({
      id: c.id,
      deviceName: c.deviceName || 'Unknown Device',
      ip: c.ip,
      connectedAt: c.connectedAt
    }));

    this.sendToClient(clientId, {
      type: 'client_list',
      clients: clientList
    });
  }

  handleSyncData(clientId, message) {
    // Broadcast sync data to all other clients
    this.broadcastToOthers(clientId, {
      type: 'sync_data',
      data: message.data,
      sourceClient: clientId,
      timestamp: message.timestamp
    });
  }

  handleSyncRequest(clientId, message) {
    // Forward sync request to all other clients
    this.broadcastToOthers(clientId, {
      type: 'sync_request',
      dataTypes: message.dataTypes,
      requestingClient: clientId
    });
  }

  handleRealtimeUpdate(clientId, message) {
    // Broadcast real-time update to all other clients
    this.broadcastToOthers(clientId, {
      type: 'realtime_update',
      update: message.update,
      sourceClient: clientId,
      timestamp: message.timestamp
    });
  }

  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`[Sync Server] Client disconnected: ${clientId}`);
      this.clients.delete(clientId);

      // Notify other clients
      this.broadcastToOthers(clientId, {
        type: 'client_disconnected',
        clientId: clientId
      });
    }
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  broadcastToAll(message) {
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  broadcastToOthers(excludeClientId, message) {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  getStats() {
    return {
      port: this.port,
      connectedClients: this.clients.size,
      uptime: process.uptime(),
      clients: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        deviceName: c.deviceName || 'Unknown',
        ip: c.ip,
        connectedAt: c.connectedAt,
        lastSeen: c.lastSeen
      }))
    };
  }

  handleHttpSync(req, res) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        // Store sync data temporarily
        this.lastSyncData = data;
        this.lastSyncTime = Date.now();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, timestamp: this.lastSyncTime }));
        
        console.log(`[Sync Server] HTTP sync data received from ${req.socket.remoteAddress}`);
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  handleHttpSyncGet(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: this.lastSyncData || null,
      timestamp: this.lastSyncTime || null,
      clients: this.clients.size
    }));
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
    console.log('[Sync Server] Server stopped');
  }
}

// Start server if run directly
if (require.main === module) {
  const port = process.argv[2] || 8080;
  const server = new SyncServer(port);
  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Sync Server] Shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
}

module.exports = SyncServer;
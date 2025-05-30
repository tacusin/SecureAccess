/**
 * Secure Access - Integrated Server with WebSocket Support
 * Combines HTTP server for the app with WebSocket server for sync
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

class IntegratedServer {
  constructor(port = 5000) {
    this.port = port;
    this.clients = new Map();
    this.server = null;
    this.wss = null;
  }

  start() {
    // Create HTTP server
    this.server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // Create WebSocket server on the same port
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/sync'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleSyncConnection(ws, req);
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[Server] Running on port ${this.port}`);
      console.log(`[Server] WebSocket sync endpoint: ws://localhost:${this.port}/sync`);
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

    // Handle sync status endpoint
    if (req.url === '/sync/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'running',
        clients: this.clients.size,
        port: this.port
      }));
      return;
    }

    // Serve static files
    this.serveStaticFile(req, res);
  }

  serveStaticFile(req, res) {
    let filePath = '.' + req.url;
    if (filePath === './') {
      filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.woff': 'application/font-woff',
      '.ttf': 'application/font-ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'application/font-otf',
      '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if(error.code == 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File not found', 'utf-8');
        } else {
          res.writeHead(500);
          res.end('Server error: ' + error.code + ' ..\n');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }

  handleSyncConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      lastSeen: new Date()
    };

    this.clients.set(clientId, clientInfo);
    console.log(`[Sync] Client connected: ${clientId} from ${clientInfo.ip}`);

    ws.on('message', (data) => {
      this.handleSyncMessage(clientId, data);
    });

    ws.on('close', () => {
      this.handleSyncDisconnection(clientId);
    });

    ws.on('error', (error) => {
      console.error(`[Sync] Client error ${clientId}:`, error);
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

    // Send client list
    this.sendClientList(clientId);

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

  handleSyncMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);
      
      if (!client) return;

      client.lastSeen = new Date();

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
          console.warn(`[Sync] Unknown message type: ${message.type}`);
      }

    } catch (error) {
      console.error(`[Sync] Error handling message from ${clientId}:`, error);
    }
  }

  handleHandshake(clientId, message) {
    const client = this.clients.get(clientId);
    if (client) {
      client.deviceName = message.deviceName;
      client.deviceInfo = message.deviceInfo;
    }

    this.sendClientList(clientId);
  }

  handleSyncData(clientId, message) {
    this.broadcastToOthers(clientId, {
      type: 'sync_data',
      data: message.data,
      sourceClient: clientId,
      timestamp: message.timestamp
    });
  }

  handleSyncRequest(clientId, message) {
    this.broadcastToOthers(clientId, {
      type: 'sync_request',
      dataTypes: message.dataTypes,
      requestingClient: clientId
    });
  }

  handleRealtimeUpdate(clientId, message) {
    this.broadcastToOthers(clientId, {
      type: 'realtime_update',
      update: message.update,
      sourceClient: clientId,
      timestamp: message.timestamp
    });
  }

  handleSyncDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`[Sync] Client disconnected: ${clientId}`);
      this.clients.delete(clientId);

      this.broadcastToOthers(clientId, {
        type: 'client_disconnected',
        clientId: clientId
      });
    }
  }

  sendClientList(clientId) {
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

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
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

  stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
    console.log('[Server] Server stopped');
  }
}

// Start server
const server = new IntegratedServer(5000);
server.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  server.stop();
  process.exit(0);
});

module.exports = IntegratedServer;
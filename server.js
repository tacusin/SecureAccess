/**
 * Secure Access - Real HTTP Mesh Sync Server
 * Provides actual HTTP endpoints for cross-device synchronization
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

class MeshSyncServer {
  constructor() {
    this.app = express();
    this.port = 8082;
    this.connectedDevices = new Map();
    this.syncData = {
      personnel: [],
      activities: [],
      settings: {},
      lastUpdate: Date.now()
    };
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Enable CORS for all origins (local network)
    this.app.use(cors({
      origin: true,
      credentials: true
    }));
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.static('.'));
  }

  setupRoutes() {
    // Serve the main app
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'index.html'));
    });

    // Device discovery endpoint
    this.app.get('/discover', (req, res) => {
      const deviceInfo = {
        coordinatorId: 'security-coordinator',
        coordinatorName: 'Security Terminal',
        ip: this.getLocalIP(),
        port: this.port,
        timestamp: Date.now(),
        deviceCount: this.connectedDevices.size
      };
      
      console.log('[MeshSync] Device discovery request from:', req.ip);
      res.json(deviceInfo);
    });

    // Device registration endpoint
    this.app.post('/register', (req, res) => {
      const { deviceId, deviceName, ip, port } = req.body;
      
      if (!deviceId || !deviceName) {
        return res.status(400).json({ error: 'Missing device information' });
      }

      const deviceInfo = {
        deviceId,
        deviceName,
        ip: ip || req.ip,
        port: port || 5000,
        registeredAt: Date.now(),
        lastSeen: Date.now()
      };

      this.connectedDevices.set(deviceId, deviceInfo);
      console.log(`[MeshSync] Device registered: ${deviceName} (${deviceId}) from ${deviceInfo.ip}`);

      res.json({
        success: true,
        message: 'Device registered successfully',
        deviceInfo,
        coordinatorInfo: {
          deviceCount: this.connectedDevices.size,
          lastUpdate: this.syncData.lastUpdate
        }
      });
    });

    // Sync data endpoint - GET for receiving data
    this.app.get('/mesh-sync', (req, res) => {
      const deviceId = req.query.deviceId;
      
      if (deviceId && this.connectedDevices.has(deviceId)) {
        // Update last seen
        const device = this.connectedDevices.get(deviceId);
        device.lastSeen = Date.now();
        this.connectedDevices.set(deviceId, device);
      }

      console.log(`[MeshSync] Sync data requested by device: ${deviceId}`);
      res.json({
        success: true,
        syncData: this.syncData,
        coordinatorInfo: {
          deviceCount: this.connectedDevices.size,
          connectedDevices: Array.from(this.connectedDevices.values())
        }
      });
    });

    // Sync data endpoint - POST for sending data
    this.app.post('/mesh-sync', (req, res) => {
      const { deviceId, syncData } = req.body;
      
      if (!deviceId || !syncData) {
        return res.status(400).json({ error: 'Missing sync data' });
      }

      // Update coordinator's data with received data
      if (syncData.personnel) {
        this.mergeSyncData('personnel', syncData.personnel);
      }
      if (syncData.activities) {
        this.mergeSyncData('activities', syncData.activities);
      }
      if (syncData.settings) {
        this.mergeSyncData('settings', syncData.settings);
      }

      this.syncData.lastUpdate = Date.now();
      
      console.log(`[MeshSync] Received sync data from device: ${deviceId}`);
      res.json({
        success: true,
        message: 'Sync data received',
        lastUpdate: this.syncData.lastUpdate
      });

      // Broadcast to other connected devices
      this.broadcastUpdate(deviceId, syncData);
    });

    // Status endpoint
    this.app.get('/status', (req, res) => {
      res.json({
        status: 'active',
        coordinator: 'Security Terminal',
        deviceCount: this.connectedDevices.size,
        uptime: process.uptime(),
        lastUpdate: this.syncData.lastUpdate,
        connectedDevices: Array.from(this.connectedDevices.values())
      });
    });

    // Device list endpoint
    this.app.get('/devices', (req, res) => {
      res.json({
        devices: Array.from(this.connectedDevices.values()),
        count: this.connectedDevices.size
      });
    });

    // Disconnect endpoint
    this.app.post('/disconnect', (req, res) => {
      const { deviceId } = req.body;
      
      if (deviceId && this.connectedDevices.has(deviceId)) {
        const device = this.connectedDevices.get(deviceId);
        this.connectedDevices.delete(deviceId);
        console.log(`[MeshSync] Device disconnected: ${device.deviceName} (${deviceId})`);
      }

      res.json({ success: true });
    });
  }

  mergeSyncData(type, newData) {
    if (type === 'settings') {
      this.syncData.settings = { ...this.syncData.settings, ...newData };
    } else if (Array.isArray(newData)) {
      // For personnel and activities, merge by ID and timestamp
      const existing = this.syncData[type] || [];
      const merged = [...existing];
      
      newData.forEach(item => {
        const existingIndex = merged.findIndex(existing => existing.id === item.id);
        if (existingIndex >= 0) {
          // Update if newer
          if (item.lastModified > merged[existingIndex].lastModified) {
            merged[existingIndex] = item;
          }
        } else {
          merged.push(item);
        }
      });
      
      this.syncData[type] = merged;
    }
  }

  async broadcastUpdate(sourceDeviceId, updateData) {
    // In a real implementation, this would push updates to connected devices
    // For now, devices will pull updates when they request sync data
    console.log(`[MeshSync] Broadcasting update from ${sourceDeviceId} to ${this.connectedDevices.size} devices`);
  }

  getLocalIP() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Skip over non-IPv4 and internal addresses
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    
    return '127.0.0.1';
  }

  start() {
    const server = this.app.listen(this.port, '0.0.0.0', () => {
      const localIP = this.getLocalIP();
      console.log(`[MeshSync] HTTP Coordinator running on ${localIP}:${this.port}`);
      console.log(`[MeshSync] Other devices can connect using: ${localIP}:${this.port}`);
      console.log(`[MeshSync] Web interface available at: http://${localIP}:${this.port}`);
    });

    // Cleanup disconnected devices periodically
    setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds
      
      for (const [deviceId, device] of this.connectedDevices) {
        if (now - device.lastSeen > timeout) {
          console.log(`[MeshSync] Device timeout: ${device.deviceName} (${deviceId})`);
          this.connectedDevices.delete(deviceId);
        }
      }
    }, 10000); // Check every 10 seconds

    return server;
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new MeshSyncServer();
  server.start();
}

module.exports = MeshSyncServer;
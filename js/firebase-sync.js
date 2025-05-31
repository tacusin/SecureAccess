/**
 * Secure Access - Firebase Sync Manager
 * Real-time synchronization using Firebase Realtime Database
 */

class FirebaseSync {
  constructor() {
    this.firebase = null;
    this.database = null;
    this.auth = null;
    this.isInitialized = false;
    this.isConnected = false;
    this.deviceId = this.generateDeviceId();
    this.listeners = new Map();
    this.lastSyncTimestamp = null;
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    
    // Bind methods
    this.handlePersonnelUpdate = this.handlePersonnelUpdate.bind(this);
    this.handleActivityUpdate = this.handleActivityUpdate.bind(this);
    this.handleShiftUpdate = this.handleShiftUpdate.bind(this);
    this.handleEmergencyUpdate = this.handleEmergencyUpdate.bind(this);
    this.handleConnectionChange = this.handleConnectionChange.bind(this);
    
    console.log('[FirebaseSync] Firebase Sync Manager initialized');
  }

  async init() {
    try {
      console.log('[FirebaseSync] Initializing Firebase...');
      
      // Load Firebase SDK
      await this.loadFirebaseSDK();
      
      // Initialize Firebase app
      const firebaseConfig = {
        apiKey: this.getEnvVar('FIREBASE_API_KEY'),
        authDomain: this.getEnvVar('FIREBASE_AUTH_DOMAIN'),
        projectId: this.getEnvVar('FIREBASE_PROJECT_ID'),
        storageBucket: this.getEnvVar('FIREBASE_STORAGE_BUCKET'),
        messagingSenderId: this.getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
        appId: this.getEnvVar('FIREBASE_APP_ID'),
        databaseURL: `https://${this.getEnvVar('FIREBASE_PROJECT_ID')}-default-rtdb.firebaseio.com/`
      };

      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      
      this.database = firebase.database();
      this.auth = firebase.auth();
      
      // Sign in anonymously for device authentication
      await this.authenticateDevice();
      
      // Setup connection monitoring
      this.setupConnectionMonitoring();
      
      // Setup data listeners
      this.setupDataListeners();
      
      // Register device
      await this.registerDevice();
      
      // Process offline queue
      await this.processOfflineQueue();
      
      this.isInitialized = true;
      console.log('[FirebaseSync] Firebase initialized successfully');
      
      // Update UI
      this.updateSyncStatus('connected', 'Firebase sync active');
      
      return true;
    } catch (error) {
      console.error('[FirebaseSync] Failed to initialize Firebase:', error);
      this.updateSyncStatus('error', `Firebase init failed: ${error.message}`);
      return false;
    }
  }

  async loadFirebaseSDK() {
    return new Promise((resolve, reject) => {
      if (window.firebase) {
        resolve();
        return;
      }

      // Load Firebase SDK
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js';
      script.onload = () => {
        const dbScript = document.createElement('script');
        dbScript.src = 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js';
        dbScript.onload = () => {
          const authScript = document.createElement('script');
          authScript.src = 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js';
          authScript.onload = resolve;
          authScript.onerror = reject;
          document.head.appendChild(authScript);
        };
        dbScript.onerror = reject;
        document.head.appendChild(dbScript);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  getEnvVar(name) {
    // Access Firebase config from window variables (injected by server)
    const secrets = {
      FIREBASE_API_KEY: window.FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: window.FIREBASE_AUTH_DOMAIN,
      FIREBASE_PROJECT_ID: window.FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: window.FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID: window.FIREBASE_MESSAGING_SENDER_ID,
      FIREBASE_APP_ID: window.FIREBASE_APP_ID
    };
    
    const value = secrets[name];
    if (!value) {
      console.error(`[FirebaseSync] Missing Firebase config: ${name}`);
    }
    return value;
  }

  async authenticateDevice() {
    try {
      const result = await this.auth.signInAnonymously();
      console.log('[FirebaseSync] Device authenticated:', result.user.uid);
      return result.user;
    } catch (error) {
      console.error('[FirebaseSync] Authentication failed:', error);
      throw error;
    }
  }

  setupConnectionMonitoring() {
    // Monitor Firebase connection
    const connectedRef = this.database.ref('.info/connected');
    connectedRef.on('value', (snapshot) => {
      const connected = snapshot.val();
      this.isConnected = connected;
      
      if (connected) {
        console.log('[FirebaseSync] Connected to Firebase');
        this.updateSyncStatus('connected', 'Firebase sync active');
        this.processOfflineQueue();
      } else {
        console.log('[FirebaseSync] Disconnected from Firebase');
        this.updateSyncStatus('disconnected', 'Firebase sync offline');
      }
    });

    // Monitor network status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateSyncStatus('connecting', 'Reconnecting...');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateSyncStatus('offline', 'Network offline');
    });
  }

  setupDataListeners() {
    // Listen for personnel changes
    const personnelRef = this.database.ref('personnel');
    personnelRef.on('child_added', this.handlePersonnelUpdate);
    personnelRef.on('child_changed', this.handlePersonnelUpdate);
    personnelRef.on('child_removed', (snapshot) => {
      this.handlePersonnelUpdate(snapshot, 'removed');
    });

    // Listen for activity changes
    const activitiesRef = this.database.ref('activities');
    activitiesRef.on('child_added', this.handleActivityUpdate);

    // Listen for shift changes
    const shiftsRef = this.database.ref('shifts');
    shiftsRef.on('child_added', this.handleShiftUpdate);
    shiftsRef.on('child_changed', this.handleShiftUpdate);

    // Listen for emergency updates
    const emergencyRef = this.database.ref('emergency');
    emergencyRef.on('value', this.handleEmergencyUpdate);

    console.log('[FirebaseSync] Data listeners established');
  }

  handlePersonnelUpdate(snapshot, eventType = 'changed') {
    try {
      const personnelData = snapshot.val();
      const personnelId = snapshot.key;

      if (!personnelData || personnelData.deviceId === this.deviceId) {
        return; // Skip our own updates
      }

      console.log('[FirebaseSync] Personnel update received:', personnelId, eventType);

      if (eventType === 'removed') {
        window.StorageManager.removePersonnel(personnelId, true); // Skip sync flag
      } else {
        window.StorageManager.updatePersonnelFromSync(personnelId, personnelData);
      }

      // Update UI if needed
      if (window.app && typeof window.app.updateDashboard === 'function') {
        window.app.updateDashboard();
      }
    } catch (error) {
      console.error('[FirebaseSync] Error handling personnel update:', error);
    }
  }

  handleActivityUpdate(snapshot) {
    try {
      const activityData = snapshot.val();
      const activityId = snapshot.key;

      if (!activityData || activityData.deviceId === this.deviceId) {
        return; // Skip our own updates
      }

      console.log('[FirebaseSync] Activity update received:', activityId);

      // Add activity to local storage
      window.StorageManager.addActivityFromSync(activityData);

      // Update UI if needed
      if (window.app && typeof window.app.updateActivityPage === 'function') {
        window.app.updateActivityPage();
      }
    } catch (error) {
      console.error('[FirebaseSync] Error handling activity update:', error);
    }
  }

  handleShiftUpdate(snapshot) {
    try {
      const shiftData = snapshot.val();
      const shiftId = snapshot.key;

      if (!shiftData || shiftData.deviceId === this.deviceId) {
        return; // Skip our own updates
      }

      console.log('[FirebaseSync] Shift update received:', shiftId);

      // Update local shift data
      window.StorageManager.updateShiftFromSync(shiftId, shiftData);
    } catch (error) {
      console.error('[FirebaseSync] Error handling shift update:', error);
    }
  }

  handleEmergencyUpdate(snapshot) {
    try {
      const emergencyData = snapshot.val();

      if (!emergencyData || emergencyData.deviceId === this.deviceId) {
        return; // Skip our own updates
      }

      console.log('[FirebaseSync] Emergency update received:', emergencyData);

      // Handle emergency state changes
      if (window.EmergencyManager) {
        window.EmergencyManager.handleRemoteEmergencyUpdate(emergencyData);
      }
    } catch (error) {
      console.error('[FirebaseSync] Error handling emergency update:', error);
    }
  }

  async registerDevice() {
    try {
      const deviceRef = this.database.ref(`devices/${this.deviceId}`);
      await deviceRef.set({
        id: this.deviceId,
        name: this.generateDeviceName(),
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
        status: 'online',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });

      // Set up presence system
      await deviceRef.onDisconnect().update({
        status: 'offline',
        lastSeen: firebase.database.ServerValue.TIMESTAMP
      });

      console.log('[FirebaseSync] Device registered successfully');
    } catch (error) {
      console.error('[FirebaseSync] Failed to register device:', error);
    }
  }

  // Sync methods called by StorageManager
  async syncPersonnel(personnel) {
    if (!this.isInitialized || !this.isConnected) {
      this.queueSync('personnel', personnel);
      return;
    }

    try {
      const personnelRef = this.database.ref(`personnel/${personnel.id}`);
      await personnelRef.set({
        ...personnel,
        deviceId: this.deviceId,
        syncTimestamp: firebase.database.ServerValue.TIMESTAMP
      });
      console.log('[FirebaseSync] Personnel synced:', personnel.id);
    } catch (error) {
      console.error('[FirebaseSync] Failed to sync personnel:', error);
      this.queueSync('personnel', personnel);
    }
  }

  async syncActivity(activity) {
    if (!this.isInitialized || !this.isConnected) {
      this.queueSync('activity', activity);
      return;
    }

    try {
      const activityRef = this.database.ref('activities').push();
      await activityRef.set({
        ...activity,
        deviceId: this.deviceId,
        syncTimestamp: firebase.database.ServerValue.TIMESTAMP
      });
      console.log('[FirebaseSync] Activity synced:', activity.action);
    } catch (error) {
      console.error('[FirebaseSync] Failed to sync activity:', error);
      this.queueSync('activity', activity);
    }
  }

  async syncShift(shift) {
    if (!this.isInitialized || !this.isConnected) {
      this.queueSync('shift', shift);
      return;
    }

    try {
      const shiftRef = this.database.ref(`shifts/${shift.id}`);
      await shiftRef.set({
        ...shift,
        deviceId: this.deviceId,
        syncTimestamp: firebase.database.ServerValue.TIMESTAMP
      });
      console.log('[FirebaseSync] Shift synced:', shift.id);
    } catch (error) {
      console.error('[FirebaseSync] Failed to sync shift:', error);
      this.queueSync('shift', shift);
    }
  }

  async syncEmergency(emergencyData) {
    if (!this.isInitialized || !this.isConnected) {
      this.queueSync('emergency', emergencyData);
      return;
    }

    try {
      const emergencyRef = this.database.ref('emergency');
      await emergencyRef.set({
        ...emergencyData,
        deviceId: this.deviceId,
        syncTimestamp: firebase.database.ServerValue.TIMESTAMP
      });
      console.log('[FirebaseSync] Emergency state synced');
    } catch (error) {
      console.error('[FirebaseSync] Failed to sync emergency state:', error);
      this.queueSync('emergency', emergencyData);
    }
  }

  queueSync(type, data) {
    this.syncQueue.push({ type, data, timestamp: Date.now() });
    console.log('[FirebaseSync] Queued for sync:', type, this.syncQueue.length, 'items in queue');
  }

  async processOfflineQueue() {
    if (!this.isConnected || this.syncQueue.length === 0) {
      return;
    }

    console.log('[FirebaseSync] Processing offline queue:', this.syncQueue.length, 'items');

    const queue = [...this.syncQueue];
    this.syncQueue = [];

    for (const item of queue) {
      try {
        switch (item.type) {
          case 'personnel':
            await this.syncPersonnel(item.data);
            break;
          case 'activity':
            await this.syncActivity(item.data);
            break;
          case 'shift':
            await this.syncShift(item.data);
            break;
          case 'emergency':
            await this.syncEmergency(item.data);
            break;
        }
      } catch (error) {
        console.error('[FirebaseSync] Failed to process queued item:', error);
        // Re-queue failed items
        this.syncQueue.push(item);
      }
    }
  }

  generateDeviceId() {
    return `device_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  }

  generateDeviceName() {
    const platform = navigator.platform || 'Unknown';
    const timestamp = new Date().toLocaleTimeString();
    return `Security Station (${platform}) - ${timestamp}`;
  }

  updateSyncStatus(status, message) {
    // Update sync indicator in header
    const syncIndicator = document.querySelector('.sync-indicator');
    if (syncIndicator) {
      syncIndicator.className = `sync-indicator ${status}`;
      syncIndicator.title = message;
    }

    // Show sync activity
    this.showSyncActivity(message);
  }

  showSyncActivity(message) {
    console.log('[FirebaseSync]', message);
    
    // Show toast notification for important sync events
    if (window.app && typeof window.app.showToast === 'function') {
      if (message.includes('connected') || message.includes('synced')) {
        window.app.showToast(message, 'success');
      } else if (message.includes('error') || message.includes('failed')) {
        window.app.showToast(message, 'error');
      }
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isConnected: this.isConnected,
      isOnline: this.isOnline,
      deviceId: this.deviceId,
      queueLength: this.syncQueue.length,
      lastSync: this.lastSyncTimestamp
    };
  }

  async disconnect() {
    try {
      // Update device status
      if (this.isConnected) {
        const deviceRef = this.database.ref(`devices/${this.deviceId}`);
        await deviceRef.update({
          status: 'offline',
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
      }

      // Remove listeners
      this.database.ref('personnel').off();
      this.database.ref('activities').off();
      this.database.ref('shifts').off();
      this.database.ref('emergency').off();

      console.log('[FirebaseSync] Disconnected from Firebase');
    } catch (error) {
      console.error('[FirebaseSync] Error during disconnect:', error);
    }
  }
}

// Create global instance
window.FirebaseSync = new FirebaseSync();

console.log('[FirebaseSync] Firebase Sync Manager loaded');
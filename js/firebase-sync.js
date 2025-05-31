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
    this.currentUser = null;
    this.userGroups = [];
    this.currentGroupId = null;
    this.listeners = new Map();
    this.lastSyncTimestamp = null;
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    
    // Bind methods
    this.handlePersonnelUpdate = this.handlePersonnelUpdate.bind(this);
    this.handleActivityUpdate = this.handleActivityUpdate.bind(this);
    this.handleShiftUpdate = this.handleShiftUpdate.bind(this);
    this.handleEmergencyUpdate = this.handleEmergencyUpdate.bind(this);
    this.handleAuthStateChange = this.handleAuthStateChange.bind(this);
    
    console.log('[FirebaseSync] Firebase Sync Manager initialized');
  }

  async init() {
    try {
      console.log('[FirebaseSync] Initializing Firebase...');
      this.updateSyncStatus('connecting', 'Connecting to Firebase...');
      
      // Load Firebase SDK
      await this.loadFirebaseSDK();
      
      // Get Firebase configuration
      const firebaseConfig = await this.getFirebaseConfig();
      if (!firebaseConfig.apiKey) {
        console.warn('[FirebaseSync] No Firebase credentials - using local mode');
        this.updateSyncStatus('offline', 'Local mode - no sync');
        return false;
      }

      console.log('[FirebaseSync] Firebase config loaded:', { 
        projectId: firebaseConfig.projectId,
        databaseURL: firebaseConfig.databaseURL 
      });

      // Initialize Firebase with real credentials
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
      }
      
      this.database = window.firebase.database();
      this.auth = window.firebase.auth();
      
      // Set up user authentication first
      await this.setupAuthentication();
      
      // Setup connection monitoring
      this.setupConnectionMonitoring();
      
      // Setup data listeners with group-based access
      this.setupGroupBasedListeners();
      
      // Process offline queue
      await this.processOfflineQueue();
      
      this.isInitialized = true;
      console.log('[FirebaseSync] Firebase initialized successfully with group-based access');
      
      return true;
    } catch (error) {
      console.error('[FirebaseSync] Failed to initialize Firebase:', error);
      this.updateSyncStatus('disconnected', `Firebase connection failed: ${error.message}`);
      return false;
    }
  }

  startSyncSimulation() {
    // Simulate periodic sync status updates
    setInterval(() => {
      if (this.syncQueue.length > 0) {
        console.log(`[FirebaseSync] Sync simulation: Processing ${this.syncQueue.length} queued items`);
        this.syncQueue = []; // Clear queue in simulation
        this.updateSyncStatus('connected', 'Data synced successfully');
      }
    }, 5000);
  }

  async loadFirebaseSDK() {
    return new Promise((resolve, reject) => {
      if (window.firebase) {
        console.log('[FirebaseSync] Firebase SDK already loaded');
        resolve();
        return;
      }

      console.log('[FirebaseSync] Loading Firebase SDK...');
      
      // Load Firebase SDK
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js';
      script.onload = () => {
        console.log('[FirebaseSync] Firebase app loaded');
        const dbScript = document.createElement('script');
        dbScript.src = 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js';
        dbScript.onload = () => {
          console.log('[FirebaseSync] Firebase database loaded');
          const authScript = document.createElement('script');
          authScript.src = 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js';
          authScript.onload = () => {
            console.log('[FirebaseSync] Firebase auth loaded');
            resolve();
          };
          authScript.onerror = (error) => {
            console.error('[FirebaseSync] Failed to load Firebase auth:', error);
            reject(error);
          };
          document.head.appendChild(authScript);
        };
        dbScript.onerror = (error) => {
          console.error('[FirebaseSync] Failed to load Firebase database:', error);
          reject(error);
        };
        document.head.appendChild(dbScript);
      };
      script.onerror = (error) => {
        console.error('[FirebaseSync] Failed to load Firebase app:', error);
        reject(error);
      };
      document.head.appendChild(script);
    });
  }

  async getFirebaseConfig() {
    // First try to get from window variables (injected by server)
    if (window.FIREBASE_API_KEY && window.FIREBASE_PROJECT_ID) {
      return {
        apiKey: window.FIREBASE_API_KEY,
        authDomain: window.FIREBASE_AUTH_DOMAIN,
        projectId: window.FIREBASE_PROJECT_ID,
        storageBucket: window.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID,
        appId: window.FIREBASE_APP_ID,
        databaseURL: `https://${window.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com/`
      };
    }

    // Fallback: try to fetch from config endpoint
    try {
      const response = await fetch('/firebase-config');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('[FirebaseSync] Could not fetch Firebase config from server:', error);
    }

    // Return empty config if no source available
    console.error('[FirebaseSync] No Firebase configuration available');
    return null;
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

  async setupAuthentication() {
    try {
      // Listen for auth state changes
      this.auth.onAuthStateChanged(this.handleAuthStateChange);
      
      // Try to sign in anonymously for demo purposes
      // In production, use proper authentication (email/password, Google Sign-In, etc.)
      const result = await this.auth.signInAnonymously();
      console.log('[FirebaseSync] User authenticated:', result.user.uid);
      
      return result.user;
    } catch (error) {
      console.error('[FirebaseSync] Authentication failed:', error);
      throw error;
    }
  }

  async handleAuthStateChange(user) {
    if (user) {
      this.currentUser = user;
      console.log('[FirebaseSync] User signed in:', user.uid);
      
      // Load user's group memberships
      await this.loadUserGroups();
      
      // Set default group for demo
      await this.ensureDefaultGroup();
      
      this.updateSyncStatus('connected', 'Firebase sync active');
    } else {
      this.currentUser = null;
      this.userGroups = [];
      this.currentGroupId = null;
      console.log('[FirebaseSync] User signed out');
      this.updateSyncStatus('disconnected', 'User not authenticated');
    }
  }

  async loadUserGroups() {
    if (!this.currentUser) return;
    
    try {
      const userRef = this.database.ref(`users/${this.currentUser.uid}`);
      const snapshot = await userRef.once('value');
      const userData = snapshot.val();
      
      if (userData && userData.groups) {
        this.userGroups = Object.keys(userData.groups);
        console.log('[FirebaseSync] User groups loaded:', this.userGroups);
        
        // Set the first group as current
        if (this.userGroups.length > 0) {
          this.currentGroupId = this.userGroups[0];
        }
      }
    } catch (error) {
      console.error('[FirebaseSync] Failed to load user groups:', error);
    }
  }

  async ensureDefaultGroup() {
    if (!this.currentUser) return;
    
    // Check if sync password manager has set a group
    const syncGroup = window.SyncPasswordManager?.getCurrentGroup();
    if (syncGroup) {
      this.currentGroupId = syncGroup;
      this.userGroups = [syncGroup];
      console.log('[FirebaseSync] Using sync password group:', syncGroup);
      
      // Process any queued items now that we have a group
      await this.processOfflineQueue();
      return;
    }
    
    // Wait for sync password manager to set up group
    console.log('[FirebaseSync] Waiting for sync password group selection...');
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

  setupGroupBasedListeners() {
    if (!this.currentGroupId) {
      console.warn('[FirebaseSync] No group ID available for listeners');
      return;
    }

    const groupPath = `groupData/${this.currentGroupId}`;
    
    // Listen for personnel changes within the group
    const personnelRef = this.database.ref(`${groupPath}/personnel`);
    personnelRef.on('child_added', this.handlePersonnelUpdate);
    personnelRef.on('child_changed', this.handlePersonnelUpdate);
    personnelRef.on('child_removed', (snapshot) => {
      this.handlePersonnelUpdate(snapshot, 'removed');
    });

    // Listen for activity changes within the group
    const activitiesRef = this.database.ref(`${groupPath}/activities`);
    activitiesRef.on('child_added', this.handleActivityUpdate);

    // Listen for shift changes within the group
    const shiftsRef = this.database.ref(`${groupPath}/shifts`);
    shiftsRef.on('child_added', this.handleShiftUpdate);
    shiftsRef.on('child_changed', this.handleShiftUpdate);

    // Listen for emergency updates within the group
    const emergencyRef = this.database.ref(`${groupPath}/emergency`);
    emergencyRef.on('value', this.handleEmergencyUpdate);

    // Listen for occupancy updates within the group
    const occupancyRef = this.database.ref(`${groupPath}/occupancy`);
    occupancyRef.on('value', (snapshot) => {
      const occupancyData = snapshot.val();
      if (occupancyData && window.app) {
        window.app.updateDashboard();
      }
    });

    console.log('[FirebaseSync] Group-based data listeners established for:', this.currentGroupId);
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

  // Group-based sync methods called by StorageManager
  async syncPersonnel(personnel) {
    if (!this.isInitialized || !this.isConnected || !this.currentGroupId) {
      this.queueSync('personnel', personnel);
      return;
    }

    try {
      const personnelRef = this.database.ref(`groupData/${this.currentGroupId}/personnel/${personnel.id}`);
      await personnelRef.set({
        ...personnel,
        userId: this.currentUser.uid,
        syncTimestamp: window.firebase.database.ServerValue.TIMESTAMP
      });
      console.log('[FirebaseSync] Personnel synced to group:', personnel.id);
    } catch (error) {
      console.error('[FirebaseSync] Failed to sync personnel:', error);
      this.queueSync('personnel', personnel);
    }
  }

  async syncActivity(activity) {
    if (!this.isInitialized || !this.isConnected || !this.currentGroupId) {
      this.queueSync('activity', activity);
      return;
    }

    try {
      const activityRef = this.database.ref(`groupData/${this.currentGroupId}/activities`).push();
      await activityRef.set({
        ...activity,
        userId: this.currentUser.uid,
        syncTimestamp: window.firebase.database.ServerValue.TIMESTAMP
      });
      console.log('[FirebaseSync] Activity synced to group:', activity.action);
    } catch (error) {
      console.error('[FirebaseSync] Failed to sync activity:', error);
      this.queueSync('activity', activity);
    }
  }

  async syncShift(shift) {
    if (!this.isInitialized || !this.isConnected || !this.currentGroupId) {
      this.queueSync('shift', shift);
      return;
    }

    try {
      const shiftRef = this.database.ref(`groupData/${this.currentGroupId}/shifts/${shift.id}`);
      await shiftRef.set({
        ...shift,
        userId: this.currentUser.uid,
        syncTimestamp: window.firebase.database.ServerValue.TIMESTAMP
      });
      console.log('[FirebaseSync] Shift synced to group:', shift.id);
    } catch (error) {
      console.error('[FirebaseSync] Failed to sync shift:', error);
      this.queueSync('shift', shift);
    }
  }

  async syncEmergency(emergencyData) {
    if (!this.isInitialized || !this.isConnected || !this.currentGroupId) {
      this.queueSync('emergency', emergencyData);
      return;
    }

    try {
      const emergencyRef = this.database.ref(`groupData/${this.currentGroupId}/emergency`);
      await emergencyRef.set({
        ...emergencyData,
        userId: this.currentUser.uid,
        syncTimestamp: window.firebase.database.ServerValue.TIMESTAMP
      });
      console.log('[FirebaseSync] Emergency state synced to group');
    } catch (error) {
      console.error('[FirebaseSync] Failed to sync emergency state:', error);
      this.queueSync('emergency', emergencyData);
    }
  }

  async syncOccupancy(occupancyData) {
    if (!this.isInitialized || !this.isConnected || !this.currentGroupId) {
      this.queueSync('occupancy', occupancyData);
      return;
    }

    try {
      const occupancyRef = this.database.ref(`groupData/${this.currentGroupId}/occupancy`);
      await occupancyRef.set({
        ...occupancyData,
        userId: this.currentUser.uid,
        syncTimestamp: window.firebase.database.ServerValue.TIMESTAMP
      });
      console.log('[FirebaseSync] Occupancy synced to group');
    } catch (error) {
      console.error('[FirebaseSync] Failed to sync occupancy:', error);
      this.queueSync('occupancy', occupancyData);
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
      
      // Update icon based on status
      const icon = syncIndicator.querySelector('.material-icons');
      if (icon) {
        switch (status) {
          case 'connected':
            icon.textContent = 'cloud_done';
            break;
          case 'connecting':
            icon.textContent = 'cloud_sync';
            break;
          case 'disconnected':
            icon.textContent = 'cloud_off';
            break;
          case 'offline':
            icon.textContent = 'cloud_off';
            break;
          default:
            icon.textContent = 'cloud_off';
        }
      }
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
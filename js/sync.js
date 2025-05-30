/**
 * Secure Access - Google Play Games Cloud Save Manager
 * Handles automatic data synchronization using Google Play Games Services
 */

class CloudSyncManager {
  constructor() {
    this.isInitialized = false;
    this.isSignedIn = false;
    this.lastSyncTime = null;
    this.syncInProgress = false;
    this.autoSyncEnabled = true;
    this.syncConflictResolver = null;
  }

  async init() {
    try {
      console.log('[Sync] Initializing Google Play Games Services');
      
      // Check if Google Play Games Services is available
      if (!window.gapi) {
        console.log('[Sync] Loading Google Play Games API');
        await this.loadGoogleAPI();
      }

      // Initialize the Games API
      await this.initializeGamesAPI();
      
      // Check current sign-in status
      await this.checkSignInStatus();
      
      // Setup auto-sync if enabled
      if (this.autoSyncEnabled) {
        this.setupAutoSync();
      }
      
      this.isInitialized = true;
      console.log('[Sync] Cloud Sync Manager initialized successfully');
      
    } catch (error) {
      console.error('[Sync] Error initializing cloud sync:', error);
      // Gracefully fall back to local storage only
      this.isInitialized = false;
    }
  }

  async loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('auth2:client:games', resolve);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async initializeGamesAPI() {
    return new Promise((resolve, reject) => {
      window.gapi.load('games', {
        callback: () => {
          window.gapi.games.init({
            client_id: 'AUTO_DETECT', // Auto-detect from app
            scope: 'https://www.googleapis.com/auth/games'
          });
          resolve();
        },
        onerror: reject
      });
    });
  }

  async checkSignInStatus() {
    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      this.isSignedIn = authInstance?.isSignedIn.get() || false;
      
      if (this.isSignedIn) {
        console.log('[Sync] User is signed in to Google Play Games');
        await this.performInitialSync();
      } else {
        console.log('[Sync] User not signed in to Google Play Games');
      }
    } catch (error) {
      console.error('[Sync] Error checking sign-in status:', error);
      this.isSignedIn = false;
    }
  }

  async signIn() {
    if (!this.isInitialized) {
      throw new Error('Cloud sync not initialized');
    }

    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn();
      
      this.isSignedIn = true;
      console.log('[Sync] Successfully signed in to Google Play Games');
      
      // Perform initial sync after sign-in
      await this.performInitialSync();
      
      return { success: true, user: user.getBasicProfile() };
    } catch (error) {
      console.error('[Sync] Sign-in failed:', error);
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    if (!this.isInitialized || !this.isSignedIn) {
      return;
    }

    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      
      this.isSignedIn = false;
      console.log('[Sync] Successfully signed out from Google Play Games');
      
    } catch (error) {
      console.error('[Sync] Sign-out failed:', error);
    }
  }

  async syncToCloud() {
    if (!this.isSignedIn || this.syncInProgress) {
      return { success: false, message: 'Sync not available' };
    }

    try {
      this.syncInProgress = true;
      console.log('[Sync] Starting sync to cloud');

      // Get current local data
      const localData = {
        personnel: window.StorageManager.data.personnel || [],
        activities: window.StorageManager.data.activities || [],
        settings: window.StorageManager.data.settings || {},
        lastModified: Date.now(),
        version: '1.0'
      };

      // Save to cloud using Saved Games API
      const saveResult = await this.saveToCloud(localData);
      
      if (saveResult.success) {
        this.lastSyncTime = Date.now();
        localStorage.setItem('lastCloudSync', this.lastSyncTime.toString());
        console.log('[Sync] Data successfully synced to cloud');
      }

      return saveResult;

    } catch (error) {
      console.error('[Sync] Error syncing to cloud:', error);
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncFromCloud() {
    if (!this.isSignedIn || this.syncInProgress) {
      return { success: false, message: 'Sync not available' };
    }

    try {
      this.syncInProgress = true;
      console.log('[Sync] Starting sync from cloud');

      // Load from cloud using Saved Games API
      const loadResult = await this.loadFromCloud();
      
      if (loadResult.success && loadResult.data) {
        // Check for conflicts
        const hasConflicts = await this.detectConflicts(loadResult.data);
        
        if (hasConflicts && this.syncConflictResolver) {
          const resolution = await this.syncConflictResolver(loadResult.data);
          if (resolution.cancelled) {
            return { success: false, message: 'Sync cancelled by user' };
          }
          loadResult.data = resolution.data;
        }

        // Apply cloud data to local storage
        await this.applyCloudData(loadResult.data);
        
        this.lastSyncTime = Date.now();
        localStorage.setItem('lastCloudSync', this.lastSyncTime.toString());
        console.log('[Sync] Data successfully synced from cloud');
      }

      return loadResult;

    } catch (error) {
      console.error('[Sync] Error syncing from cloud:', error);
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  async saveToCloud(data) {
    try {
      // Use a specific save slot for security data
      const saveSlot = 'security_access_data';
      const dataString = JSON.stringify(data);
      
      // Mock implementation - in real app would use gapi.games.snapshots
      return new Promise((resolve) => {
        // Simulate cloud save
        setTimeout(() => {
          localStorage.setItem(`cloud_${saveSlot}`, dataString);
          resolve({ success: true, savedAt: Date.now() });
        }, 1000);
      });

    } catch (error) {
      console.error('[Sync] Error saving to cloud:', error);
      return { success: false, error: error.message };
    }
  }

  async loadFromCloud() {
    try {
      const saveSlot = 'security_access_data';
      
      // Mock implementation - in real app would use gapi.games.snapshots
      return new Promise((resolve) => {
        setTimeout(() => {
          const cloudData = localStorage.getItem(`cloud_${saveSlot}`);
          if (cloudData) {
            resolve({ 
              success: true, 
              data: JSON.parse(cloudData),
              loadedAt: Date.now()
            });
          } else {
            resolve({ success: false, message: 'No cloud data found' });
          }
        }, 1000);
      });

    } catch (error) {
      console.error('[Sync] Error loading from cloud:', error);
      return { success: false, error: error.message };
    }
  }

  async detectConflicts(cloudData) {
    const localData = window.StorageManager.data;
    
    // Simple conflict detection based on modification times
    const localModified = localData.lastModified || 0;
    const cloudModified = cloudData.lastModified || 0;
    
    // Consider it a conflict if both have been modified and times differ significantly
    const timeDiff = Math.abs(localModified - cloudModified);
    return timeDiff > 60000; // 1 minute threshold
  }

  async applyCloudData(cloudData) {
    // Merge cloud data with local data
    window.StorageManager.data = {
      personnel: cloudData.personnel || [],
      activities: cloudData.activities || [],
      settings: { ...window.StorageManager.data.settings, ...cloudData.settings }
    };
    
    await window.StorageManager.saveToStorage();
    
    // Refresh the UI if on relevant pages
    if (window.app) {
      const currentPage = window.app.currentPage;
      if (currentPage === 'dashboard') {
        await window.app.updateDashboard();
      } else if (currentPage === 'personnel') {
        await window.app.loadPersonnelList();
      } else if (currentPage === 'activity') {
        await window.app.updateActivityPage();
      }
    }
  }

  setupAutoSync() {
    // Auto-sync every 5 minutes when signed in
    setInterval(async () => {
      if (this.isSignedIn && !this.syncInProgress && this.autoSyncEnabled) {
        await this.syncToCloud();
      }
    }, 5 * 60 * 1000);

    // Sync on page visibility change (when user returns to app)
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden && this.isSignedIn && !this.syncInProgress) {
        await this.syncFromCloud();
      }
    });
  }

  async performInitialSync() {
    // Try to load from cloud first, then save current data if no cloud data exists
    const loadResult = await this.syncFromCloud();
    
    if (!loadResult.success || !loadResult.data) {
      // No cloud data exists, upload current local data
      await this.syncToCloud();
    }
  }

  getSyncStatus() {
    return {
      isInitialized: this.isInitialized,
      isSignedIn: this.isSignedIn,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      autoSyncEnabled: this.autoSyncEnabled
    };
  }

  setConflictResolver(resolver) {
    this.syncConflictResolver = resolver;
  }

  toggleAutoSync(enabled) {
    this.autoSyncEnabled = enabled;
    localStorage.setItem('autoSyncEnabled', enabled.toString());
  }

  isAvailable() {
    return this.isInitialized;
  }

  formatLastSyncTime() {
    if (!this.lastSyncTime) return 'Never';
    
    const now = Date.now();
    const diff = now - this.lastSyncTime;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  }
}

// Initialize globally
window.CloudSyncManager = new CloudSyncManager();
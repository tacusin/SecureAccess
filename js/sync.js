/**
 * Secure Access - Google Drive Cloud Sync Manager
 * Handles automatic data synchronization using Google Drive API
 */

class CloudSyncManager {
  constructor() {
    this.isInitialized = false;
    this.isSignedIn = false;
    this.lastSyncTime = null;
    this.syncInProgress = false;
    this.autoSyncEnabled = true;
    this.syncConflictResolver = null;
    this.driveFileId = null;
    this.fileName = 'secure_access_backup.json';
  }

  async init() {
    try {
      console.log('[Sync] Initializing Google Drive API');
      
      // Check if Google API is available
      if (!window.gapi) {
        console.log('[Sync] Loading Google Drive API');
        await this.loadGoogleAPI();
      }

      // Initialize the Drive API
      await this.initializeDriveAPI();
      
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
        window.gapi.load('client:auth2', resolve);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async initializeDriveAPI() {
    // Get API credentials from environment
    const apiKey = window.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_DRIVE_API_KEY;
    const clientId = window.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID;
    
    if (!apiKey || !clientId) {
      throw new Error('Google Drive API credentials not found');
    }
    
    await window.gapi.client.init({
      apiKey: apiKey,
      clientId: clientId,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      scope: 'https://www.googleapis.com/auth/drive.file'
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
      const dataString = JSON.stringify(data, null, 2);
      
      if (this.driveFileId) {
        // Update existing file
        const response = await window.gapi.client.request({
          path: `https://www.googleapis.com/upload/drive/v3/files/${this.driveFileId}`,
          method: 'PATCH',
          params: {
            uploadType: 'media'
          },
          headers: {
            'Content-Type': 'application/json'
          },
          body: dataString
        });
        
        return { success: true, fileId: response.result.id, savedAt: Date.now() };
      } else {
        // Create new file
        const metadata = {
          name: this.fileName,
          parents: ['appDataFolder']
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
        form.append('file', new Blob([dataString], {type: 'application/json'}));
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: new Headers({
            'Authorization': `Bearer ${window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
          }),
          body: form
        });
        
        const result = await response.json();
        this.driveFileId = result.id;
        localStorage.setItem('driveFileId', this.driveFileId);
        
        return { success: true, fileId: result.id, savedAt: Date.now() };
      }

    } catch (error) {
      console.error('[Sync] Error saving to Google Drive:', error);
      return { success: false, error: error.message };
    }
  }

  async loadFromCloud() {
    try {
      // Find the backup file
      await this.findBackupFile();
      
      if (!this.driveFileId) {
        return { success: false, message: 'No backup file found' };
      }
      
      // Download file content
      const response = await window.gapi.client.drive.files.get({
        fileId: this.driveFileId,
        alt: 'media'
      });
      
      const data = JSON.parse(response.body);
      return { 
        success: true, 
        data: data,
        loadedAt: Date.now()
      };

    } catch (error) {
      console.error('[Sync] Error loading from Google Drive:', error);
      return { success: false, error: error.message };
    }
  }

  async findBackupFile() {
    try {
      // Check if we have a cached file ID
      const cachedFileId = localStorage.getItem('driveFileId');
      if (cachedFileId) {
        this.driveFileId = cachedFileId;
        return;
      }
      
      // Search for the backup file
      const response = await window.gapi.client.drive.files.list({
        q: `name='${this.fileName}' and parents in 'appDataFolder'`,
        spaces: 'appDataFolder'
      });
      
      if (response.result.files && response.result.files.length > 0) {
        this.driveFileId = response.result.files[0].id;
        localStorage.setItem('driveFileId', this.driveFileId);
      }

    } catch (error) {
      console.error('[Sync] Error finding backup file:', error);
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
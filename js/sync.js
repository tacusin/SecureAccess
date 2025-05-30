/**
 * Secure Access - Google Drive Cloud Sync Manager
 * Handles automatic data synchronization using Google Drive API with new Google Identity Services
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
    this.fallbackMode = false;
    this.accessToken = null;
    this.tokenClient = null;
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
      
      this.isInitialized = true;
      this.setupAutoSync();
      await this.checkSignInStatus();
      
      console.log('[Sync] Cloud sync initialized successfully');
    } catch (error) {
      console.error('[Sync] Error initializing cloud sync:', error);
      console.log('[Sync] Running in local backup mode');
      this.fallbackMode = true;
      this.isInitialized = true;
    }
  }

  async loadGoogleAPI() {
    // Load Google Identity Services (new authentication library)
    return new Promise((resolve, reject) => {
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.onload = () => {
        // Then load the API client
        const apiScript = document.createElement('script');
        apiScript.src = 'https://apis.google.com/js/api.js';
        apiScript.onload = () => {
          window.gapi.load('client', resolve);
        };
        apiScript.onerror = reject;
        document.head.appendChild(apiScript);
      };
      gisScript.onerror = reject;
      document.head.appendChild(gisScript);
    });
  }

  async initializeDriveAPI() {
    // Get API credentials from environment
    const apiKey = window.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_DRIVE_API_KEY;
    const clientId = window.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID;
    
    if (!apiKey || !clientId) {
      throw new Error('Google Drive API credentials not found');
    }
    
    console.log('[Sync] Initializing with API Key:', apiKey.substring(0, 10) + '...');
    console.log('[Sync] Initializing with Client ID:', clientId.substring(0, 20) + '...');
    
    // Initialize Google API client
    await window.gapi.client.init({
      apiKey: apiKey,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
    });
    
    // Initialize Google Identity Services for authentication
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (response.error !== undefined) {
          throw response;
        }
        this.accessToken = response.access_token;
        window.gapi.client.setToken({access_token: this.accessToken});
        this.isSignedIn = true;
        console.log('[Sync] Successfully authenticated with Google Drive');
      }
    });
  }

  async checkSignInStatus() {
    try {
      // With new GIS, we check if we have a valid access token
      this.isSignedIn = !!this.accessToken;
      
      if (this.isSignedIn) {
        console.log('[Sync] User is signed in to Google Drive');
        await this.performInitialSync();
      } else {
        console.log('[Sync] User not signed in to Google Drive');
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

    if (this.fallbackMode) {
      // In fallback mode, provide local backup/restore functionality
      this.isSignedIn = true;
      return { success: true, fallback: true };
    }

    try {
      // Use new Google Identity Services token client
      this.tokenClient.requestAccessToken({prompt: 'consent'});
      
      // Return a promise that resolves when authentication completes
      return new Promise((resolve, reject) => {
        const checkAuth = () => {
          if (this.isSignedIn) {
            console.log('[Sync] Successfully signed in to Google Drive');
            this.performInitialSync().then(() => {
              resolve({ success: true });
            }).catch(reject);
          } else {
            setTimeout(checkAuth, 100);
          }
        };
        checkAuth();
      });
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
      if (this.fallbackMode) {
        this.isSignedIn = false;
        console.log('[Sync] Disconnected from local backup mode');
        return;
      }

      if (this.accessToken) {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {
          console.log('[Sync] Access token revoked');
        });
      }
      this.accessToken = null;
      this.isSignedIn = false;
      window.gapi.client.setToken(null);
      console.log('[Sync] User signed out successfully');
    } catch (error) {
      console.error('[Sync] Sign-out failed:', error);
      throw error;
    }
  }

  async syncToCloud() {
    if (!this.isInitialized || !this.isSignedIn) {
      throw new Error('Not signed in to Google Drive');
    }

    if (this.fallbackMode) {
      // In fallback mode, create downloadable backup
      return await this.downloadBackup();
    }

    try {
      this.syncInProgress = true;
      
      // Get current data from storage
      const currentData = window.storageManager.exportData();
      currentData.lastSyncTime = Date.now();
      
      // Save to Google Drive
      const result = await this.saveToCloud(currentData);
      
      this.lastSyncTime = Date.now();
      console.log('[Sync] Data synced to cloud successfully');
      
      return result;
    } catch (error) {
      console.error('[Sync] Sync to cloud failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async downloadBackup(data) {
    // Create downloadable backup file
    const backupData = data || window.storageManager.exportData();
    backupData.exportTime = Date.now();
    backupData.version = '1.0';
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `secure_access_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('[Sync] Backup file downloaded');
    return { success: true, type: 'download' };
  }

  async syncFromCloud() {
    if (!this.isInitialized || !this.isSignedIn) {
      throw new Error('Not signed in to Google Drive');
    }

    if (this.fallbackMode) {
      // In fallback mode, allow file upload
      return await this.uploadRestore();
    }

    try {
      this.syncInProgress = true;
      
      // Load data from Google Drive
      const cloudData = await this.loadFromCloud();
      
      if (!cloudData) {
        console.log('[Sync] No cloud backup found');
        return { success: false, reason: 'No backup found' };
      }
      
      // Check for conflicts
      const conflicts = await this.detectConflicts(cloudData);
      
      if (conflicts.length > 0 && this.syncConflictResolver) {
        const resolution = await this.syncConflictResolver(conflicts);
        if (!resolution.proceed) {
          return { success: false, reason: 'User cancelled due to conflicts' };
        }
      }
      
      // Apply cloud data
      await this.applyCloudData(cloudData);
      
      this.lastSyncTime = Date.now();
      console.log('[Sync] Data synced from cloud successfully');
      
      return { success: true };
    } catch (error) {
      console.error('[Sync] Sync from cloud failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async uploadRestore() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        try {
          const file = e.target.files[0];
          if (!file) {
            resolve({ success: false, reason: 'No file selected' });
            return;
          }
          
          const text = await file.text();
          const data = JSON.parse(text);
          
          // Apply restored data
          await window.storageManager.importData(data);
          
          console.log('[Sync] Data restored from file successfully');
          resolve({ success: true, type: 'upload' });
        } catch (error) {
          console.error('[Sync] File restore failed:', error);
          reject(error);
        }
      };
      input.click();
    });
  }

  async saveToCloud(data) {
    try {
      const metadata = {
        name: this.fileName,
        parents: ['appDataFolder']
      };
      
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
      form.append('file', new Blob([JSON.stringify(data)], {type: 'application/json'}));
      
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: form
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }
      
      const result = await response.json();
      this.driveFileId = result.id;
      
      return result;
    } catch (error) {
      console.error('[Sync] Save to cloud failed:', error);
      throw error;
    }
  }

  async loadFromCloud() {
    try {
      // Find the backup file
      const fileId = await this.findBackupFile();
      
      if (!fileId) {
        return null;
      }
      
      // Download the file content
      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });
      
      return JSON.parse(response.body);
    } catch (error) {
      console.error('[Sync] Load from cloud failed:', error);
      throw error;
    }
  }

  async findBackupFile() {
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `name='${this.fileName}' and parents in 'appDataFolder'`,
        spaces: 'appDataFolder'
      });
      
      const files = response.result.files;
      return files && files.length > 0 ? files[0].id : null;
    } catch (error) {
      console.error('[Sync] Find backup file failed:', error);
      return null;
    }
  }

  async detectConflicts(cloudData) {
    // Simple conflict detection based on last modification times
    const localData = window.storageManager.exportData();
    const conflicts = [];
    
    if (cloudData.lastSyncTime && localData.lastModified > cloudData.lastSyncTime) {
      conflicts.push({
        type: 'data_newer_locally',
        localTime: localData.lastModified,
        cloudTime: cloudData.lastSyncTime
      });
    }
    
    return conflicts;
  }

  async applyCloudData(cloudData) {
    await window.storageManager.importData(cloudData);
    
    // Refresh the current page
    if (window.app && window.app.updatePageContent) {
      const currentPage = document.querySelector('.page.active')?.id;
      if (currentPage) {
        await window.app.updatePageContent(currentPage);
      }
    }
  }

  setupAutoSync() {
    if (!this.autoSyncEnabled) return;
    
    // Auto-sync every 5 minutes when signed in
    setInterval(async () => {
      if (this.isSignedIn && !this.syncInProgress && !this.fallbackMode) {
        try {
          await this.syncToCloud();
        } catch (error) {
          console.error('[Sync] Auto-sync failed:', error);
        }
      }
    }, 5 * 60 * 1000);
  }

  async performInitialSync() {
    if (this.fallbackMode) return;
    
    try {
      // Check if cloud backup exists
      const fileId = await this.findBackupFile();
      
      if (fileId) {
        // Download and merge cloud data
        await this.syncFromCloud();
      } else {
        // Upload current data to cloud
        await this.syncToCloud();
      }
    } catch (error) {
      console.error('[Sync] Initial sync failed:', error);
    }
  }

  getSyncStatus() {
    return {
      isInitialized: this.isInitialized,
      isSignedIn: this.isSignedIn,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      fallbackMode: this.fallbackMode
    };
  }

  setConflictResolver(resolver) {
    this.syncConflictResolver = resolver;
  }

  toggleAutoSync(enabled) {
    this.autoSyncEnabled = enabled;
    if (enabled) {
      this.setupAutoSync();
    }
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

// Initialize cloud sync manager
window.cloudSyncManager = new CloudSyncManager();
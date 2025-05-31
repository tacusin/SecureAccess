/**
 * Secure Access - Firebase Configuration Manager
 * Handles Firebase credentials setup and connection testing
 */

class FirebaseConfigManager {
  constructor() {
    this.configForm = null;
    this.isConfigured = false;
    this.currentConfig = null;
  }

  async init() {
    this.setupEventListeners();
    this.updateUI();
    this.checkExistingConfig();
  }

  setupEventListeners() {
    // Configure Firebase button
    const configBtn = document.getElementById('configure-firebase-btn');
    if (configBtn) {
      configBtn.addEventListener('click', () => this.showConfigModal());
    }

    // Add fallback event delegation for dynamically created buttons
    document.addEventListener('click', (e) => {
      if (e.target.id === 'configure-firebase-btn' || e.target.closest('#configure-firebase-btn')) {
        this.showConfigModal();
      }
    });

    // Test connection button
    const testBtn = document.getElementById('test-connection-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testConnection());
    }

    // Reset config button
    const resetBtn = document.getElementById('reset-config-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetConfig());
    }

    // Join group button
    const joinGroupBtn = document.getElementById('join-group-btn');
    if (joinGroupBtn) {
      joinGroupBtn.addEventListener('click', () => {
        if (window.SyncPasswordManager) {
          window.SyncPasswordManager.showSyncPasswordModal();
        }
      });
    }

    // Change group button
    const changeGroupBtn = document.getElementById('change-group-btn');
    if (changeGroupBtn) {
      changeGroupBtn.addEventListener('click', () => {
        if (window.SyncPasswordManager) {
          window.SyncPasswordManager.showSyncPasswordModal();
        }
      });
    }

    // Show group QR button
    const groupQRBtn = document.getElementById('show-group-qr-btn');
    if (groupQRBtn) {
      groupQRBtn.addEventListener('click', () => this.showGroupQR());
    }

    // Clear log button
    const clearLogBtn = document.getElementById('clear-firebase-log-btn');
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', () => this.clearLog());
    }
  }

  checkExistingConfig() {
    // Check if Firebase environment variables are available
    if (window.FIREBASE_API_KEY && window.FIREBASE_PROJECT_ID) {
      this.isConfigured = true;
      this.currentConfig = {
        apiKey: window.FIREBASE_API_KEY,
        projectId: window.FIREBASE_PROJECT_ID,
        authDomain: window.FIREBASE_AUTH_DOMAIN,
        storageBucket: window.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID,
        appId: window.FIREBASE_APP_ID
      };
      this.updateConfigStatus('configured', 'Firebase credentials loaded from environment');
    } else {
      this.updateConfigStatus('not-configured', 'Firebase credentials required');
    }
  }

  showConfigModal() {
    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    
    if (!modal || !content) {
      this.addLog('error', 'Cannot show configuration modal - modal elements not found');
      return;
    }

    content.innerHTML = `
      <div class="modal-header">
        <h2>Firebase Configuration</h2>
        <button class="icon-button" onclick="window.app.closeModal()">
          <span class="material-icons">close</span>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="config-instructions">
          <h3>Firebase Project Setup</h3>
          <p>To enable real-time synchronization, you need Firebase credentials from your Firebase Console:</p>
          <ol>
            <li>Go to <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a></li>
            <li>Select your project or create a new one</li>
            <li>Go to Project Settings → General</li>
            <li>In the "Your apps" section, find your web app configuration</li>
            <li>Copy the configuration values below</li>
          </ol>
        </div>

        <div class="firebase-form">
          <div class="form-group">
            <label for="firebase-api-key">API Key</label>
            <input type="text" id="firebase-api-key" class="form-input" placeholder="AIzaSy..." required>
          </div>
          
          <div class="form-group">
            <label for="firebase-project-id">Project ID</label>
            <input type="text" id="firebase-project-id" class="form-input" placeholder="your-project-id" required>
          </div>
          
          <div class="form-group">
            <label for="firebase-auth-domain">Auth Domain</label>
            <input type="text" id="firebase-auth-domain" class="form-input" placeholder="your-project.firebaseapp.com" required>
          </div>
          
          <div class="form-group">
            <label for="firebase-storage-bucket">Storage Bucket</label>
            <input type="text" id="firebase-storage-bucket" class="form-input" placeholder="your-project.appspot.com">
          </div>
          
          <div class="form-group">
            <label for="firebase-messaging-sender-id">Messaging Sender ID</label>
            <input type="text" id="firebase-messaging-sender-id" class="form-input" placeholder="123456789012">
          </div>
          
          <div class="form-group">
            <label for="firebase-app-id">App ID</label>
            <input type="text" id="firebase-app-id" class="form-input" placeholder="1:123456789012:web:..." required>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="action-button secondary" onclick="window.app.closeModal()">Cancel</button>
        <button class="action-button primary" onclick="window.FirebaseConfigManager.saveConfig()">Save & Test</button>
      </div>
    `;

    modal.style.display = 'flex';
    this.configForm = content.querySelector('.firebase-form');
  }

  async saveConfig() {
    if (!this.configForm) return;

    const config = {
      apiKey: this.configForm.querySelector('#firebase-api-key').value.trim(),
      projectId: this.configForm.querySelector('#firebase-project-id').value.trim(),
      authDomain: this.configForm.querySelector('#firebase-auth-domain').value.trim(),
      storageBucket: this.configForm.querySelector('#firebase-storage-bucket').value.trim(),
      messagingSenderId: this.configForm.querySelector('#firebase-messaging-sender-id').value.trim(),
      appId: this.configForm.querySelector('#firebase-app-id').value.trim()
    };

    // Validate required fields
    if (!config.apiKey || !config.projectId || !config.authDomain || !config.appId) {
      alert('Please fill in all required fields (API Key, Project ID, Auth Domain, and App ID)');
      return;
    }

    // Store configuration
    this.currentConfig = config;
    
    // Set window variables for Firebase
    window.FIREBASE_API_KEY = config.apiKey;
    window.FIREBASE_PROJECT_ID = config.projectId;
    window.FIREBASE_AUTH_DOMAIN = config.authDomain;
    window.FIREBASE_STORAGE_BUCKET = config.storageBucket;
    window.FIREBASE_MESSAGING_SENDER_ID = config.messagingSenderId;
    window.FIREBASE_APP_ID = config.appId;

    this.isConfigured = true;
    this.updateConfigStatus('configured', 'Configuration saved - testing connection...');
    
    // Close modal
    if (window.app && window.app.closeModal) {
      window.app.closeModal();
    }

    // Test the connection
    await this.testConnection();
    
    this.addLog('info', 'Firebase configuration saved');
  }

  async testConnection() {
    if (!this.isConfigured) {
      this.addLog('error', 'No Firebase configuration available');
      return;
    }

    this.updateConfigStatus('testing', 'Testing Firebase connection...');
    this.addLog('info', 'Testing Firebase connection...');

    try {
      // Reinitialize Firebase with new config
      if (window.FirebaseSync) {
        await window.FirebaseSync.init();
        this.updateConfigStatus('connected', 'Firebase connected successfully');
        this.addLog('success', 'Firebase connection successful');
        
        // Enable test button and show reset button
        const testBtn = document.getElementById('test-connection-btn');
        const resetBtn = document.getElementById('reset-config-btn');
        if (testBtn) testBtn.disabled = false;
        if (resetBtn) resetBtn.style.display = 'inline-flex';
        
      } else {
        throw new Error('Firebase sync manager not available');
      }
    } catch (error) {
      this.updateConfigStatus('error', `Connection failed: ${error.message}`);
      this.addLog('error', `Firebase connection failed: ${error.message}`);
    }
  }

  resetConfig() {
    if (confirm('Are you sure you want to reset the Firebase configuration? This will disconnect from the current project.')) {
      // Clear configuration
      this.currentConfig = null;
      this.isConfigured = false;
      
      // Clear window variables
      delete window.FIREBASE_API_KEY;
      delete window.FIREBASE_PROJECT_ID;
      delete window.FIREBASE_AUTH_DOMAIN;
      delete window.FIREBASE_STORAGE_BUCKET;
      delete window.FIREBASE_MESSAGING_SENDER_ID;
      delete window.FIREBASE_APP_ID;
      
      this.updateConfigStatus('not-configured', 'Configuration reset');
      this.addLog('info', 'Firebase configuration reset');
      
      // Hide reset button and disable test button
      const testBtn = document.getElementById('test-connection-btn');
      const resetBtn = document.getElementById('reset-config-btn');
      if (testBtn) testBtn.disabled = true;
      if (resetBtn) resetBtn.style.display = 'none';
      
      // Disconnect Firebase
      if (window.FirebaseSync && window.FirebaseSync.disconnect) {
        window.FirebaseSync.disconnect();
      }
    }
  }

  showGroupQR() {
    const currentGroup = window.SyncPasswordManager?.getCurrentGroup();
    if (!currentGroup) {
      alert('No security group selected. Please join a group first.');
      return;
    }

    if (window.QRGenerator && window.QRGenerator.generateSyncHostQR) {
      window.QRGenerator.generateSyncHostQR();
    } else {
      alert('QR code generator not available');
    }
  }

  updateConfigStatus(status, message) {
    const statusElement = document.getElementById('firebase-config-status');
    const statusIcon = statusElement?.querySelector('.status-icon');
    const statusText = statusElement?.querySelector('.status-text');
    
    if (!statusElement || !statusIcon || !statusText) return;

    // Clear existing classes
    statusElement.className = 'config-status';
    
    switch (status) {
      case 'connected':
        statusElement.classList.add('connected');
        statusIcon.textContent = 'cloud_done';
        break;
      case 'testing':
        statusIcon.textContent = 'sync';
        break;
      case 'error':
        statusElement.classList.add('error');
        statusIcon.textContent = 'cloud_off';
        break;
      case 'configured':
        statusIcon.textContent = 'cloud_queue';
        break;
      default:
        statusIcon.textContent = 'cloud_off';
    }
    
    statusText.textContent = message;
  }

  updateUI() {
    // Update Firebase status
    const firebaseStatus = document.getElementById('firebase-status');
    const firebaseIndicator = document.getElementById('firebase-indicator');
    
    if (window.FirebaseSync) {
      const status = window.FirebaseSync.getStatus();
      if (firebaseStatus) {
        firebaseStatus.textContent = status.isConnected ? 'Connected' : 'Disconnected';
      }
      if (firebaseIndicator) {
        const icon = firebaseIndicator.querySelector('.material-icons');
        if (icon) {
          icon.textContent = status.isConnected ? 'cloud_done' : 'cloud_off';
        }
      }
    }

    // Update group info
    const currentGroupEl = document.getElementById('current-group');
    const groupDisplay = document.getElementById('current-group-display');
    const groupNameDisplay = document.getElementById('group-name-display');
    const changeGroupBtn = document.getElementById('change-group-btn');
    
    const currentGroup = window.SyncPasswordManager?.getCurrentGroup();
    
    if (currentGroupEl) {
      currentGroupEl.textContent = currentGroup || 'None';
    }
    
    if (currentGroup) {
      if (groupDisplay) groupDisplay.style.display = 'block';
      if (groupNameDisplay) groupNameDisplay.textContent = currentGroup;
      if (changeGroupBtn) changeGroupBtn.style.display = 'inline-flex';
    } else {
      if (groupDisplay) groupDisplay.style.display = 'none';
      if (changeGroupBtn) changeGroupBtn.style.display = 'none';
    }

    // Update sync stats
    if (window.FirebaseSync) {
      const status = window.FirebaseSync.getStatus();
      
      const lastSyncEl = document.getElementById('last-sync-time');
      const queueSizeEl = document.getElementById('sync-queue-size');
      const totalSyncedEl = document.getElementById('total-synced');
      
      if (lastSyncEl) {
        lastSyncEl.textContent = status.lastSync ? 
          new Date(status.lastSync).toLocaleTimeString() : 'Never';
      }
      if (queueSizeEl) {
        queueSizeEl.textContent = status.queueLength || 0;
      }
      if (totalSyncedEl) {
        // This would need to be tracked in FirebaseSync
        totalSyncedEl.textContent = '0';
      }
    }
  }

  addLog(type, message) {
    const logContainer = document.getElementById('firebase-sync-log');
    if (!logContainer) return;

    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    
    const time = new Date().toLocaleTimeString();
    logItem.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-message">${message}</span>
    `;

    // Add type-specific styling
    if (type === 'error') {
      logItem.style.color = 'hsl(var(--error))';
    } else if (type === 'success') {
      logItem.style.color = 'hsl(var(--success))';
    }

    logContainer.appendChild(logItem);
    
    // Remove old entries if too many
    const items = logContainer.querySelectorAll('.log-item');
    if (items.length > 50) {
      items[0].remove();
    }
    
    // Scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  clearLog() {
    const logContainer = document.getElementById('firebase-sync-log');
    if (logContainer) {
      logContainer.innerHTML = `
        <div class="log-item">
          <span class="log-time">--:--</span>
          <span class="log-message">Log cleared</span>
        </div>
      `;
    }
  }

  // Called by other components to update UI
  onFirebaseStatusChange() {
    this.updateUI();
  }

  onGroupChange() {
    this.updateUI();
  }
}

// Create global instance
window.FirebaseConfigManager = new FirebaseConfigManager();

console.log('[FirebaseConfig] Firebase Configuration Manager loaded');
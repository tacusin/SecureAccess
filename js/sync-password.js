/**
 * Secure Access - Sync Password Manager
 * Allows users to join or create security groups using passwords
 */

class SyncPasswordManager {
  constructor() {
    this.isSetup = false;
    this.currentGroupId = null;
    
    console.log('[SyncPassword] Sync Password Manager initialized');
  }

  async init() {
    this.setupEventListeners();
    await this.checkExistingGroup();
    this.isSetup = true;
  }

  setupEventListeners() {
    // Listen for sync password form submission
    document.addEventListener('click', (e) => {
      if (e.target.id === 'sync-password-btn') {
        this.showSyncPasswordModal();
      }
      if (e.target.id === 'submit-sync-password') {
        this.handleSyncPasswordSubmit();
      }
      if (e.target.id === 'change-group-btn') {
        this.showSyncPasswordModal();
      }
    });
  }

  async checkExistingGroup() {
    // Check if user already has a group stored locally
    const storedGroup = localStorage.getItem('userSyncGroup');
    if (storedGroup) {
      this.currentGroupId = storedGroup;
      this.updateGroupDisplay();
      
      // If Firebase is available, verify group membership
      if (window.FirebaseSync && window.FirebaseSync.isInitialized) {
        await this.verifyGroupMembership(storedGroup);
      }
    } else {
      // Add sync button if no group is set
      this.addSyncButton();
    }
  }

  showSyncPasswordModal() {
    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    
    if (!modal || !content) {
      console.warn('[SyncPassword] Modal elements not found, adding sync button to header');
      this.addSyncButton();
      return;
    }
    
    content.innerHTML = `
      <div class="modal-header">
        <h2>Join Security Group</h2>
        <button class="icon-button" onclick="window.app.closeModal()">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <p>Enter a sync password to join an existing security group or create a new one.</p>
        <div class="form-group">
          <label for="sync-password-input">Sync Password</label>
          <input type="text" id="sync-password-input" placeholder="Enter group password" class="form-input">
          <div class="form-help">
            • If this password matches an existing group, you'll join it
            • If it's new, a security group will be created with this name
          </div>
        </div>
        ${this.currentGroupId ? `
          <div class="current-group-info">
            <strong>Current Group:</strong> ${this.currentGroupId}
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button id="submit-sync-password" class="action-button primary">
          Join Group
        </button>
      </div>
    `;
    
    modal.classList.remove('hidden');
    
    // Focus input and handle enter key
    setTimeout(() => {
      const input = document.getElementById('sync-password-input');
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleSyncPasswordSubmit();
        }
      });
    }, 100);
  }

  async handleSyncPasswordSubmit() {
    const input = document.getElementById('sync-password-input');
    const password = input.value.trim();
    
    if (!password) {
      this.showError('Please enter a sync password');
      return;
    }

    // Sanitize password to create valid group ID
    const groupId = this.sanitizeGroupId(password);
    
    try {
      const submitBtn = document.getElementById('submit-sync-password');
      submitBtn.textContent = 'Joining...';
      submitBtn.disabled = true;

      await this.joinOrCreateGroup(groupId, password);
      
      // Store group locally
      localStorage.setItem('userSyncGroup', groupId);
      this.currentGroupId = groupId;
      
      // Update Firebase sync if available
      if (window.FirebaseSync) {
        window.FirebaseSync.currentGroupId = groupId;
        await this.setupFirebaseGroupMembership(groupId);
      }
      
      this.updateGroupDisplay();
      window.app.closeModal();
      
      this.showSuccess(`Successfully joined security group: ${groupId}`);
      
    } catch (error) {
      console.error('[SyncPassword] Error joining group:', error);
      this.showError('Failed to join group. Please try again.');
      
      submitBtn.textContent = 'Join Group';
      submitBtn.disabled = false;
    }
  }

  sanitizeGroupId(password) {
    // Convert password to valid group ID
    return password
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50) || 'default_group';
  }

  async joinOrCreateGroup(groupId, originalPassword) {
    // Check if group exists (if Firebase is available)
    if (window.FirebaseSync && window.FirebaseSync.database) {
      const groupRef = window.FirebaseSync.database.ref(`groupData/${groupId}`);
      const snapshot = await groupRef.once('value');
      
      if (snapshot.exists()) {
        console.log('[SyncPassword] Joining existing group:', groupId);
      } else {
        console.log('[SyncPassword] Creating new group:', groupId);
        // Initialize new group structure
        await groupRef.set({
          metadata: {
            created: window.firebase.database.ServerValue.TIMESTAMP,
            originalPassword: originalPassword,
            createdBy: window.FirebaseSync.currentUser?.uid || 'anonymous'
          },
          members: {},
          personnel: {},
          activities: {},
          occupancy: {
            count: 0,
            timestamp: window.firebase.database.ServerValue.TIMESTAMP
          }
        });
      }
    } else {
      // Local mode - just set the group
      console.log('[SyncPassword] Local mode - setting group:', groupId);
    }
  }

  async setupFirebaseGroupMembership(groupId) {
    if (!window.FirebaseSync || !window.FirebaseSync.currentUser) {
      return;
    }

    const userId = window.FirebaseSync.currentUser.uid;
    
    try {
      // Add user to group members
      const memberRef = window.FirebaseSync.database.ref(`groupData/${groupId}/members/${userId}`);
      await memberRef.set(true);
      
      // Update user's groups list
      const userRef = window.FirebaseSync.database.ref(`users/${userId}/groups/${groupId}`);
      await userRef.set(true);
      
      // Update Firebase sync manager
      window.FirebaseSync.currentGroupId = groupId;
      window.FirebaseSync.userGroups = [groupId];
      
      // Restart listeners for new group
      window.FirebaseSync.setupGroupBasedListeners();
      
      console.log('[SyncPassword] Firebase group membership established');
      
    } catch (error) {
      console.error('[SyncPassword] Failed to setup Firebase membership:', error);
    }
  }

  async verifyGroupMembership(groupId) {
    if (!window.FirebaseSync || !window.FirebaseSync.database) {
      return;
    }

    try {
      const groupRef = window.FirebaseSync.database.ref(`groupData/${groupId}`);
      const snapshot = await groupRef.once('value');
      
      if (!snapshot.exists()) {
        // Group no longer exists, clear local storage
        localStorage.removeItem('userSyncGroup');
        this.currentGroupId = null;
        this.showSyncPasswordModal();
      }
    } catch (error) {
      console.warn('[SyncPassword] Could not verify group membership:', error);
    }
  }

  updateGroupDisplay() {
    // Update header to show current group
    const appTitle = document.querySelector('.app-title');
    if (appTitle && this.currentGroupId) {
      const groupDisplay = this.currentGroupId.replace(/_/g, ' ').toUpperCase();
      appTitle.innerHTML = `
        <img src="generated-icon.png" alt="Secure Access" class="app-logo">
        <div>
          <div>Secure Access</div>
          <div style="font-size: 0.8em; opacity: 0.8;">${groupDisplay}</div>
        </div>
      `;
    }

    // Add change group button to settings
    this.addGroupControls();
  }

  addSyncButton() {
    const settingsArea = document.querySelector('.app-bar-actions');
    if (settingsArea && !document.getElementById('sync-password-btn')) {
      const syncBtn = document.createElement('button');
      syncBtn.id = 'sync-password-btn';
      syncBtn.className = 'icon-button';
      syncBtn.title = 'Join Sync Group';
      syncBtn.innerHTML = '<span class="material-icons">group_add</span>';
      
      settingsArea.insertBefore(syncBtn, settingsArea.firstChild);
    }
  }

  addGroupControls() {
    // Add to settings or navigation
    const settingsArea = document.querySelector('.app-bar-actions');
    if (settingsArea && !document.getElementById('change-group-btn')) {
      const groupBtn = document.createElement('button');
      groupBtn.id = 'change-group-btn';
      groupBtn.className = 'icon-button';
      groupBtn.title = 'Change Security Group';
      groupBtn.innerHTML = '<span class="material-icons">group</span>';
      
      settingsArea.insertBefore(groupBtn, settingsArea.firstChild);
    }
  }

  getCurrentGroup() {
    return this.currentGroupId;
  }

  showSuccess(message) {
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(message, 'success');
    } else {
      console.log('[SyncPassword]', message);
    }
  }

  showError(message) {
    if (window.app && typeof window.app.showToast === 'function') {
      window.app.showToast(message, 'error');
    } else {
      console.error('[SyncPassword]', message);
    }
  }
}

// Create global instance
window.SyncPasswordManager = new SyncPasswordManager();

console.log('[SyncPassword] Sync Password Manager loaded');
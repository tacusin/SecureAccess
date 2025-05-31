/**
 * Secure Access - Activity Module
 * Handles activity logging, filtering, and management
 */

class ActivityModule {
  constructor() {
    this.initialized = false;
    this.activityLog = [];
    this.filteredActivities = [];
    this.bulkSelectMode = false;
    this.selectedActivities = new Set();
  }

  async init() {
    await this.loadActivityData();
    console.log('[Activity] Activity module initialized');
    this.initialized = true;
  }

  async loadActivityData() {
    try {
      const stored = localStorage.getItem('activityLog');
      this.activityLog = stored ? JSON.parse(stored) : [];
      this.filteredActivities = [...this.activityLog];
    } catch (error) {
      console.error('[Activity] Error loading activity data:', error);
      this.activityLog = [];
      this.filteredActivities = [];
    }
  }

  async saveActivityData() {
    try {
      localStorage.setItem('activityLog', JSON.stringify(this.activityLog));
      localStorage.setItem('activityLog_backup', JSON.stringify(this.activityLog));
    } catch (error) {
      console.error('[Activity] Error saving activity data:', error);
    }
  }

  async logActivity(activity) {
    this.activityLog.unshift(activity);
    this.filteredActivities = [...this.activityLog];
    await this.saveActivityData();
    
    // Update UI if on activity page
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage.id === 'activity-page') {
      this.updateActivityPage();
    }
  }

  createActivityItem(activity) {
    const { icon, color, actionText } = this.getActivityDisplayInfo(activity);
    const isUndoable = this.isUndoable(activity);
    const isSelected = this.selectedActivities.has(activity.id);
    
    return `
      <div class="activity-item ${this.bulkSelectMode ? 'selectable' : ''}" data-activity-id="${activity.id}">
        ${this.bulkSelectMode ? `
          <div class="activity-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''} 
                   onchange="window.ActivityModule.toggleActivitySelection('${activity.id}')">
          </div>
        ` : ''}
        <div class="activity-icon ${color}">
          <span class="material-icons">${icon}</span>
        </div>
        <div class="activity-details">
          <div class="activity-text">
            <strong>${activity.personName}</strong> ${actionText}
          </div>
          <div class="activity-meta">
            <span class="activity-time">${this.formatTime(activity.timestamp)}</span>
            <span class="activity-role">${activity.personRole}</span>
          </div>
        </div>
        ${!this.bulkSelectMode && isUndoable ? `
          <button class="btn btn-icon undo-btn" onclick="window.ActivityModule.handleUndoActivity('${activity.id}')" 
                  title="Undo this action">
            <span class="material-icons">undo</span>
          </button>
        ` : ''}
        ${!this.bulkSelectMode ? `
          <button class="btn btn-icon delete-btn" onclick="window.ActivityModule.handleDeleteActivity('${activity.id}')" 
                  title="Delete this entry">
            <span class="material-icons">delete</span>
          </button>
        ` : ''}
      </div>
    `;
  }

  getActivityDisplayInfo(activity) {
    const displays = {
      'check-in': { icon: 'login', color: 'success', actionText: 'checked in' },
      'check-out': { icon: 'logout', color: 'info', actionText: 'checked out' },
      'add-person': { icon: 'person_add', color: 'primary', actionText: 'was added to the system' },
      'emergency-checkout': { icon: 'warning', color: 'error', actionText: 'was checked out due to emergency' },
      'bulk-checkout': { icon: 'group', color: 'warning', actionText: 'was checked out (bulk operation)' },
      'system': { icon: 'settings', color: 'outline', actionText: activity.action || 'system action' }
    };
    
    return displays[activity.type] || displays['system'];
  }

  isUndoable(activity) {
    const undoableTypes = ['check-in', 'check-out'];
    const timeLimit = 5 * 60 * 1000; // 5 minutes
    const timeSinceAction = Date.now() - activity.timestamp;
    
    return undoableTypes.includes(activity.type) && timeSinceAction < timeLimit;
  }

  async handleUndoActivity(activityId) {
    const activity = this.activityLog.find(a => a.id === activityId);
    if (!activity || !this.isUndoable(activity)) return;

    try {
      await this.performUndo(activity);
      if (window.CoreModule) {
        window.CoreModule.showToast(`Undid: ${activity.personName} ${activity.action}`, 'success');
      }
    } catch (error) {
      console.error('[Activity] Error undoing activity:', error);
      if (window.CoreModule) {
        window.CoreModule.showError('Failed to undo action');
      }
    }
  }

  async performUndo(activity) {
    if (!window.PersonnelModule) return;

    const person = window.PersonnelModule.getPersonById(activity.personId);
    if (!person) throw new Error('Person not found');

    // Reverse the action
    if (activity.type === 'check-in') {
      person.status = 'checked-out';
      delete person.checkInTime;
    } else if (activity.type === 'check-out') {
      person.status = 'checked-in';
      person.checkInTime = Date.now();
      delete person.checkOutTime;
    }

    // Save personnel changes
    await window.PersonnelModule.savePersonnelData();

    // Remove the activity from log
    this.activityLog = this.activityLog.filter(a => a.id !== activity.id);
    this.filteredActivities = [...this.activityLog];
    await this.saveActivityData();

    // Update UI
    this.updateActivityPage();
    if (window.app && window.app.updateDashboard) {
      await window.app.updateDashboard();
    }
  }

  applyActivityFilters() {
    const filterType = document.getElementById('activity-filter')?.value || 'all';
    const filterDate = document.getElementById('activity-date-filter')?.value;
    
    let filtered = [...this.activityLog];
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(activity => activity.type === filterType);
    }
    
    // Filter by date
    if (filterDate) {
      const selectedDate = new Date(filterDate).toDateString();
      filtered = filtered.filter(activity => {
        return new Date(activity.timestamp).toDateString() === selectedDate;
      });
    }
    
    this.filteredActivities = filtered;
    this.updateActivityPage();
  }

  toggleBulkSelect() {
    this.bulkSelectMode = !this.bulkSelectMode;
    this.selectedActivities.clear();
    
    const bulkBtn = document.getElementById('bulk-select-btn');
    if (bulkBtn) {
      bulkBtn.textContent = this.bulkSelectMode ? 'Cancel' : 'Select';
      bulkBtn.classList.toggle('active', this.bulkSelectMode);
    }
    
    this.updateActivityPage();
  }

  toggleActivitySelection(activityId) {
    if (this.selectedActivities.has(activityId)) {
      this.selectedActivities.delete(activityId);
    } else {
      this.selectedActivities.add(activityId);
    }
    this.updateBulkControls();
  }

  updateBulkControls() {
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.style.display = this.selectedActivities.size > 0 ? 'block' : 'none';
    }
  }

  async handleBulkDelete() {
    if (this.selectedActivities.size === 0) return;

    const confirmed = await this.showConfirmDialog(
      'Delete Selected Activities',
      `Are you sure you want to delete ${this.selectedActivities.size} selected activities? This action cannot be undone.`
    );

    if (confirmed) {
      this.activityLog = this.activityLog.filter(a => !this.selectedActivities.has(a.id));
      this.filteredActivities = [...this.activityLog];
      await this.saveActivityData();
      
      this.selectedActivities.clear();
      this.toggleBulkSelect();
      
      if (window.CoreModule) {
        window.CoreModule.showToast('Selected activities deleted', 'success');
      }
    }
  }

  async handleDeleteActivity(activityId) {
    const confirmed = await this.showConfirmDialog(
      'Delete Activity',
      'Are you sure you want to delete this activity? This action cannot be undone.'
    );

    if (confirmed) {
      this.activityLog = this.activityLog.filter(a => a.id !== activityId);
      this.filteredActivities = [...this.activityLog];
      await this.saveActivityData();
      
      this.updateActivityPage();
      
      if (window.CoreModule) {
        window.CoreModule.showToast('Activity deleted', 'success');
      }
    }
  }

  async handleClearActivityLog() {
    const confirmed = await this.showConfirmDialog(
      'Clear Activity Log',
      'Are you sure you want to clear the entire activity log? This action cannot be undone.'
    );

    if (confirmed) {
      this.activityLog = [];
      this.filteredActivities = [];
      await this.saveActivityData();
      
      this.updateActivityPage();
      
      if (window.CoreModule) {
        window.CoreModule.showToast('Activity log cleared', 'success');
      }
    }
  }

  updateActivityPage() {
    const container = document.getElementById('activity-list');
    if (!container) return;

    if (this.filteredActivities.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons">history</span>
          <h3>No Activities</h3>
          <p>Activities will appear here as people check in and out</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();
    this.filteredActivities.forEach(activity => {
      const activityElement = document.createElement('div');
      activityElement.innerHTML = this.createActivityItem(activity);
      fragment.appendChild(activityElement.firstElementChild);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
  }

  async showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const modal = `
        <div class="confirm-dialog">
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="modal-actions">
            <button class="btn btn-outline" onclick="window.ActivityModule.resolveConfirm(false)">Cancel</button>
            <button class="btn btn-primary" onclick="window.ActivityModule.resolveConfirm(true)">Confirm</button>
          </div>
        </div>
      `;
      
      this.confirmResolve = resolve;
      if (window.CoreModule) {
        window.CoreModule.showModal(modal);
      }
    });
  }

  resolveConfirm(result) {
    if (this.confirmResolve) {
      this.confirmResolve(result);
      this.confirmResolve = null;
    }
    if (window.CoreModule) {
      window.CoreModule.closeModal();
    }
  }

  getActivityLog() {
    return this.activityLog;
  }

  getActivityStats() {
    const total = this.activityLog.length;
    const checkIns = this.activityLog.filter(a => a.type === 'check-in').length;
    const checkOuts = this.activityLog.filter(a => a.type === 'check-out').length;
    const newPersons = this.activityLog.filter(a => a.type === 'add-person').length;
    
    return { total, checkIns, checkOuts, newPersons };
  }
}

// Export for global use
window.ActivityModule = new ActivityModule();
console.log('[Activity] Activity module loaded');
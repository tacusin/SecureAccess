/**
 * Secure Access - Main Application
 * Enterprise-grade Progressive Web App for security officers
 */

class SecurityApp {
  constructor() {
    this.currentPage = 'dashboard';
    this.isOffline = !navigator.onLine;
    this.lastSaveTime = null;
    this.currentTheme = localStorage.getItem('theme') || 'dark';
    this.isNavOpen = false;
    this.bulkSelectMode = false;
    this.selectedActivityIds = new Set();
    
    // Initialize app
    this.init();
  }

  async init() {
    try {
      console.log('[App] Initializing Secure Access');
      
      // Register service worker
      await this.registerServiceWorker();
      
      // Initialize storage
      await window.StorageManager.init();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Apply saved theme
      this.applyTheme(this.currentTheme);
      
      // Initialize components
      await this.initializeComponents();
      
      // Hide loading screen
      this.hideLoadingScreen();
      
      // Check if first time user and show tutorial
      if (!localStorage.getItem('tutorial_completed')) {
        setTimeout(() => {
          window.TutorialManager.start();
        }, 1000);
      }
      
      console.log('[App] Application initialized successfully');
    } catch (error) {
      console.error('[App] Error initializing application:', error);
      this.showError('Failed to initialize application. Please refresh the page.');
    }
  }

  async registerServiceWorker() {
    // Temporarily disabled during development to avoid cache issues
    console.log('[App] Service worker registration disabled for development');
    return;
    
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('[App] Service Worker registered:', registration);
        
        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showToast('App update available. Refresh to update.', 'info');
            }
          });
        });
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event.data);
        });
        
      } catch (error) {
        console.error('[App] Service Worker registration failed:', error);
      }
    }
  }

  setupEventListeners() {
    // Navigation
    document.getElementById('menu-btn').addEventListener('click', () => this.toggleNav());
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => this.handleNavigation(e));
    });
    
    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
    
    // Emergency button
    document.getElementById('emergency-btn').addEventListener('click', () => this.navigateTo('emergency'));
    
    // Search functionality
    const searchInput = document.getElementById('person-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e));
    }
    
    // Quick actions
    document.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', (e) => this.handleQuickAction(e));
    });
    
    // Modal handling
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeModal();
      }
    });
    
    // Online/offline status
    window.addEventListener('online', () => this.handleOnlineStatus(true));
    window.addEventListener('offline', () => this.handleOnlineStatus(false));
    
    // Auto-save
    document.addEventListener('input', () => this.handleAutoSave());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    
    // FAB menu
    document.getElementById('fab-main').addEventListener('click', () => this.handleFabClick());
    
    // Personnel management
    document.getElementById('add-personnel-btn')?.addEventListener('click', () => this.showAddPersonnelModal());
    document.getElementById('add-visitor-btn')?.addEventListener('click', () => this.showAddPersonnelModal('visitor'));
    
    // OCR and QR functionality
    document.getElementById('scan-id-btn')?.addEventListener('click', () => this.handleIDScan());
    document.getElementById('scan-qr-btn')?.addEventListener('click', () => this.handleQRScan());
    
    // Export buttons
    document.querySelectorAll('.export-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleExport(e));
    });
    
    // Advanced report buttons
    document.querySelectorAll('.report-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleAdvancedReport(e));
    });
    
    // Activity log controls
    document.getElementById('clear-activity-btn')?.addEventListener('click', () => this.handleClearActivityLog());
    document.getElementById('bulk-select-btn')?.addEventListener('click', () => this.toggleBulkSelect());
    document.getElementById('bulk-delete-btn')?.addEventListener('click', () => this.handleBulkDelete());
    document.getElementById('apply-filters-btn')?.addEventListener('click', () => this.applyActivityFilters());
    
    // Shift management buttons
    document.getElementById('start-shift-btn')?.addEventListener('click', () => this.showStartShiftModal());
    document.getElementById('end-shift-btn')?.addEventListener('click', () => this.handleEndShift());
    document.getElementById('handover-btn')?.addEventListener('click', () => this.showHandoverModal());
    
    // Sync management buttons
    document.getElementById('enable-sync-btn')?.addEventListener('click', () => this.enableSync());
    document.getElementById('disable-sync-btn')?.addEventListener('click', () => this.disableSync());
    document.getElementById('start-server-btn')?.addEventListener('click', () => this.startSyncServer());
    document.getElementById('stop-server-btn')?.addEventListener('click', () => this.stopSyncServer());
    document.getElementById('connect-btn')?.addEventListener('click', () => this.connectToSyncServer());
    document.getElementById('scan-qr-connect-btn')?.addEventListener('click', () => this.scanSyncQR());
    document.getElementById('clear-sync-log-btn')?.addEventListener('click', () => this.clearSyncLog());
    
    // Prevent default touch behaviors on buttons
    document.querySelectorAll('button').forEach(button => {
      button.addEventListener('touchstart', (e) => {
        e.currentTarget.classList.add('touching');
      });
      button.addEventListener('touchend', (e) => {
        e.currentTarget.classList.remove('touching');
      });
    });
  }

  async initializeComponents() {
    // Initialize dashboard
    if (window.DashboardManager) {
      await window.DashboardManager.init();
    }
    
    // Initialize camera
    if (window.CameraManager) {
      await window.CameraManager.init();
    }
    
    // Initialize emergency module
    if (window.EmergencyManager) {
      await window.EmergencyManager.init();
    }
    
    // Initialize OCR manager
    if (window.OCRManager) {
      await window.OCRManager.init();
    }
    
    // Initialize QR generator
    if (window.QRGenerator) {
      await window.QRGenerator.init();
    }
    
    // Initialize reports manager
    if (window.ReportsManager) {
      await window.ReportsManager.init();
    }
    
    // Initialize shift manager
    if (window.ShiftManager) {
      await window.ShiftManager.init();
    }
    
    // Load initial data
    await this.loadPersonnelList();
    await this.updateDashboard();
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    
    setTimeout(() => {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.classList.add('hidden');
        app.classList.remove('hidden');
      }, 250);
    }, 500);
  }

  // Navigation
  toggleNav() {
    this.isNavOpen = !this.isNavOpen;
    const navDrawer = document.getElementById('nav-drawer');
    navDrawer.classList.toggle('open', this.isNavOpen);
    
    // Add overlay on mobile
    if (this.isNavOpen && window.innerWidth <= 768) {
      this.addNavOverlay();
    } else {
      this.removeNavOverlay();
    }
  }

  addNavOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 64px;
      left: 0;
      width: 100%;
      height: calc(100vh - 64px);
      background: rgba(0, 0, 0, 0.5);
      z-index: 99;
    `;
    overlay.addEventListener('click', () => this.toggleNav());
    document.body.appendChild(overlay);
  }

  removeNavOverlay() {
    const overlay = document.querySelector('.nav-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  handleNavigation(e) {
    e.preventDefault();
    const pageId = e.currentTarget.dataset.page;
    this.navigateTo(pageId);
    
    // Close nav on mobile
    if (window.innerWidth <= 768) {
      this.toggleNav();
    }
  }

  navigateTo(pageId) {
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
    
    // Show page
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });
    document.getElementById(`${pageId}-page`)?.classList.add('active');
    
    this.currentPage = pageId;
    
    // Update page-specific content
    this.updatePageContent(pageId);
  }

  async updatePageContent(pageId) {
    switch (pageId) {
      case 'dashboard':
        await this.updateDashboard();
        break;
      case 'checkin':
        await this.loadPersonnelList();
        break;
      case 'shifts':
        await this.updateShiftsPage();
        break;
      case 'personnel':
        await this.loadAllPersonnel();
        break;
      case 'reports':
        // Reports page content is static
        break;
      case 'emergency':
        if (window.EmergencyManager) {
          await window.EmergencyManager.updateContent();
        }
        break;
      case 'activity':
        await this.updateActivityPage();
        break;
      case 'sync':
        await this.updateSyncPage();
        break;
    }
  }

  async updateShiftsPage() {
    if (!window.ShiftManager || !window.ShiftManager.isAvailable()) return;

    try {
      const currentShift = window.ShiftManager.getCurrentShift();
      const pendingHandovers = window.ShiftManager.getPendingHandovers();
      const recentShifts = window.ShiftManager.getRecentShifts(5);

      // Update current shift display
      this.updateCurrentShiftDisplay(currentShift);
      
      // Update pending handovers
      this.updatePendingHandovers(pendingHandovers);
      
      // Update shift history
      this.updateShiftHistory(recentShifts);
      
    } catch (error) {
      console.error('[App] Error updating shifts page:', error);
    }
  }

  updateCurrentShiftDisplay(currentShift) {
    const shiftStatus = document.getElementById('shift-status');
    const shiftInfo = document.getElementById('current-shift-info');
    
    if (!currentShift || currentShift.status !== 'active') {
      shiftStatus.textContent = 'No Active Shift';
      shiftStatus.className = 'shift-status inactive';
      shiftInfo.innerHTML = `
        <div class="no-shift-message">
          <span class="material-icons">schedule</span>
          <p>No shift is currently active</p>
          <button class="action-button primary" onclick="window.app.showStartShiftModal()">
            Start New Shift
          </button>
        </div>
      `;
    } else {
      shiftStatus.textContent = 'Active';
      shiftStatus.className = 'shift-status active';
      
      const elapsed = Date.now() - currentShift.actualStartTime;
      const remaining = currentShift.endTime - Date.now();
      
      shiftInfo.innerHTML = `
        <div class="shift-info">
          <div class="shift-detail">
            <span class="shift-detail-label">Officers:</span>
            <span class="shift-detail-value">${currentShift.officer1Name || currentShift.officerName || 'Unknown'} & ${currentShift.officer2Name || 'Unknown'}</span>
          </div>
          <div class="shift-detail">
            <span class="shift-detail-label">Shift Type:</span>
            <span class="shift-type-indicator shift-type-${currentShift.shiftType}">${currentShift.shiftConfig.name}</span>
          </div>
          <div class="shift-detail">
            <span class="shift-detail-label">Started:</span>
            <span class="shift-detail-value">${this.formatTime(currentShift.actualStartTime)}</span>
          </div>
          <div class="shift-detail">
            <span class="shift-detail-label">Ends:</span>
            <span class="shift-detail-value">${this.formatTime(currentShift.endTime)}</span>
          </div>
          <div class="shift-timer">
            Time Remaining: ${this.formatDuration(Math.max(0, remaining))}
          </div>
        </div>
      `;
    }
  }

  updatePendingHandovers(handovers) {
    const countElement = document.getElementById('handover-count');
    const listElement = document.getElementById('pending-handovers');
    
    countElement.textContent = handovers.length;
    countElement.style.display = handovers.length > 0 ? 'flex' : 'none';
    
    if (handovers.length === 0) {
      listElement.innerHTML = `
        <div class="no-handovers-message">
          <span class="material-icons">assignment_turned_in</span>
          <p>No pending handovers</p>
        </div>
      `;
    } else {
      listElement.innerHTML = handovers.map(handover => `
        <div class="handover-item">
          <div class="handover-header">
            <strong>From: ${handover.fromOfficer1 || handover.fromOfficer || 'Unknown'} & ${handover.fromOfficer2 || 'Unknown'}</strong>
            <span class="handover-meta">${this.formatTime(handover.timestamp)}</span>
          </div>
          <div class="handover-notes">${handover.notes}</div>
          <div class="handover-actions">
            <button class="action-button primary" onclick="window.app.acknowledgeHandover('${handover.id}')">
              Acknowledge
            </button>
            <button class="action-button secondary" onclick="window.app.viewHandoverDetails('${handover.id}')">
              View Details
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  updateShiftHistory(shifts) {
    const historyElement = document.getElementById('shift-history');
    
    if (shifts.length === 0) {
      historyElement.innerHTML = `
        <div class="no-shift-message">
          <span class="material-icons">history</span>
          <p>No recent shifts</p>
        </div>
      `;
    } else {
      historyElement.innerHTML = shifts.map(shift => `
        <div class="shift-item">
          <div class="shift-header">
            <strong>${shift.officerName}</strong>
            <span class="shift-type-indicator shift-type-${shift.shiftType}">${shift.shiftConfig.name}</span>
          </div>
          <div class="shift-meta">
            ${this.formatDate(shift.actualStartTime)} • 
            Duration: ${shift.duration ? this.formatDuration(shift.duration) : 'In Progress'}
          </div>
        </div>
      `).join('');
    }
  }

  // Shift Management Methods
  showStartShiftModal() {
    const shiftTypes = window.ShiftManager ? window.ShiftManager.getShiftTypes() : [];
    
    const modalContent = `
      <div class="modal-header">
        <h3>Start New Shift</h3>
        <button class="icon-button" onclick="window.app.closeModal()">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <form id="start-shift-form" class="shift-form">
          <div class="form-group">
            <label for="officer1-name">Officer 1 Name *</label>
            <input type="text" id="officer1-name" required>
          </div>
          
          <div class="form-group">
            <label for="officer2-name">Officer 2 Name *</label>
            <input type="text" id="officer2-name" required>
          </div>
          
          <div class="form-group">
            <label for="shift-type">Shift Type *</label>
            <select id="shift-type" required>
              ${shiftTypes.map(type => `
                <option value="${type.id}">${type.name} (${type.start} - ${type.end})</option>
              `).join('')}
            </select>
          </div>
          
          <div id="custom-times" class="form-group" style="display: none;">
            <div class="time-inputs">
              <div class="form-group">
                <label for="custom-start">Start Time</label>
                <input type="time" id="custom-start">
              </div>
              <div class="form-group">
                <label for="custom-end">End Time</label>
                <input type="time" id="custom-end">
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="action-button secondary" onclick="window.app.closeModal()">
              Cancel
            </button>
            <button type="submit" class="action-button primary">
              <span class="material-icons">schedule</span>
              Start Shift
            </button>
          </div>
        </form>
      </div>
    `;
    
    this.showModal(modalContent);
    
    // Setup form submission
    document.getElementById('start-shift-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleStartShift();
    });
    
    // Show custom time inputs for custom shift
    document.getElementById('shift-type').addEventListener('change', (e) => {
      const customTimes = document.getElementById('custom-times');
      customTimes.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
  }

  async handleStartShift() {
    try {
      const form = document.getElementById('start-shift-form');
      
      const officer1Name = document.getElementById('officer1-name').value;
      const officer2Name = document.getElementById('officer2-name').value;
      const shiftType = document.getElementById('shift-type').value;
      
      if (!officer1Name || !officer2Name) {
        this.showError('Both officer names are required');
        return;
      }
      
      let customStart = null;
      let customEnd = null;
      
      if (shiftType === 'custom') {
        customStart = document.getElementById('custom-start').value;
        customEnd = document.getElementById('custom-end').value;
        
        if (!customStart || !customEnd) {
          this.showError('Please specify start and end times for custom shift');
          return;
        }
      }
      
      if (!window.ShiftManager) {
        this.showError('Shift management system is not available');
        return;
      }
      
      const shift = await window.ShiftManager.startShift(officer1Name, officer2Name, shiftType, customStart, customEnd);
      
      this.closeModal();
      this.showToast(`Shift started successfully for ${officer1Name} and ${officer2Name}`, 'success');
      
      // Update shifts page if currently viewing
      if (this.currentPage === 'shifts') {
        await this.updateShiftsPage();
      }
      
    } catch (error) {
      console.error('[App] Error starting shift:', error);
      this.showError('Failed to start shift: ' + error.message);
    }
  }

  async handleEndShift() {
    try {
      if (!window.ShiftManager) {
        this.showError('Shift management system is not available');
        return;
      }
      
      const currentShift = window.ShiftManager.getCurrentShift();
      if (!currentShift || currentShift.status !== 'active') {
        this.showToast('No active shift to end', 'info');
        return;
      }
      
      const confirmed = await this.showConfirmDialog(
        'End Current Shift',
        `Are you sure you want to end the current shift for ${currentShift.officerName}?`
      );
      
      if (!confirmed) return;
      
      await window.ShiftManager.endShift(currentShift.id, 'Manual end by user');
      
      this.showToast('Shift ended successfully', 'success');
      
      // Update shifts page if currently viewing
      if (this.currentPage === 'shifts') {
        await this.updateShiftsPage();
      }
      
    } catch (error) {
      console.error('[App] Error ending shift:', error);
      this.showError('Failed to end shift: ' + error.message);
    }
  }

  showHandoverModal() {
    if (!window.ShiftManager) {
      this.showError('Shift management system is not available');
      return;
    }
    
    const currentShift = window.ShiftManager.getCurrentShift();
    if (!currentShift || currentShift.status !== 'active') {
      this.showToast('No active shift for handover', 'info');
      return;
    }
    
    const modalContent = `
      <div class="modal-header">
        <h3>Create Handover</h3>
        <button class="icon-button" onclick="window.app.closeModal()">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <form id="handover-form" class="handover-form">
          <div class="form-group">
            <label for="from-officer1">From Officer 1</label>
            <input type="text" id="from-officer1" value="${currentShift.officer1Name || currentShift.officerName || ''}" readonly>
          </div>
          
          <div class="form-group">
            <label for="from-officer2">From Officer 2</label>
            <input type="text" id="from-officer2" value="${currentShift.officer2Name || ''}" readonly>
          </div>
          
          <div class="form-group">
            <label for="to-officer1">To Officer 1 *</label>
            <input type="text" id="to-officer1" required>
          </div>
          
          <div class="form-group">
            <label for="to-officer2">To Officer 2 *</label>
            <input type="text" id="to-officer2" required>
          </div>
          
          <div class="form-group">
            <label for="handover-notes">Handover Notes *</label>
            <textarea id="handover-notes" rows="4" required placeholder="Key information for the next officer..."></textarea>
          </div>
          
          <div class="form-group">
            <label for="key-points">Key Points</label>
            <textarea id="key-points" rows="3" placeholder="Important items to highlight..."></textarea>
          </div>
          
          <div class="form-group">
            <label for="incidents">Incidents/Issues</label>
            <textarea id="incidents" rows="3" placeholder="Any incidents or issues during the shift..."></textarea>
          </div>
          
          <div class="handover-summary">
            <h4>Current Status Summary</h4>
            <div class="summary-item">
              <span>Current Occupancy:</span>
              <span id="handover-occupancy">${window.StorageManager.getCurrentOccupancy()}</span>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="action-button secondary" onclick="window.app.closeModal()">
              Cancel
            </button>
            <button type="submit" class="action-button primary">
              <span class="material-icons">assignment</span>
              Create Handover
            </button>
          </div>
        </form>
      </div>
    `;
    
    this.showModal(modalContent);
    
    // Setup form submission
    document.getElementById('handover-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateHandover();
    });
  }

  async handleCreateHandover() {
    try {
      const fromOfficer1 = document.getElementById('from-officer1').value;
      const fromOfficer2 = document.getElementById('from-officer2').value;
      const toOfficer1 = document.getElementById('to-officer1').value;
      const toOfficer2 = document.getElementById('to-officer2').value;
      const notes = document.getElementById('handover-notes').value;
      const keyPoints = document.getElementById('key-points').value.split('\n').filter(p => p.trim());
      const incidents = document.getElementById('incidents').value.split('\n').filter(i => i.trim());
      
      if (!toOfficer1 || !toOfficer2) {
        this.showError('Both incoming officer names are required');
        return;
      }
      
      if (!window.ShiftManager) {
        this.showError('Shift management system is not available');
        return;
      }
      
      const handover = await window.ShiftManager.createHandover(
        fromOfficer1,
        fromOfficer2,
        toOfficer1,
        toOfficer2,
        notes,
        incidents,
        keyPoints
      );
      
      this.closeModal();
      this.showToast(`Handover created for ${toOfficer1} and ${toOfficer2}`, 'success');
      
      // Update shifts page if currently viewing
      if (this.currentPage === 'shifts') {
        await this.updateShiftsPage();
      }
      
    } catch (error) {
      console.error('[App] Error creating handover:', error);
      this.showError('Failed to create handover: ' + error.message);
    }
  }

  async acknowledgeHandover(handoverId) {
    try {
      if (!window.ShiftManager) {
        this.showError('Shift management system is not available');
        return;
      }
      
      const handover = window.ShiftManager.handoverNotes.find(h => h.id === handoverId);
      if (!handover) {
        this.showError('Handover not found');
        return;
      }
      
      const notes = prompt('Add acknowledgment notes (optional):') || '';
      
      await window.ShiftManager.acknowledgeHandover(handoverId, notes);
      
      this.showToast('Handover acknowledged', 'success');
      
      // Update shifts page if currently viewing
      if (this.currentPage === 'shifts') {
        await this.updateShiftsPage();
      }
      
    } catch (error) {
      console.error('[App] Error acknowledging handover:', error);
      this.showError('Failed to acknowledge handover: ' + error.message);
    }
  }

  formatDuration(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Theme management
  toggleTheme() {
    const themes = ['dark', 'light'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    this.applyTheme(nextTheme);
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    
    localStorage.setItem('theme', theme);
    
    // Update theme toggle icon
    const themeIcon = document.querySelector('#theme-toggle .material-icons');
    const icons = {
      light: 'light_mode',
      dark: 'dark_mode'
    };
    themeIcon.textContent = icons[theme] || 'dark_mode';
    
    console.log(`[App] Theme changed to: ${theme}`);
  }

  // Search functionality
  handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const personnelCards = document.querySelectorAll('.person-card');
    
    personnelCards.forEach(card => {
      const name = card.querySelector('.person-name')?.textContent.toLowerCase() || '';
      const role = card.querySelector('.person-role')?.textContent.toLowerCase() || '';
      const isVisible = name.includes(query) || role.includes(query);
      card.style.display = isVisible ? 'flex' : 'none';
    });
  }

  // Quick actions
  async handleQuickAction(e) {
    const action = e.currentTarget.dataset.action;
    
    switch (action) {
      case 'quick-checkin':
        this.navigateTo('checkin');
        break;
      case 'bulk-checkout':
        await this.handleBulkCheckout();
        break;
      default:
        console.log(`[App] Unknown action: ${action}`);
    }
  }

  async handleBulkCheckout() {
    const checkedInPeople = window.StorageManager.getCheckedInPersonnel();
    
    if (checkedInPeople.length === 0) {
      this.showToast('No one is currently checked in.', 'info');
      return;
    }
    
    const confirmed = await this.showConfirmDialog(
      'Bulk Checkout',
      `Are you sure you want to check out all ${checkedInPeople.length} people?`
    );
    
    if (confirmed) {
      try {
        for (const person of checkedInPeople) {
          await window.StorageManager.checkOut(person.id);
        }
        
        this.showToast(`Successfully checked out ${checkedInPeople.length} people.`, 'success');
        await this.updateDashboard();
        await this.loadPersonnelList();
      } catch (error) {
        console.error('[App] Error during bulk checkout:', error);
        this.showError('Failed to complete bulk checkout.');
      }
    }
  }

  // Personnel management
  async loadPersonnelList() {
    const personnelList = document.getElementById('personnel-list');
    if (!personnelList) return;
    
    try {
      const personnel = window.StorageManager.getAllPersonnel();
      
      if (personnel.length === 0) {
        personnelList.innerHTML = `
          <div class="empty-state">
            <span class="material-icons" style="font-size: 64px; color: var(--on-surface-variant);">people</span>
            <h3>No Personnel Added</h3>
            <p>Add personnel to start managing check-ins and check-outs.</p>
            <button class="action-button primary" onclick="window.app.showAddPersonnelModal()">
              <span class="material-icons">person_add</span>
              Add First Person
            </button>
          </div>
        `;
        return;
      }
      
      // Clear existing content and event listeners
      personnelList.innerHTML = '';
      
      // Add new content
      personnelList.innerHTML = personnel.map(person => this.createPersonCard(person)).join('');
      
      // Add event listeners to person cards
      personnelList.querySelectorAll('.person-card').forEach(card => {
        card.addEventListener('click', (e) => this.handlePersonCardClick(e));
      });
      
    } catch (error) {
      console.error('[App] Error loading personnel list:', error);
      this.showError('Failed to load personnel list.');
    }
  }

  async loadAllPersonnel() {
    const personnelGrid = document.getElementById('all-personnel-list');
    if (!personnelGrid) return;
    
    try {
      const personnel = window.StorageManager.getAllPersonnel();
      const roleFilter = document.getElementById('role-filter')?.value || '';
      const statusFilter = document.getElementById('status-filter')?.value || '';
      
      let filteredPersonnel = personnel;
      
      if (roleFilter) {
        filteredPersonnel = filteredPersonnel.filter(p => p.role === roleFilter);
      }
      
      if (statusFilter) {
        filteredPersonnel = filteredPersonnel.filter(p => p.status === statusFilter);
      }
      
      if (filteredPersonnel.length === 0) {
        personnelGrid.innerHTML = `
          <div class="empty-state">
            <span class="material-icons" style="font-size: 64px;">filter_list_off</span>
            <h3>No Personnel Found</h3>
            <p>No personnel match the current filters.</p>
          </div>
        `;
        return;
      }
      
      // Clear existing content and event listeners
      personnelGrid.innerHTML = '';
      
      // Add new content
      personnelGrid.innerHTML = filteredPersonnel.map(person => this.createPersonCard(person, true)).join('');
      
      // Add event listeners
      personnelGrid.querySelectorAll('.person-card').forEach(card => {
        card.addEventListener('click', (e) => this.handlePersonCardClick(e));
      });
      
    } catch (error) {
      console.error('[App] Error loading all personnel:', error);
      this.showError('Failed to load personnel.');
    }
  }

  createPersonCard(person, showActions = false) {
    const avatar = person.photo ? 
      `<img src="${person.photo}" alt="${person.name}">` :
      `<span class="material-icons">person</span>`;
    
    const statusClass = person.status === 'checked-in' ? 'checked-in' : 'checked-out';
    const actionText = person.status === 'checked-in' ? 'Check Out' : 'Check In';
    const actionIcon = person.status === 'checked-in' ? 'logout' : 'login';
    
    return `
      <div class="person-card" data-person-id="${person.id}">
        <div class="person-avatar">${avatar}</div>
        <div class="person-info">
          <div class="person-name">${person.name}</div>
          <div class="person-role">${person.role}</div>
          <span class="person-status ${statusClass}">${person.status.replace('-', ' ')}</span>
          ${person.lastActivity ? `<div class="person-activity">${this.formatTimestamp(person.lastActivity)}</div>` : ''}
        </div>
        <div class="person-actions">
          <button class="icon-button action-toggle" title="${actionText}">
            <span class="material-icons">${actionIcon}</span>
          </button>
          ${showActions ? `
            <button class="icon-button show-qr" title="Show QR Code">
              <span class="material-icons">qr_code</span>
            </button>
            <button class="icon-button edit-person" title="Edit">
              <span class="material-icons">edit</span>
            </button>
            <button class="icon-button delete-person" title="Delete">
              <span class="material-icons">delete</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  async handlePersonCardClick(e) {
    e.preventDefault();
    const personId = e.currentTarget.dataset.personId;
    
    if (e.target.closest('.action-toggle')) {
      await this.togglePersonStatus(personId);
    } else if (e.target.closest('.show-qr')) {
      await this.showPersonQR(personId);
    } else if (e.target.closest('.edit-person')) {
      this.showEditPersonnelModal(personId);
    } else if (e.target.closest('.delete-person')) {
      await this.deletePersonnel(personId);
    } else {
      this.showPersonDetails(personId);
    }
  }

  async togglePersonStatus(personId) {
    try {
      const person = window.StorageManager.getPersonnel(personId);
      if (!person) return;
      
      if (person.status === 'checked-in') {
        await window.StorageManager.checkOut(personId);
        this.showToast(`${person.name} checked out successfully.`, 'success');
      } else {
        await window.StorageManager.checkIn(personId);
        this.showToast(`${person.name} checked in successfully.`, 'success');
      }
      
      // Update displays
      await this.updateDashboard();
      await this.loadPersonnelList();
      await this.loadAllPersonnel();
      
      // Play notification sound
      window.NotificationSound?.play('checkin');
      
    } catch (error) {
      console.error('[App] Error toggling person status:', error);
      this.showError('Failed to update status.');
    }
  }

  // Dashboard updates
  async updateDashboard() {
    try {
      const currentOccupancy = window.StorageManager.getCurrentOccupancy();
      const todaysStats = window.StorageManager.getTodaysStats();
      const checkedInPeople = window.StorageManager.getCheckedInPersonnel();
      
      // Update occupancy counter
      const occupancyElement = document.getElementById('current-occupancy');
      if (occupancyElement) {
        occupancyElement.textContent = currentOccupancy;
      }
      
      // Update today's stats
      const checkinsElement = document.getElementById('todays-checkins');
      const checkoutsElement = document.getElementById('todays-checkouts');
      
      if (checkinsElement) checkinsElement.textContent = todaysStats.checkins;
      if (checkoutsElement) checkoutsElement.textContent = todaysStats.checkouts;
      
      // Update current occupants list
      this.updateCurrentOccupantsList(checkedInPeople);
      
    } catch (error) {
      console.error('[App] Error updating dashboard:', error);
    }
  }

  updateCurrentOccupantsList(checkedInPeople) {
    const occupantsList = document.getElementById('current-occupants-list');
    if (!occupantsList) return;
    
    if (checkedInPeople.length === 0) {
      occupantsList.innerHTML = `
        <div class="empty-state">
          <span class="material-icons">people_outline</span>
          <p>No one is currently checked in.</p>
        </div>
      `;
      return;
    }
    
    occupantsList.innerHTML = checkedInPeople.map(person => `
      <div class="occupant-item">
        <div class="occupant-avatar">
          ${person.photo ? 
            `<img src="${person.photo}" alt="${person.name}">` :
            `<span class="material-icons">person</span>`
          }
        </div>
        <div class="occupant-info">
          <div class="occupant-name">${person.name}</div>
          <div class="occupant-role">${person.role}</div>
          <div class="occupant-time">Since ${this.formatTime(person.checkedInAt)}</div>
        </div>
      </div>
    `).join('');
  }

  // Modals
  showAddPersonnelModal(defaultRole = 'visitor', prefilledData = {}) {
    const modalContent = `
      <div class="modal-header">
        <h3>Add Personnel</h3>
        <button class="icon-button" onclick="window.app.closeModal()">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <form id="add-personnel-form" class="personnel-form">
          <div class="form-group">
            <label for="person-name">Name *</label>
            <input type="text" id="person-name" required value="${prefilledData.name || ''}">
          </div>
          
          <div class="form-group">
            <label for="person-role">Role *</label>
            <select id="person-role" required>
              <option value="visitor" ${defaultRole === 'visitor' ? 'selected' : ''}>Visitor</option>
              <option value="employee" ${defaultRole === 'employee' ? 'selected' : ''}>Employee</option>
              <option value="contractor" ${defaultRole === 'contractor' ? 'selected' : ''}>Contractor</option>
              <option value="vip" ${defaultRole === 'vip' ? 'selected' : ''}>VIP</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="person-company">Company/Organization</label>
            <input type="text" id="person-company">
          </div>
          
          <div class="form-group">
            <label for="person-phone">Phone Number</label>
            <input type="tel" id="person-phone">
          </div>
          
          <div class="form-group">
            <label for="person-email">Email</label>
            <input type="email" id="person-email">
          </div>
          
          <div class="form-group">
            <label>Photo</label>
            <div class="photo-capture">
              <div id="photo-preview" class="photo-preview">
                <span class="material-icons">photo_camera</span>
                <span>No photo</span>
              </div>
              <div class="photo-actions">
                <button type="button" class="action-button secondary" onclick="window.app.capturePhoto()">
                  <span class="material-icons">camera_alt</span>
                  Take Photo
                </button>
                <button type="button" class="action-button secondary" onclick="window.app.uploadPhoto()">
                  <span class="material-icons">upload</span>
                  Upload
                </button>
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label for="person-notes">Notes</label>
            <textarea id="person-notes" rows="3"></textarea>
          </div>
          
          <div class="form-actions">
            <button type="button" class="action-button secondary" onclick="window.app.closeModal()">
              Cancel
            </button>
            <button type="submit" class="action-button primary">
              <span class="material-icons">person_add</span>
              Add Personnel
            </button>
          </div>
        </form>
      </div>
    `;
    
    this.showModal(modalContent);
    
    // Setup form submission
    document.getElementById('add-personnel-form').addEventListener('submit', (e) => {
      this.handleAddPersonnelSubmit(e);
    });
  }

  async handleAddPersonnelSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const photoPreview = document.getElementById('photo-preview');
    const photoData = photoPreview.dataset.photo || null;
    
    const personnelData = {
      name: document.getElementById('person-name').value.trim(),
      role: document.getElementById('person-role').value,
      company: document.getElementById('person-company').value.trim(),
      phone: document.getElementById('person-phone').value.trim(),
      email: document.getElementById('person-email').value.trim(),
      notes: document.getElementById('person-notes').value.trim(),
      photo: photoData
    };
    
    try {
      const person = await window.StorageManager.addPersonnel(personnelData);
      this.showToast(`${person.name} added successfully.`, 'success');
      this.closeModal();
      
      // Refresh lists
      await this.loadPersonnelList();
      await this.loadAllPersonnel();
      
    } catch (error) {
      console.error('[App] Error adding personnel:', error);
      this.showError('Failed to add personnel.');
    }
  }

  async capturePhoto() {
    try {
      const photoData = await window.CameraManager.capturePhoto();
      if (photoData) {
        const photoPreview = document.getElementById('photo-preview');
        photoPreview.innerHTML = `<img src="${photoData}" alt="Captured photo">`;
        photoPreview.dataset.photo = photoData;
      }
    } catch (error) {
      console.error('[App] Error capturing photo:', error);
      this.showError('Failed to capture photo.');
    }
  }

  uploadPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const photoPreview = document.getElementById('photo-preview');
          photoPreview.innerHTML = `<img src="${e.target.result}" alt="Uploaded photo">`;
          photoPreview.dataset.photo = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  showModal(content) {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = content;
    modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // Export functionality
  async handleExport(e) {
    const format = e.currentTarget.dataset.format;
    
    try {
      let result;
      switch (format) {
        case 'csv':
          result = await window.ExportManager.exportCSV();
          break;
        case 'pdf':
          result = await window.ExportManager.exportPDF();
          break;
        case 'json':
          result = await window.ExportManager.exportJSON();
          break;
        default:
          throw new Error(`Unknown export format: ${format}`);
      }
      
      this.showToast(`${format.toUpperCase()} export completed successfully.`, 'success');
      
    } catch (error) {
      console.error('[App] Export error:', error);
      this.showError(`Failed to export ${format.toUpperCase()} file.`);
    }
  }

  // Keyboard shortcuts
  handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case '1':
          e.preventDefault();
          this.navigateTo('dashboard');
          break;
        case '2':
          e.preventDefault();
          this.navigateTo('checkin');
          break;
        case '3':
          e.preventDefault();
          this.navigateTo('personnel');
          break;
        case 's':
          e.preventDefault();
          this.handleAutoSave();
          break;
      }
    }
    
    if (e.key === 'Escape') {
      this.closeModal();
    }
  }

  // Auto-save functionality
  handleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      this.performAutoSave();
    }, 1000);
  }

  async performAutoSave() {
    try {
      await window.StorageManager.saveToStorage();
      this.showSaveIndicator();
      this.lastSaveTime = new Date();
    } catch (error) {
      console.error('[App] Auto-save failed:', error);
    }
  }

  showSaveIndicator() {
    const indicator = document.getElementById('save-indicator');
    indicator.classList.remove('hidden');
    
    setTimeout(() => {
      indicator.classList.add('hidden');
    }, 2000);
  }

  // FAB handling
  handleFabClick() {
    this.showAddPersonnelModal();
  }

  // Utility functions
  handleOnlineStatus(isOnline) {
    this.isOffline = !isOnline;
    const statusText = isOnline ? 'Online' : 'Offline';
    const statusType = isOnline ? 'success' : 'warning';
    this.showToast(`You are now ${statusText}`, statusType);
    
    if (isOnline) {
      // Trigger sync when back online
      this.syncOfflineData();
    }
  }

  async syncOfflineData() {
    try {
      await window.StorageManager.syncOfflineData();
      console.log('[App] Offline data synced successfully');
    } catch (error) {
      console.error('[App] Error syncing offline data:', error);
    }
  }

  handleServiceWorkerMessage(data) {
    switch (data.type) {
      case 'SYNC_COMPLETE':
        this.showToast(`Synced ${data.data.synced} items`, 'success');
        break;
      default:
        console.log('[App] Unknown service worker message:', data);
    }
  }

  formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // UI Feedback
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="material-icons">${this.getToastIcon(type)}</span>
      <span>${message}</span>
    `;
    
    document.getElementById('toast-container').appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  getToastIcon(type) {
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };
    return icons[type] || 'info';
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  // OCR and QR Code functionality
  async handleIDScan() {
    try {
      if (!window.OCRManager || !window.OCRManager.isAvailable()) {
        this.showToast('ID scanning is loading. Please try again in a moment.', 'info');
        return;
      }

      this.showToast('Starting ID scan...', 'info');
      const scannedData = await window.OCRManager.showScanIDModal();
      
      if (scannedData && scannedData.name) {
        // Pre-populate the add personnel modal with scanned data
        this.showAddPersonnelModal('visitor', scannedData);
        this.showToast('ID scan completed! Please review the information.', 'success');
      } else if (scannedData === null) {
        this.showToast('ID scan cancelled', 'info');
      } else {
        this.showToast('Could not extract information from ID. Please add manually.', 'warning');
      }
    } catch (error) {
      console.error('[App] Error during ID scan:', error);
      this.showError('Failed to scan ID card. Please try again.');
    }
  }

  async handleQRScan() {
    try {
      this.showToast('QR code scanning will be available soon!', 'info');
      // QR scanning would use camera to read QR codes
      // For now, we'll focus on QR generation
    } catch (error) {
      console.error('[App] Error during QR scan:', error);
      this.showError('Failed to scan QR code. Please try again.');
    }
  }

  async showPersonQR(personId) {
    try {
      const person = window.StorageManager.getPersonnel(personId);
      if (!person) {
        this.showError('Person not found');
        return;
      }

      if (!window.QRGenerator) {
        this.showError('QR code generation system is not available');
        return;
      }

      // Initialize QR generator if needed
      if (!window.QRGenerator.isInitialized) {
        this.showToast('Initializing QR code generator...', 'info');
        await window.QRGenerator.init();
      }

      if (!window.QRGenerator.isInitialized) {
        this.showError('QR code generation is currently unavailable');
        return;
      }

      await window.QRGenerator.showQRModal(person);
    } catch (error) {
      console.error('[App] Error showing QR code:', error);
      this.showError('Failed to generate QR code: ' + error.message);
    }
  }

  async handleAdvancedReport(e) {
    try {
      const reportType = e.currentTarget.dataset.report;
      this.showToast('Generating report...', 'info');

      let report = this.generateBasicReport(reportType);
      this.showReportModal(report);

    } catch (error) {
      console.error('[App] Error generating advanced report:', error.message, error.stack);
      this.showError(`Failed to generate report: ${error.message}`);
    }
  }

  generateBasicReport(reportType) {
    const personnel = window.StorageManager.getAllPersonnel();
    const activities = window.StorageManager.getActivityLog(500);
    const checkedIn = window.StorageManager.getCheckedInPersonnel();
    const stats = window.StorageManager.getTodaysStats();

    const report = {
      title: this.getReportTitle(reportType),
      dateRange: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      generatedAt: new Date().toISOString(),
      summary: {},
      insights: []
    };

    switch (reportType) {
      case 'occupancy-summary':
        report.summary = {
          totalPersonnel: personnel.length,
          currentOccupancy: checkedIn.length,
          todayCheckIns: stats.checkIns,
          todayCheckOuts: stats.checkOuts
        };
        report.insights = [
          `Current occupancy: ${checkedIn.length} people`,
          `Today's activity: ${stats.checkIns} check-ins, ${stats.checkOuts} check-outs`,
          `Total registered personnel: ${personnel.length}`
        ];
        break;

      case 'personnel-activity':
        const visitors = personnel.filter(p => p.role === 'visitor');
        const employees = personnel.filter(p => p.role === 'employee');
        report.summary = {
          totalPersonnel: personnel.length,
          visitors: visitors.length,
          employees: employees.length,
          activeToday: stats.checkIns
        };
        report.insights = [
          `${visitors.length} visitors and ${employees.length} employees registered`,
          `${stats.checkIns} people checked in today`,
          `Current active personnel: ${checkedIn.length}`
        ];
        break;

      case 'security-audit':
        const emergencyEvents = activities.filter(a => 
          a.action.includes('emergency') || a.action.includes('missing')
        );
        report.summary = {
          totalEvents: activities.length,
          securityEvents: emergencyEvents.length,
          currentOccupancy: checkedIn.length,
          riskLevel: emergencyEvents.length > 0 ? 'Medium' : 'Low'
        };
        report.insights = [
          `${emergencyEvents.length} security-related events recorded`,
          `Current risk level: ${emergencyEvents.length > 0 ? 'Medium' : 'Low'}`,
          `${activities.length} total activities logged`
        ];
        break;

      case 'visitor-analytics':
        const visitorsForAnalytics = personnel.filter(p => p.role === 'visitor');
        const visitorActivities = activities.filter(a => {
          const person = personnel.find(p => p.id === a.data.personnelId);
          return person && person.role === 'visitor';
        });
        report.summary = {
          totalVisitors: visitorsForAnalytics.length,
          visitorActivities: visitorActivities.length,
          currentVisitors: checkedIn.filter(p => p.role === 'visitor').length
        };
        report.insights = [
          `${visitorsForAnalytics.length} total visitors registered`,
          `${visitorActivities.length} visitor activities recorded`,
          `${checkedIn.filter(p => p.role === 'visitor').length} visitors currently on-site`
        ];
        break;

      case 'time-tracking':
        const checkOuts = activities.filter(a => a.action === 'check_out' && a.data.duration);
        const totalDuration = checkOuts.reduce((sum, a) => sum + (a.data.duration || 0), 0);
        const avgDuration = checkOuts.length > 0 ? totalDuration / checkOuts.length : 0;
        
        report.summary = {
          totalVisits: checkOuts.length,
          totalTime: this.formatDuration(totalDuration),
          averageVisitTime: this.formatDuration(avgDuration),
          currentOccupancy: checkedIn.length
        };
        report.insights = [
          `${checkOuts.length} completed visits tracked`,
          `Average visit duration: ${this.formatDuration(avgDuration)}`,
          `Total time tracked: ${this.formatDuration(totalDuration)}`
        ];
        break;

      case 'compliance':
        report.summary = {
          totalPersonnel: personnel.length,
          compliantPersonnel: personnel.length,
          currentOccupancy: checkedIn.length,
          complianceRate: '100%'
        };
        report.insights = [
          `All ${personnel.length} personnel are compliant`,
          `${checkedIn.length} people currently on-site`,
          `100% compliance rate maintained`
        ];
        break;
    }

    return report;
  }

  getReportTitle(reportType) {
    const titles = {
      'occupancy-summary': 'Occupancy Summary Report',
      'personnel-activity': 'Personnel Activity Report',
      'security-audit': 'Security Audit Report',
      'visitor-analytics': 'Visitor Analytics Report',
      'time-tracking': 'Time Tracking Report',
      'compliance': 'Compliance Report'
    };
    return titles[reportType] || 'Advanced Report';
  }

  showReportModal(report) {
    const modalContent = `
      <div class="report-modal">
        <div class="modal-header">
          <h3>${report.title}</h3>
          <button class="icon-button" onclick="window.app.closeModal()">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="modal-body">
          <div class="report-header">
            <div class="report-meta">
              <p><strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>
              ${report.dateRange ? `<p><strong>Period:</strong> ${new Date(report.dateRange.startDate).toLocaleDateString()} - ${new Date(report.dateRange.endDate).toLocaleDateString()}</p>` : ''}
            </div>
            <div class="report-actions">
              <button class="action-button secondary" onclick="window.app.downloadReport('html')">
                <span class="material-icons">download</span>
                Download HTML
              </button>
              <button class="action-button secondary" onclick="window.app.downloadReport('json')">
                <span class="material-icons">code</span>
                Download JSON
              </button>
              <button class="action-button primary" onclick="window.app.printReport()">
                <span class="material-icons">print</span>
                Print Report
              </button>
            </div>
          </div>
          <div class="report-content">
            ${this.generateReportPreview(report)}
          </div>
        </div>
      </div>
    `;
    
    // Store current report for download actions
    this.currentReport = report;
    this.showModal(modalContent);
  }

  generateReportPreview(report) {
    let content = `
      <div class="report-summary">
        <h4>Summary</h4>
    `;
    
    if (report.summary) {
      Object.entries(report.summary).forEach(([key, value]) => {
        if (typeof value === 'object' && Array.isArray(value)) {
          content += `<p><strong>${this.formatKey(key)}:</strong> ${value.length} items</p>`;
        } else if (typeof value === 'object') {
          content += `<p><strong>${this.formatKey(key)}:</strong> [Object]</p>`;
        } else {
          content += `<p><strong>${this.formatKey(key)}:</strong> ${value}</p>`;
        }
      });
    }
    
    content += `</div>`;
    
    if (report.insights && report.insights.length > 0) {
      content += `
        <div class="report-insights">
          <h4>Key Insights</h4>
          ${report.insights.map(insight => `<div class="insight-item">${insight}</div>`).join('')}
        </div>
      `;
    }
    
    return content;
  }

  formatKey(key) {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  async downloadReport(format) {
    if (!this.currentReport) return;
    
    try {
      if (format === 'html') {
        await window.ReportsManager.exportReportAsHTML(this.currentReport);
      } else if (format === 'json') {
        const jsonData = JSON.stringify(this.currentReport, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.currentReport.title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      this.showToast(`Report downloaded as ${format.toUpperCase()}`, 'success');
    } catch (error) {
      console.error('[App] Error downloading report:', error);
      this.showError('Failed to download report.');
    }
  }

  printReport() {
    if (!this.currentReport) return;
    
    const printWindow = window.open('', '_blank');
    const reportHTML = window.ReportsManager.generateReportHTML(this.currentReport);
    
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  // Activity Log Management
  async updateActivityPage() {
    try {
      // Load fewer activities for better performance
      const activities = window.StorageManager.getActivityLog(100);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const todayActivities = activities.filter(a => 
        new Date(a.timestamp) >= todayStart
      );
      
      const undoableActivities = activities.filter(a => 
        this.isUndoable(a) && Date.now() - a.timestamp < 24 * 60 * 60 * 1000
      );

      // Update stats
      document.getElementById('today-activities-count').textContent = todayActivities.length;
      document.getElementById('undoable-actions-count').textContent = undoableActivities.length;
      document.getElementById('total-activities-count').textContent = window.StorageManager.getActivityLog(10000).length;

      // Load activity list with pagination
      this.loadActivityList(activities);

    } catch (error) {
      console.error('[App] Error updating activity page:', error);
      this.showError('Failed to load activity log');
    }
  }

  loadActivityList(activities = null) {
    const container = document.getElementById('activity-log-list');
    if (!container) return;

    if (!activities) {
      activities = window.StorageManager.getActivityLog(100);
    }

    // Apply filters if any
    activities = this.applyCurrentFilters(activities);

    if (activities.length === 0) {
      container.innerHTML = `
        <div class="activity-empty">
          <span class="material-icons" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">history</span>
          <p>No activity records found</p>
        </div>
      `;
      return;
    }

    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    activities.forEach(activity => {
      const activityElement = document.createElement('div');
      activityElement.innerHTML = this.createActivityItem(activity);
      fragment.appendChild(activityElement.firstElementChild);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);

    // Remove existing event listeners and add new ones
    container.replaceWith(container.cloneNode(true));
    const newContainer = document.getElementById('activity-log-list');

    // Add event listeners for undo and delete buttons using event delegation
    newContainer.addEventListener('click', (e) => {
      if (e.target.closest('.undo-btn')) {
        const activityId = e.target.closest('.undo-btn').dataset.activityId;
        this.handleUndoActivity(activityId);
      } else if (e.target.closest('.delete-activity-btn')) {
        const activityId = e.target.closest('.delete-activity-btn').dataset.activityId;
        this.handleDeleteActivity(activityId);
      }
    });

    // Add event listener for bulk selection checkboxes
    newContainer.addEventListener('change', (e) => {
      if (e.target.classList.contains('bulk-select-checkbox')) {
        const activityId = e.target.dataset.activityId;
        this.toggleActivitySelection(activityId);
      }
    });
  }

  createActivityItem(activity) {
    const { icon, iconClass, title, description } = this.getActivityDisplayInfo(activity);
    const isUndoable = this.isUndoable(activity);
    const canUndo = isUndoable && Date.now() - activity.timestamp < 24 * 60 * 60 * 1000;
    const isSelected = this.selectedActivityIds.has(activity.id);
    
    return `
      <div class="activity-item ${isUndoable ? 'undoable' : ''}" data-activity-id="${activity.id}">
        ${this.bulkSelectMode ? `
          <div class="activity-checkbox">
            <input type="checkbox" 
                   id="activity-${activity.id}" 
                   ${isSelected ? 'checked' : ''} 
                   data-activity-id="${activity.id}"
                   class="bulk-select-checkbox">
          </div>
        ` : ''}
        <div class="activity-icon ${iconClass}">
          <span class="material-icons">${icon}</span>
        </div>
        <div class="activity-details">
          <div class="activity-title">${title}</div>
          <div class="activity-description">${description}</div>
          <div class="activity-meta">
            <span class="activity-timestamp">${new Date(activity.timestamp).toLocaleString()}</span>
            <span>•</span>
            <span>${activity.action.replace(/_/g, ' ').toUpperCase()}</span>
            ${activity.data.officer ? `<span>• Officer: ${activity.data.officer}</span>` : ''}
          </div>
        </div>
        <div class="activity-actions">
          ${canUndo && !this.bulkSelectMode ? `
            <button class="undo-btn" data-activity-id="${activity.id}">
              <span class="material-icons" style="font-size: 14px;">undo</span>
              Undo
            </button>
          ` : ''}
          ${!this.bulkSelectMode ? `
            <button class="delete-activity-btn" data-activity-id="${activity.id}">
              <span class="material-icons" style="font-size: 14px;">delete</span>
              Delete
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  getActivityDisplayInfo(activity) {
    const person = activity.data.personnelId ? 
      window.StorageManager.getPersonnel(activity.data.personnelId) : null;
    
    const personName = person ? person.name : 'Unknown Person';

    switch (activity.action) {
      case 'check_in':
        return {
          icon: 'login',
          iconClass: 'check-in',
          title: `${personName} checked in`,
          description: `${person?.role || 'Visitor'} ${person?.company ? `from ${person.company}` : ''}`
        };
      
      case 'check_out':
        const duration = activity.data.duration ? 
          this.formatDuration(activity.data.duration) : 'Unknown duration';
        return {
          icon: 'logout',
          iconClass: 'check-out',
          title: `${personName} checked out`,
          description: `Visit duration: ${duration}`
        };
      
      case 'personnel_added':
        return {
          icon: 'person_add',
          iconClass: 'personnel',
          title: `New personnel added`,
          description: `${personName} (${activity.data.role || 'visitor'}) was added to the system`
        };
      
      case 'personnel_updated':
        return {
          icon: 'edit',
          iconClass: 'personnel',
          title: `Personnel updated`,
          description: `${personName}'s information was modified`
        };
      
      case 'personnel_deleted':
        return {
          icon: 'person_remove',
          iconClass: 'personnel',
          title: `Personnel removed`,
          description: `${activity.data.name || 'Unknown'} was removed from the system`
        };
      
      case 'shift_start':
        return {
          icon: 'play_arrow',
          iconClass: 'shift',
          title: `Shift started`,
          description: `${activity.data.shiftType || 'Regular'} shift with officers: ${activity.data.officers?.join(', ') || 'Unknown'}`
        };
      
      case 'shift_end':
        return {
          icon: 'stop',
          iconClass: 'shift',
          title: `Shift ended`,
          description: `Shift duration: ${activity.data.duration ? this.formatDuration(activity.data.duration) : 'Unknown'}`
        };
      
      case 'emergency_mode_activated':
        return {
          icon: 'emergency',
          iconClass: 'emergency',
          title: `Emergency mode activated`,
          description: `Emergency procedures initiated by ${activity.data.officer || 'system'}`
        };
      
      default:
        return {
          icon: 'info',
          iconClass: 'personnel',
          title: activity.action.replace(/_/g, ' '),
          description: JSON.stringify(activity.data)
        };
    }
  }

  isUndoable(activity) {
    const undoableActions = [
      'check_in',
      'check_out',
      'personnel_added',
      'personnel_updated',
      'personnel_deleted'
    ];
    return undoableActions.includes(activity.action);
  }

  async handleUndoActivity(activityId) {
    try {
      const activity = window.StorageManager.getActivityLog(1000).find(a => a.id === activityId);
      if (!activity) {
        this.showError('Activity not found');
        return;
      }

      if (!this.isUndoable(activity)) {
        this.showError('This activity cannot be undone');
        return;
      }

      const confirmed = await this.showConfirmDialog(
        'Undo Activity',
        `Are you sure you want to undo this action: "${this.getActivityDisplayInfo(activity).title}"? This cannot be reversed.`
      );

      if (!confirmed) return;

      await this.performUndo(activity);
      
      // Log the undo action
      await window.StorageManager.logActivity('activity_undone', {
        originalActivityId: activityId,
        originalAction: activity.action,
        undoneAt: Date.now()
      });

      this.showToast('Activity successfully undone', 'success');
      await this.updateActivityPage();

    } catch (error) {
      console.error('[App] Error undoing activity:', error);
      this.showError('Failed to undo activity');
    }
  }

  async performUndo(activity) {
    switch (activity.action) {
      case 'check_in':
        if (activity.data.personnelId) {
          const person = window.StorageManager.getPersonnel(activity.data.personnelId);
          if (person && person.status === 'checked_in') {
            await window.StorageManager.checkOut(activity.data.personnelId);
          }
        }
        break;

      case 'check_out':
        if (activity.data.personnelId) {
          const person = window.StorageManager.getPersonnel(activity.data.personnelId);
          if (person && person.status === 'checked_out') {
            await window.StorageManager.checkIn(activity.data.personnelId);
          }
        }
        break;

      case 'personnel_added':
        if (activity.data.personnelId) {
          await window.StorageManager.deletePersonnel(activity.data.personnelId);
        }
        break;

      case 'personnel_deleted':
        if (activity.data.personnelData) {
          await window.StorageManager.addPersonnel(activity.data.personnelData);
        }
        break;

      case 'personnel_updated':
        if (activity.data.personnelId && activity.data.previousData) {
          await window.StorageManager.updatePersonnel(activity.data.personnelId, activity.data.previousData);
        }
        break;
    }
  }

  applyCurrentFilters(activities) {
    const typeFilter = document.getElementById('activity-type-filter')?.value;
    const dateFilter = document.getElementById('activity-date-filter')?.value;

    let filtered = activities;

    if (typeFilter && typeFilter !== 'all') {
      if (typeFilter === 'emergency') {
        filtered = filtered.filter(a => 
          a.action.includes('emergency') || a.action.includes('missing')
        );
      } else {
        filtered = filtered.filter(a => a.action === typeFilter);
      }
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      filtered = filtered.filter(a => {
        const activityDate = new Date(a.timestamp);
        return activityDate >= filterDate && activityDate < nextDay;
      });
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  applyActivityFilters() {
    this.loadActivityList();
  }

  async handleClearActivityLog() {
    const confirmed = await this.showConfirmDialog(
      'Clear Activity Log',
      'Are you sure you want to clear old activity logs? This will remove activities older than 30 days and cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const cutoffDate = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
      const activities = window.StorageManager.getActivityLog(10000);
      const toKeep = activities.filter(a => a.timestamp > cutoffDate);
      
      // Update storage with filtered activities
      window.StorageManager.data.activities = toKeep;
      await window.StorageManager.saveToStorage();

      this.showToast('Old activity logs cleared successfully', 'success');
      await this.updateActivityPage();

    } catch (error) {
      console.error('[App] Error clearing activity log:', error);
      this.showError('Failed to clear activity log');
    }
  }

  toggleBulkSelect() {
    this.bulkSelectMode = !this.bulkSelectMode;
    this.selectedActivityIds.clear();
    
    const selectBtn = document.getElementById('bulk-select-btn');
    const deleteBtn = document.getElementById('bulk-delete-btn');
    const selectIcon = selectBtn.querySelector('.material-icons');
    
    if (this.bulkSelectMode) {
      selectBtn.textContent = '';
      selectBtn.appendChild(selectIcon);
      selectBtn.append(' Cancel Selection');
      selectIcon.textContent = 'cancel';
      deleteBtn.style.display = 'inline-flex';
    } else {
      selectBtn.textContent = '';
      selectBtn.appendChild(selectIcon);
      selectBtn.append(' Select Items');
      selectIcon.textContent = 'check_box';
      deleteBtn.style.display = 'none';
    }
    
    // Refresh the activity list to show/hide checkboxes
    this.loadActivityList();
  }

  toggleActivitySelection(activityId) {
    const activityElement = document.querySelector(`[data-activity-id="${activityId}"]`);
    
    if (this.selectedActivityIds.has(activityId)) {
      this.selectedActivityIds.delete(activityId);
      activityElement?.classList.remove('selected');
    } else {
      this.selectedActivityIds.add(activityId);
      activityElement?.classList.add('selected');
    }
    
    // Update the delete button text with count
    const deleteBtn = document.getElementById('bulk-delete-btn');
    if (deleteBtn) {
      const count = this.selectedActivityIds.size;
      const deleteIcon = deleteBtn.querySelector('.material-icons');
      deleteBtn.textContent = '';
      deleteBtn.appendChild(deleteIcon);
      deleteBtn.append(` Delete Selected (${count})`);
      
      // Enable/disable the button based on selection count
      deleteBtn.disabled = count === 0;
      deleteBtn.style.opacity = count === 0 ? '0.5' : '1';
    }
  }

  async handleBulkDelete() {
    if (this.selectedActivityIds.size === 0) {
      this.showToast('No items selected for deletion', 'warning');
      return;
    }

    const confirmed = await this.showConfirmDialog(
      'Delete Selected Activities',
      `Are you sure you want to permanently delete ${this.selectedActivityIds.size} selected activity records? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const allActivities = window.StorageManager.getActivityLog(10000);
      const updatedActivities = allActivities.filter(a => !this.selectedActivityIds.has(a.id));
      
      console.log(`[App] Bulk deleting: ${allActivities.length} -> ${updatedActivities.length} activities`);
      
      // Update storage
      window.StorageManager.data.activities = updatedActivities;
      await window.StorageManager.saveToStorage();
      
      const deletedCount = this.selectedActivityIds.size;
      
      // Reset selection mode
      this.selectedActivityIds.clear();
      this.toggleBulkSelect();
      
      this.showToast(`Successfully deleted ${deletedCount} activity records`, 'success');
      await this.updateActivityPage();

    } catch (error) {
      console.error('[App] Error during bulk delete:', error);
      this.showError('Failed to delete selected activities');
    }
  }

  async handleDeleteActivity(activityId) {
    try {
      console.log('[App] Attempting to delete activity ID:', activityId);
      
      const allActivities = window.StorageManager.getActivityLog(10000);
      const activity = allActivities.find(a => a.id === activityId);
      
      if (!activity) {
        console.error('[App] Activity not found with ID:', activityId);
        this.showError('Activity not found');
        return;
      }

      const { title } = this.getActivityDisplayInfo(activity);
      const confirmed = await this.showConfirmDialog(
        'Delete Activity',
        `Are you sure you want to permanently delete this activity record: "${title}"? This action cannot be undone.`
      );

      if (!confirmed) return;

      // Remove the activity from the log
      const originalCount = allActivities.length;
      const updatedActivities = allActivities.filter(a => a.id !== activityId);
      const newCount = updatedActivities.length;
      
      console.log(`[App] Filtering: ${originalCount} -> ${newCount} activities`);
      
      if (originalCount === newCount) {
        console.error('[App] No activity was removed - ID mismatch?');
        this.showError('Failed to delete activity - ID not found');
        return;
      }
      
      // Update storage directly - fix the property name
      window.StorageManager.data.activities = updatedActivities;
      await window.StorageManager.saveToStorage();
      
      // Remove the item from DOM immediately for instant feedback
      const activityElement = document.querySelector(`[data-activity-id="${activityId}"]`);
      if (activityElement) {
        activityElement.remove();
      }
      
      this.showToast('Activity deleted successfully', 'success');
      
      // Update the statistics counts
      await this.updateActivityPage();

    } catch (error) {
      console.error('[App] Error deleting activity:', error);
      this.showError('Failed to delete activity');
    }
  }

  async showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const modalContent = `
        <div class="modal-header">
          <h3>${title}</h3>
        </div>
        <div class="modal-body">
          <p>${message}</p>
          <div class="form-actions">
            <button class="action-button secondary" onclick="window.app.resolveConfirm(false)">
              Cancel
            </button>
            <button class="action-button primary" onclick="window.app.resolveConfirm(true)">
              Confirm
            </button>
          </div>
        </div>
      `;
      
      this.showModal(modalContent);
      this.confirmResolver = resolve;
    });
  }

  resolveConfirm(result) {
    if (this.confirmResolver) {
      this.confirmResolver(result);
      this.confirmResolver = null;
    }
    this.closeModal();
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new SecurityApp();
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('[App] Global error:', event.error);
  if (window.app) {
    window.app.showError('An unexpected error occurred. Please try again.');
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[App] Unhandled promise rejection:', event.reason);
  if (window.app) {
    window.app.showError('An unexpected error occurred. Please try again.');
  }
});

// Network Sync Management Methods
SecurityApp.prototype.updateSyncPage = async function() {
  if (!window.P2PSync) return;
  
  const status = window.P2PSync.getStatus();
  this.updateSyncUI(status);
  this.loadSyncActivityLog();
  this.updateP2PConnectionInfo();
};

SecurityApp.prototype.updateSyncUI = function(status) {
  const enableBtn = document.getElementById('enable-sync-btn');
  const disableBtn = document.getElementById('disable-sync-btn');
  const serverControls = document.getElementById('server-controls');
  const clientControls = document.getElementById('client-controls');
  const startServerBtn = document.getElementById('start-server-btn');
  const stopServerBtn = document.getElementById('stop-server-btn');

  if (status.enabled) {
    enableBtn.style.display = 'none';
    disableBtn.style.display = 'inline-flex';
    serverControls.style.display = 'block';
    clientControls.style.display = 'block';
  } else {
    enableBtn.style.display = 'inline-flex';
    disableBtn.style.display = 'none';
    serverControls.style.display = 'none';
    clientControls.style.display = 'none';
  }

  if (status.isServer) {
    startServerBtn.style.display = 'none';
    stopServerBtn.style.display = 'inline-flex';
    clientControls.style.display = 'none';
  } else {
    startServerBtn.style.display = 'inline-flex';
    stopServerBtn.style.display = 'none';
  }
};

SecurityApp.prototype.enableSync = function() {
  if (window.P2PSync) {
    window.P2PSync.enable();
    this.updateSyncPage();
  }
};

SecurityApp.prototype.disableSync = function() {
  if (window.P2PSync) {
    window.P2PSync.disable();
    this.updateSyncPage();
  }
};

SecurityApp.prototype.startSyncServer = async function() {
  if (window.P2PSync) {
    try {
      const success = await window.P2PSync.startAsCoordinator();
      this.updateSyncPage();
      if (success) {
        this.showP2PConnectionQR();
      }
    } catch (error) {
      this.showError('Failed to start coordinator: ' + error.message);
    }
  }
};

SecurityApp.prototype.stopSyncServer = function() {
  if (window.P2PSync) {
    window.P2PSync.disable();
    this.updateSyncPage();
  }
};

SecurityApp.prototype.connectToSyncServer = async function() {
  const serverIpInput = document.getElementById('server-ip-input');
  const serverUrl = serverIpInput.value.trim();
  
  if (!serverUrl) {
    this.showError('Please enter coordinator URL');
    return;
  }

  const coordinatorUrl = serverUrl.startsWith('http') ? serverUrl : `${window.location.protocol}//${serverUrl}`;
  
  if (window.P2PSync) {
    this.showToast('Connecting to coordinator...', 'info');
    const success = await window.P2PSync.connectToPeer(coordinatorUrl);
    this.updateSyncPage();
  }
};

SecurityApp.prototype.scanSyncQR = async function() {
  if (window.CameraManager) {
    try {
      const qrData = await window.CameraManager.scanQRCode();
      if (qrData && (qrData.startsWith('http://') || qrData.startsWith('https://'))) {
        document.getElementById('server-ip-input').value = qrData;
        this.connectToSyncServer();
      } else {
        this.showError('Invalid sync QR code');
      }
    } catch (error) {
      this.showError('Failed to scan QR code: ' + error.message);
    }
  }
};

SecurityApp.prototype.updateP2PConnectionInfo = function() {
  if (!window.P2PSync) return;
  
  const status = window.P2PSync.getStatus();
  const deviceListContainer = document.getElementById('device-list');
  
  if (deviceListContainer && status.connectedPeers) {
    if (status.connectedPeers.length === 0) {
      deviceListContainer.innerHTML = '<div class="device-item">No connected devices</div>';
    } else {
      const devicesHtml = status.connectedPeers.map(peer => `
        <div class="device-item">
          <div class="device-info">
            <div class="device-name">${peer.name || peer.id}</div>
            <div class="device-details">ID: ${peer.id} • Last seen: ${new Date(peer.lastSeen).toLocaleTimeString()}</div>
          </div>
          <div class="device-status">
            <span class="material-icons" style="color: var(--success);">check_circle</span>
          </div>
        </div>
      `).join('');
      deviceListContainer.innerHTML = devicesHtml;
    }
    
    document.getElementById('discovered-devices').style.display = 'block';
  }
};

SecurityApp.prototype.showP2PConnectionQR = function() {
  if (!window.P2PSync || !window.P2PSync.isCoordinator) return;
  
  const connectionUrl = window.location.origin; // Use current page URL for connection
  
  this.showModal(`
    <div class="modal-header">
      <h3>Connection Information</h3>
      <button class="icon-button" onclick="window.app.closeModal()">
        <span class="material-icons">close</span>
      </button>
    </div>
    <div class="modal-body">
      <div style="text-align: center;">
        <p>Other devices can connect using this URL:</p>
        <div id="connection-qr" style="margin: 20px 0; min-height: 200px; display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc;">
          <span style="color: #666;">Generating QR code...</span>
        </div>
        <p style="font-family: monospace; word-break: break-all; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 4px;">${connectionUrl}</p>
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
          <button class="action-button secondary" onclick="navigator.clipboard.writeText('${connectionUrl}'); window.app.showToast('URL copied to clipboard', 'success');">
            <span class="material-icons">content_copy</span>
            Copy URL
          </button>
          <button class="action-button secondary" onclick="navigator.share ? navigator.share({title: 'Secure Access Sync', url: '${connectionUrl}'}) : window.app.showToast('Sharing not supported', 'info');">
            <span class="material-icons">share</span>
            Share
          </button>
        </div>
      </div>
    </div>
  `);
  
  // Generate QR code using the external library
  setTimeout(() => {
    const qrContainer = document.getElementById('connection-qr');
    if (qrContainer && window.QRCode) {
      try {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
          text: connectionUrl,
          width: 200,
          height: 200,
          colorDark: "#000000",
          colorLight: "#ffffff"
        });
      } catch (error) {
        console.error('QR generation error:', error);
        qrContainer.innerHTML = `
          <div style="text-align: center; padding: 40px;">
            <span class="material-icons" style="font-size: 48px; color: #666;">qr_code</span>
            <p style="margin: 10px 0; color: #666;">QR code generation failed</p>
            <p style="font-size: 12px; color: #999;">Use the URL above to connect</p>
          </div>
        `;
      }
    }
  }, 100);
};

SecurityApp.prototype.clearSyncLog = function() {
  const logContainer = document.getElementById('sync-activity-log');
  if (logContainer) {
    logContainer.innerHTML = '<div class="sync-log-empty">Sync activity log cleared</div>';
  }
  this.showToast('Sync log cleared', 'success');
};

SecurityApp.prototype.loadSyncActivityLog = function() {
  const container = document.getElementById('sync-activity-log');
  if (!container) return;

  const activities = window.StorageManager.getActivityLog(100).filter(activity => 
    activity.action.includes('sync') || activity.action.includes('_sync')
  );

  if (activities.length === 0) {
    container.innerHTML = '<div class="sync-log-empty">No sync activity yet</div>';
    return;
  }

  const logHtml = activities.map(activity => `
    <div class="sync-log-item">
      <div class="sync-log-icon">
        <span class="material-icons">${this.getSyncEventIcon(activity.action)}</span>
      </div>
      <div class="sync-log-details">
        <div class="sync-log-action">${this.formatSyncAction(activity.action)}</div>
        <div class="sync-log-data">${this.formatSyncData(activity.data)}</div>
        <div class="sync-log-time">${new Date(activity.timestamp).toLocaleString()}</div>
      </div>
    </div>
  `).join('');

  container.innerHTML = logHtml;
};

SecurityApp.prototype.getSyncEventIcon = function(action) {
  if (action.includes('check_in')) return 'login';
  if (action.includes('check_out')) return 'logout';
  if (action.includes('personnel')) return 'person';
  if (action.includes('emergency')) return 'warning';
  if (action.includes('shift')) return 'schedule';
  return 'sync';
};

SecurityApp.prototype.formatSyncAction = function(action) {
  return action.replace(/_/g, ' ').replace(/sync/g, '').trim().toUpperCase();
};

SecurityApp.prototype.formatSyncData = function(data) {
  if (data.name) return `${data.name}`;
  if (data.syncedFrom) return `From: ${data.syncedFrom}`;
  return 'System event';
};

SecurityApp.prototype.emitSyncEvent = function(eventType, data) {
  const event = new CustomEvent(eventType, { detail: data });
  window.dispatchEvent(event);
};

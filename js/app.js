/**
 * Security Access Manager - Main Application
 * Enterprise-grade Progressive Web App for security officers
 */

class SecurityApp {
  constructor() {
    this.currentPage = 'dashboard';
    this.isOffline = !navigator.onLine;
    this.lastSaveTime = null;
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.isNavOpen = false;
    
    // Initialize app
    this.init();
  }

  async init() {
    try {
      console.log('[App] Initializing Security Access Manager');
      
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
    
    // Export buttons
    document.querySelectorAll('.export-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleExport(e));
    });
    
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
      case 'personnel':
        await this.loadAllPersonnel();
        break;
      case 'reports':
        if (window.DashboardManager) {
          await window.DashboardManager.updateCharts();
        }
        break;
      case 'emergency':
        if (window.EmergencyManager) {
          await window.EmergencyManager.updateContent();
        }
        break;
    }
  }

  // Theme management
  toggleTheme() {
    const themes = ['light', 'dark', 'high-contrast', 'night-shift'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    this.applyTheme(nextTheme);
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update theme toggle icon
    const themeIcon = document.querySelector('#theme-toggle .material-icons');
    const icons = {
      light: 'light_mode',
      dark: 'dark_mode',
      'high-contrast': 'contrast',
      'night-shift': 'nights_stay'
    };
    themeIcon.textContent = icons[theme] || 'light_mode';
    
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
            <button class="action-button primary" onclick="app.showAddPersonnelModal()">
              <span class="material-icons">person_add</span>
              Add First Person
            </button>
          </div>
        `;
        return;
      }
      
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
  showAddPersonnelModal(defaultRole = 'visitor') {
    const modalContent = `
      <div class="modal-header">
        <h3>Add Personnel</h3>
        <button class="icon-button" onclick="app.closeModal()">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <form id="add-personnel-form" class="personnel-form">
          <div class="form-group">
            <label for="person-name">Name *</label>
            <input type="text" id="person-name" required>
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
                <button type="button" class="action-button secondary" onclick="app.capturePhoto()">
                  <span class="material-icons">camera_alt</span>
                  Take Photo
                </button>
                <button type="button" class="action-button secondary" onclick="app.uploadPhoto()">
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
            <button type="button" class="action-button secondary" onclick="app.closeModal()">
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

  async showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const modalContent = `
        <div class="modal-header">
          <h3>${title}</h3>
        </div>
        <div class="modal-body">
          <p>${message}</p>
          <div class="form-actions">
            <button class="action-button secondary" onclick="app.resolveConfirm(false)">
              Cancel
            </button>
            <button class="action-button primary" onclick="app.resolveConfirm(true)">
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

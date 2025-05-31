/**
 * Secure Access - Personnel Module
 * Handles personnel management, check-in/out, and visitor registration
 */

class PersonnelModule {
  constructor() {
    this.initialized = false;
    this.currentPersonnel = [];
    this.checkedInPeople = [];
  }

  async init() {
    await this.loadPersonnelData();
    console.log('[Personnel] Personnel module initialized');
    this.initialized = true;
  }

  async loadPersonnelData() {
    try {
      const stored = localStorage.getItem('personnel');
      this.currentPersonnel = stored ? JSON.parse(stored) : [];
      this.checkedInPeople = this.currentPersonnel.filter(p => p.status === 'checked-in');
    } catch (error) {
      console.error('[Personnel] Error loading data:', error);
      this.currentPersonnel = [];
      this.checkedInPeople = [];
    }
  }

  async savePersonnelData() {
    try {
      localStorage.setItem('personnel', JSON.stringify(this.currentPersonnel));
      localStorage.setItem('personnel_backup', JSON.stringify(this.currentPersonnel));
    } catch (error) {
      console.error('[Personnel] Error saving data:', error);
    }
  }

  createPersonCard(person, showActions = false) {
    const statusColor = person.status === 'checked-in' ? 'success' : 'outline';
    const statusIcon = person.status === 'checked-in' ? 'check_circle' : 'radio_button_unchecked';
    
    return `
      <div class="person-card ${person.status}" data-person-id="${person.id}">
        <div class="person-avatar">
          ${person.photo ? 
            `<img src="${person.photo}" alt="${person.name}" class="avatar-image">` :
            `<div class="avatar-placeholder">
              <span class="material-icons">person</span>
            </div>`
          }
          <div class="status-indicator ${statusColor}">
            <span class="material-icons">${statusIcon}</span>
          </div>
        </div>
        <div class="person-info">
          <h3 class="person-name">${person.name}</h3>
          <p class="person-role">${person.role}</p>
          ${person.company ? `<p class="person-company">${person.company}</p>` : ''}
          ${person.purpose ? `<p class="person-purpose">${person.purpose}</p>` : ''}
          <div class="person-meta">
            <span class="check-in-time">
              ${person.status === 'checked-in' ? 
                `Checked in: ${this.formatTime(person.checkInTime)}` :
                `Last visit: ${person.lastVisit ? this.formatTime(person.lastVisit) : 'Never'}`
              }
            </span>
          </div>
        </div>
        ${showActions ? `
          <div class="person-actions">
            <button class="btn btn-icon" onclick="app.togglePersonStatus('${person.id}')" 
                    title="${person.status === 'checked-in' ? 'Check Out' : 'Check In'}">
              <span class="material-icons">
                ${person.status === 'checked-in' ? 'logout' : 'login'}
              </span>
            </button>
            <button class="btn btn-icon" onclick="app.showPersonQR('${person.id}')" title="Show QR Code">
              <span class="material-icons">qr_code</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  async togglePersonStatus(personId) {
    const person = this.currentPersonnel.find(p => p.id === personId);
    if (!person) return;

    const timestamp = Date.now();
    const activity = {
      id: 'activity_' + timestamp,
      timestamp,
      personId: person.id,
      personName: person.name,
      personRole: person.role,
      type: person.status === 'checked-in' ? 'check-out' : 'check-in'
    };

    if (person.status === 'checked-in') {
      person.status = 'checked-out';
      person.checkOutTime = timestamp;
      person.lastVisit = timestamp;
      activity.action = 'checked out';
    } else {
      person.status = 'checked-in';
      person.checkInTime = timestamp;
      activity.action = 'checked in';
    }

    // Update arrays
    this.checkedInPeople = this.currentPersonnel.filter(p => p.status === 'checked-in');
    
    // Save data
    await this.savePersonnelData();
    
    // Log activity
    if (window.app && window.app.activityLog) {
      window.app.activityLog.push(activity);
      localStorage.setItem('activityLog', JSON.stringify(window.app.activityLog));
    }

    // Show notification
    if (window.CoreModule) {
      window.CoreModule.showToast(
        `${person.name} ${activity.action} successfully`, 
        'success'
      );
    }

    // Update UI if on personnel page
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage.id === 'personnel-page') {
      await this.updatePersonnelPage();
    }

    // Update dashboard if visible
    if (window.app && window.app.updateDashboard) {
      await window.app.updateDashboard();
    }

    return activity;
  }

  async addPerson(personData) {
    const timestamp = Date.now();
    const person = {
      id: 'person_' + timestamp,
      ...personData,
      status: 'checked-out',
      addedTime: timestamp,
      lastVisit: null
    };

    this.currentPersonnel.push(person);
    await this.savePersonnelData();

    // Log activity
    const activity = {
      id: 'activity_' + timestamp,
      timestamp,
      personId: person.id,
      personName: person.name,
      personRole: person.role,
      type: 'add-person',
      action: 'added to system'
    };

    if (window.app && window.app.activityLog) {
      window.app.activityLog.push(activity);
      localStorage.setItem('activityLog', JSON.stringify(window.app.activityLog));
    }

    if (window.CoreModule) {
      window.CoreModule.showToast(`${person.name} added successfully`, 'success');
    }

    return person;
  }

  async updatePersonnelPage() {
    // Update both personnel lists for different pages
    this.updatePersonnelList('personnel-list', true); // Check-in page with actions
    this.updatePersonnelList('all-personnel-list', true); // Personnel management page
  }

  updatePersonnelList(containerId, showActions = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.currentPersonnel.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-icons">people</span>
          <h3>No Personnel Registered</h3>
          <p>Add people to start tracking access</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();
    this.currentPersonnel.forEach(person => {
      const personElement = document.createElement('div');
      personElement.innerHTML = this.createPersonCard(person, showActions);
      fragment.appendChild(personElement.firstElementChild);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
  }

  getPersonById(personId) {
    return this.currentPersonnel.find(p => p.id === personId);
  }

  getCheckedInPeople() {
    return this.checkedInPeople;
  }

  getAllPersonnel() {
    return this.currentPersonnel;
  }

  getPersonnelStats() {
    return {
      total: this.currentPersonnel.length,
      checkedIn: this.checkedInPeople.length,
      visitors: this.currentPersonnel.filter(p => p.role === 'visitor').length,
      employees: this.currentPersonnel.filter(p => p.role === 'employee').length,
      contractors: this.currentPersonnel.filter(p => p.role === 'contractor').length
    };
  }
}

// Export for global use
window.PersonnelModule = new PersonnelModule();
console.log('[Personnel] Personnel module loaded');
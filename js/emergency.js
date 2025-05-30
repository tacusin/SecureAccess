/**
 * Secure Access - Emergency Manager
 * Handles emergency operations, evacuation procedures, and crisis management
 */

class EmergencyManager {
  constructor() {
    this.isEmergencyMode = false;
    this.emergencyStartTime = null;
    this.evacuationList = [];
    this.missingPersons = [];
    this.isInitialized = false;
  }

  async init() {
    try {
      console.log('[Emergency] Initializing Emergency Manager');
      
      // Setup emergency event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('[Emergency] Emergency Manager initialized successfully');
      
    } catch (error) {
      console.error('[Emergency] Error initializing emergency manager:', error);
      throw new Error('Failed to initialize emergency manager');
    }
  }

  setupEventListeners() {
    // Emergency action buttons
    document.getElementById('evacuation-list-btn')?.addEventListener('click', () => {
      this.generateEvacuationList();
    });
    
    document.getElementById('missing-persons-btn')?.addEventListener('click', () => {
      this.identifyMissingPersons();
    });
    
    document.getElementById('bulk-checkout-emergency-btn')?.addEventListener('click', () => {
      this.performEmergencyCheckout();
    });
  }

  async activateEmergencyMode() {
    try {
      console.log('[Emergency] Activating emergency mode');
      
      this.isEmergencyMode = true;
      this.emergencyStartTime = new Date().toISOString();
      
      // Log emergency activation
      await window.StorageManager.logActivity('emergency_mode_activated', {
        timestamp: this.emergencyStartTime,
        currentOccupancy: window.StorageManager.getCurrentOccupancy()
      });
      
      // Update UI
      this.updateEmergencyUI();
      
      // Show emergency notification
      if (window.app) {
        window.app.showToast('Emergency Mode Activated', 'warning');
      }
      
      // Play emergency sound if available
      if (window.NotificationSound) {
        window.NotificationSound.play('emergency');
      }
      
      console.log('[Emergency] Emergency mode activated successfully');
      
    } catch (error) {
      console.error('[Emergency] Error activating emergency mode:', error);
      throw new Error('Failed to activate emergency mode');
    }
  }

  async deactivateEmergencyMode() {
    try {
      console.log('[Emergency] Deactivating emergency mode');
      
      const duration = Date.now() - new Date(this.emergencyStartTime).getTime();
      
      this.isEmergencyMode = false;
      
      // Log emergency deactivation
      await window.StorageManager.logActivity('emergency_mode_deactivated', {
        startTime: this.emergencyStartTime,
        endTime: new Date().toISOString(),
        duration: duration
      });
      
      this.emergencyStartTime = null;
      this.evacuationList = [];
      this.missingPersons = [];
      
      // Update UI
      this.updateEmergencyUI();
      
      if (window.app) {
        window.app.showToast('Emergency Mode Deactivated', 'success');
      }
      
      console.log('[Emergency] Emergency mode deactivated successfully');
      
    } catch (error) {
      console.error('[Emergency] Error deactivating emergency mode:', error);
      throw new Error('Failed to deactivate emergency mode');
    }
  }

  async generateEvacuationList() {
    try {
      console.log('[Emergency] Generating evacuation list');
      
      this.evacuationList = window.StorageManager.getEmergencyEvacuationList();
      
      // Log evacuation list generation
      await window.StorageManager.logActivity('evacuation_list_generated', {
        totalOccupants: this.evacuationList.length,
        timestamp: new Date().toISOString()
      });
      
      // Display evacuation list
      this.displayEvacuationList();
      
      if (window.app) {
        window.app.showToast(`Evacuation list generated: ${this.evacuationList.length} occupants`, 'warning');
      }
      
    } catch (error) {
      console.error('[Emergency] Error generating evacuation list:', error);
      if (window.app) {
        window.app.showError('Failed to generate evacuation list');
      }
    }
  }

  displayEvacuationList() {
    const emergencyContent = document.getElementById('emergency-content');
    if (!emergencyContent) return;
    
    if (this.evacuationList.length === 0) {
      emergencyContent.innerHTML = `
        <div class="emergency-message">
          <span class="material-icons">check_circle</span>
          <h3>Building Empty</h3>
          <p>No occupants currently checked in. Building is clear for evacuation.</p>
        </div>
      `;
      return;
    }
    
    const html = `
      <div class="evacuation-list">
        <div class="evacuation-header">
          <h3>
            <span class="material-icons">list</span>
            Evacuation List
          </h3>
          <div class="evacuation-stats">
            <span class="occupant-count">${this.evacuationList.length} occupants to evacuate</span>
            <span class="generated-time">Generated: ${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="evacuation-actions">
            <button class="action-button secondary" onclick="emergencyManager.printEvacuationList()">
              <span class="material-icons">print</span>
              Print List
            </button>
            <button class="action-button primary" onclick="emergencyManager.exportEvacuationList()">
              <span class="material-icons">download</span>
              Export List
            </button>
          </div>
        </div>
        
        <div class="evacuation-grid">
          ${this.evacuationList.map(person => this.createEvacuationCard(person)).join('')}
        </div>
        
        <div class="evacuation-summary">
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-label">Employees:</span>
              <span class="stat-value">${this.evacuationList.filter(p => p.role === 'employee').length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Contractors:</span>
              <span class="stat-value">${this.evacuationList.filter(p => p.role === 'contractor').length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Visitors:</span>
              <span class="stat-value">${this.evacuationList.filter(p => p.role === 'visitor').length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">VIPs:</span>
              <span class="stat-value">${this.evacuationList.filter(p => p.role === 'vip').length}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    emergencyContent.innerHTML = html;
  }

  createEvacuationCard(person) {
    const checkInTime = person.checkedInAt ? new Date(person.checkedInAt).toLocaleTimeString() : 'Unknown';
    const roleClass = person.role.toLowerCase();
    
    return `
      <div class="evacuation-card ${roleClass}">
        <div class="evacuation-card-header">
          <div class="person-info">
            <div class="person-name">${person.name}</div>
            <div class="person-role">${person.role.toUpperCase()}</div>
          </div>
          <div class="evacuation-status">
            <span class="status-indicator"></span>
            <span class="status-text">To Evacuate</span>
          </div>
        </div>
        <div class="evacuation-card-body">
          <div class="info-row">
            <span class="info-label">Company:</span>
            <span class="info-value">${person.company || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${person.phone || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Checked In:</span>
            <span class="info-value">${checkInTime}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Emergency Contact:</span>
            <span class="info-value">${person.emergencyContact || 'Not provided'}</span>
          </div>
        </div>
        <div class="evacuation-card-actions">
          <button class="evacuation-action-btn" onclick="emergencyManager.markEvacuated('${person.id}')">
            <span class="material-icons">check</span>
            Mark Evacuated
          </button>
        </div>
      </div>
    `;
  }

  async markEvacuated(personId) {
    try {
      const person = this.evacuationList.find(p => p.id === personId);
      if (!person) return;
      
      // Check out the person
      await window.StorageManager.checkOut(personId);
      
      // Remove from evacuation list
      this.evacuationList = this.evacuationList.filter(p => p.id !== personId);
      
      // Log evacuation
      await window.StorageManager.logActivity('person_evacuated', {
        personnelId: personId,
        name: person.name,
        timestamp: new Date().toISOString()
      });
      
      // Update display
      this.displayEvacuationList();
      
      if (window.app) {
        window.app.showToast(`${person.name} marked as evacuated`, 'success');
      }
      
    } catch (error) {
      console.error('[Emergency] Error marking person as evacuated:', error);
      if (window.app) {
        window.app.showError('Failed to mark person as evacuated');
      }
    }
  }

  async identifyMissingPersons() {
    try {
      console.log('[Emergency] Identifying missing persons');
      
      // For this implementation, we'll consider people who were checked in
      // but haven't been marked as evacuated as potentially missing
      const checkedInPeople = window.StorageManager.getCheckedInPersonnel();
      this.missingPersons = [...checkedInPeople];
      
      // Log missing persons check
      await window.StorageManager.logActivity('missing_persons_check', {
        potentialMissing: this.missingPersons.length,
        timestamp: new Date().toISOString()
      });
      
      // Display missing persons
      this.displayMissingPersons();
      
      if (window.app) {
        window.app.showToast(`Missing persons check complete: ${this.missingPersons.length} unaccounted`, 'warning');
      }
      
    } catch (error) {
      console.error('[Emergency] Error identifying missing persons:', error);
      if (window.app) {
        window.app.showError('Failed to identify missing persons');
      }
    }
  }

  displayMissingPersons() {
    const emergencyContent = document.getElementById('emergency-content');
    if (!emergencyContent) return;
    
    if (this.missingPersons.length === 0) {
      emergencyContent.innerHTML = `
        <div class="emergency-message success">
          <span class="material-icons">verified</span>
          <h3>All Accounted For</h3>
          <p>No missing persons identified. All registered occupants have been evacuated.</p>
        </div>
      `;
      return;
    }
    
    const html = `
      <div class="missing-persons-list">
        <div class="missing-header">
          <h3>
            <span class="material-icons">person_search</span>
            Missing Persons Alert
          </h3>
          <div class="missing-stats">
            <span class="missing-count">${this.missingPersons.length} persons unaccounted</span>
            <span class="urgency-level">HIGH PRIORITY</span>
          </div>
        </div>
        
        <div class="missing-grid">
          ${this.missingPersons.map(person => this.createMissingPersonCard(person)).join('')}
        </div>
        
        <div class="missing-actions">
          <button class="action-button danger" onclick="emergencyManager.alertEmergencyServices()">
            <span class="material-icons">local_phone</span>
            Alert Emergency Services
          </button>
          <button class="action-button secondary" onclick="emergencyManager.exportMissingPersonsList()">
            <span class="material-icons">share</span>
            Share with First Responders
          </button>
        </div>
      </div>
    `;
    
    emergencyContent.innerHTML = html;
  }

  createMissingPersonCard(person) {
    const lastSeen = person.checkedInAt ? new Date(person.checkedInAt).toLocaleString() : 'Unknown';
    
    return `
      <div class="missing-person-card">
        <div class="missing-person-photo">
          ${person.photo ? 
            `<img src="${person.photo}" alt="${person.name}">` :
            `<span class="material-icons">person</span>`
          }
        </div>
        <div class="missing-person-info">
          <div class="missing-person-name">${person.name}</div>
          <div class="missing-person-role">${person.role.toUpperCase()}</div>
          <div class="missing-person-details">
            <div class="detail-item">
              <span class="detail-label">Company:</span>
              <span class="detail-value">${person.company || 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Phone:</span>
              <span class="detail-value">${person.phone || 'N/A'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Last Seen:</span>
              <span class="detail-value">${lastSeen}</span>
            </div>
          </div>
        </div>
        <div class="missing-person-actions">
          <button class="missing-action-btn found" onclick="emergencyManager.markFound('${person.id}')">
            <span class="material-icons">check_circle</span>
            Found
          </button>
          <button class="missing-action-btn contact" onclick="emergencyManager.contactPerson('${person.id}')">
            <span class="material-icons">call</span>
            Contact
          </button>
        </div>
      </div>
    `;
  }

  async markFound(personId) {
    try {
      const person = this.missingPersons.find(p => p.id === personId);
      if (!person) return;
      
      // Remove from missing persons list
      this.missingPersons = this.missingPersons.filter(p => p.id !== personId);
      
      // Check out the person
      await window.StorageManager.checkOut(personId);
      
      // Log person found
      await window.StorageManager.logActivity('missing_person_found', {
        personnelId: personId,
        name: person.name,
        timestamp: new Date().toISOString()
      });
      
      // Update display
      this.displayMissingPersons();
      
      if (window.app) {
        window.app.showToast(`${person.name} marked as found and evacuated`, 'success');
      }
      
    } catch (error) {
      console.error('[Emergency] Error marking person as found:', error);
      if (window.app) {
        window.app.showError('Failed to mark person as found');
      }
    }
  }

  contactPerson(personId) {
    const person = this.missingPersons.find(p => p.id === personId);
    if (!person || !person.phone) {
      if (window.app) {
        window.app.showToast('No phone number available for this person', 'warning');
      }
      return;
    }
    
    // Create phone link
    const phoneLink = `tel:${person.phone}`;
    window.open(phoneLink);
    
    // Log contact attempt
    window.StorageManager.logActivity('emergency_contact_attempt', {
      personnelId: personId,
      name: person.name,
      phone: person.phone,
      timestamp: new Date().toISOString()
    });
  }

  async performEmergencyCheckout() {
    try {
      console.log('[Emergency] Performing emergency checkout');
      
      const results = await window.StorageManager.emergencyCheckoutAll();
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      if (window.app) {
        if (failureCount === 0) {
          window.app.showToast(`Emergency checkout completed: ${successCount} people checked out`, 'success');
        } else {
          window.app.showToast(`Emergency checkout completed with ${failureCount} errors: ${successCount} people checked out`, 'warning');
        }
      }
      
      // Update dashboard and lists
      if (window.app) {
        await window.app.updateDashboard();
      }
      
      // Clear evacuation and missing persons lists
      this.evacuationList = [];
      this.missingPersons = [];
      this.updateContent();
      
    } catch (error) {
      console.error('[Emergency] Error performing emergency checkout:', error);
      if (window.app) {
        window.app.showError('Failed to perform emergency checkout');
      }
    }
  }

  alertEmergencyServices() {
    const modalContent = `
      <div class="emergency-alert-modal">
        <div class="modal-header">
          <h3>Alert Emergency Services</h3>
          <span class="material-icons emergency-icon">warning</span>
        </div>
        <div class="modal-body">
          <p><strong>Emergency Contact Information:</strong></p>
          <div class="emergency-contacts">
            <div class="contact-item">
              <span class="contact-label">Emergency Services:</span>
              <a href="tel:911" class="contact-link">911</a>
            </div>
            <div class="contact-item">
              <span class="contact-label">Building Security:</span>
              <a href="tel:555-0123" class="contact-link">555-0123</a>
            </div>
            <div class="contact-item">
              <span class="contact-label">Facility Manager:</span>
              <a href="tel:555-0456" class="contact-link">555-0456</a>
            </div>
          </div>
          <p><strong>Missing Persons Count:</strong> ${this.missingPersons.length}</p>
          <p><strong>Building Address:</strong> [Configure in settings]</p>
          <div class="form-actions">
            <button class="action-button secondary" onclick="window.app.closeModal()">
              Cancel
            </button>
            <button class="action-button danger" onclick="emergencyManager.confirmEmergencyAlert()">
              <span class="material-icons">phone</span>
              Call 911
            </button>
          </div>
        </div>
      </div>
    `;
    
    if (window.app) {
      window.app.showModal(modalContent);
    }
  }

  confirmEmergencyAlert() {
    // Log emergency services alert
    window.StorageManager.logActivity('emergency_services_alerted', {
      missingPersonsCount: this.missingPersons.length,
      timestamp: new Date().toISOString()
    });
    
    // Open phone dialer
    window.open('tel:911');
    
    if (window.app) {
      window.app.closeModal();
      window.app.showToast('Emergency services contacted', 'warning');
    }
  }

  async updateContent() {
    const emergencyContent = document.getElementById('emergency-content');
    if (!emergencyContent) return;
    
    if (!this.evacuationList.length && !this.missingPersons.length) {
      emergencyContent.innerHTML = `
        <div class="emergency-ready">
          <span class="material-icons">shield</span>
          <h3>Emergency System Ready</h3>
          <p>All emergency protocols are available. Use the buttons above to activate emergency procedures.</p>
          <div class="emergency-stats">
            <div class="stat">
              <span class="stat-number">${window.StorageManager.getCurrentOccupancy()}</span>
              <span class="stat-label">Current Occupancy</span>
            </div>
            <div class="stat">
              <span class="stat-number">${window.StorageManager.getAllPersonnel().length}</span>
              <span class="stat-label">Total Personnel</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  updateEmergencyUI() {
    const emergencyButton = document.getElementById('emergency-btn');
    if (emergencyButton) {
      if (this.isEmergencyMode) {
        emergencyButton.classList.add('active');
        emergencyButton.setAttribute('aria-label', 'Deactivate Emergency Mode');
      } else {
        emergencyButton.classList.remove('active');
        emergencyButton.setAttribute('aria-label', 'Emergency Mode');
      }
    }
  }

  // Export functions
  async printEvacuationList() {
    try {
      const printContent = this.generateEvacuationListHTML();
      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('[Emergency] Error printing evacuation list:', error);
      if (window.app) {
        window.app.showError('Failed to print evacuation list');
      }
    }
  }

  async exportEvacuationList() {
    try {
      if (window.ExportManager) {
        const evacuationData = {
          timestamp: new Date().toISOString(),
          evacuationList: this.evacuationList,
          totalOccupants: this.evacuationList.length,
          emergencyStartTime: this.emergencyStartTime
        };
        
        const jsonString = JSON.stringify(evacuationData, null, 2);
        const filename = `evacuation_list_${new Date().toISOString().split('T')[0]}.json`;
        
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        if (window.app) {
          window.app.showToast('Evacuation list exported successfully', 'success');
        }
      }
    } catch (error) {
      console.error('[Emergency] Error exporting evacuation list:', error);
      if (window.app) {
        window.app.showError('Failed to export evacuation list');
      }
    }
  }

  generateEvacuationListHTML() {
    const currentTime = new Date().toLocaleString();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Emergency Evacuation List</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; border-bottom: 2px solid #F44336; padding-bottom: 20px; margin-bottom: 30px; }
          .emergency-title { color: #F44336; font-size: 24px; font-weight: bold; }
          .timestamp { color: #666; margin-top: 10px; }
          .stats { background: #FFEBEE; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .person-item { border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
          .person-name { font-weight: bold; font-size: 16px; }
          .person-details { margin-top: 5px; color: #666; }
          .role { text-transform: uppercase; font-weight: bold; }
          .employee { border-left: 4px solid #4CAF50; }
          .contractor { border-left: 4px solid #FF9800; }
          .visitor { border-left: 4px solid #2196F3; }
          .vip { border-left: 4px solid #9C27B0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="emergency-title">EMERGENCY EVACUATION LIST</div>
          <div class="timestamp">Generated: ${currentTime}</div>
        </div>
        
        <div class="stats">
          <strong>Total Occupants to Evacuate:</strong> ${this.evacuationList.length}<br>
          <strong>Emergency Activated:</strong> ${this.emergencyStartTime ? new Date(this.emergencyStartTime).toLocaleString() : 'N/A'}
        </div>
        
        ${this.evacuationList.map(person => `
          <div class="person-item ${person.role}">
            <div class="person-name">${person.name}</div>
            <div class="person-details">
              <div><strong>Role:</strong> <span class="role">${person.role}</span></div>
              <div><strong>Company:</strong> ${person.company || 'N/A'}</div>
              <div><strong>Phone:</strong> ${person.phone || 'N/A'}</div>
              <div><strong>Checked In:</strong> ${person.checkedInAt ? new Date(person.checkedInAt).toLocaleString() : 'Unknown'}</div>
              <div><strong>Emergency Contact:</strong> ${person.emergencyContact || 'Not provided'}</div>
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
  }
}

// Create global instance
window.EmergencyManager = new EmergencyManager();

// Make methods available globally for HTML onclick handlers
window.emergencyManager = {
  markEvacuated: (id) => window.EmergencyManager.markEvacuated(id),
  markFound: (id) => window.EmergencyManager.markFound(id),
  contactPerson: (id) => window.EmergencyManager.contactPerson(id),
  printEvacuationList: () => window.EmergencyManager.printEvacuationList(),
  exportEvacuationList: () => window.EmergencyManager.exportEvacuationList(),
  alertEmergencyServices: () => window.EmergencyManager.alertEmergencyServices(),
  confirmEmergencyAlert: () => window.EmergencyManager.confirmEmergencyAlert(),
  exportMissingPersonsList: () => window.EmergencyManager.exportEvacuationList()
};

console.log('[Emergency] Emergency Manager loaded');

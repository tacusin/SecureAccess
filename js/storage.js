/**
 * Secure Access - Storage Manager
 * Handles data persistence with localStorage and offline capabilities
 */

class StorageManager {
  constructor() {
    this.storageKey = 'security_access_data';
    this.personnelKey = 'personnel_data';
    this.activityKey = 'activity_log';
    this.settingsKey = 'app_settings';
    
    this.data = {
      personnel: [],
      activities: [],
      settings: {
        autoSave: true,
        dataRetentionDays: 90,
        exportFormat: 'csv',
        theme: 'light'
      }
    };
    
    this.isInitialized = false;
  }

  async init() {
    try {
      console.log('[Storage] Initializing Storage Manager');
      
      // Load data from localStorage
      await this.loadFromStorage();
      
      // Setup auto-save
      this.setupAutoSave();
      
      // Cleanup old data
      this.cleanupOldData();
      
      this.isInitialized = true;
      console.log('[Storage] Storage Manager initialized successfully');
      
    } catch (error) {
      console.error('[Storage] Error initializing storage:', error);
      throw new Error('Failed to initialize storage');
    }
  }

  async loadFromStorage() {
    try {
      // Load main data
      const storedData = localStorage.getItem(this.storageKey);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        this.data = { ...this.data, ...parsed };
      }
      
      // Load personnel data
      const personnelData = localStorage.getItem(this.personnelKey);
      if (personnelData) {
        this.data.personnel = JSON.parse(personnelData);
      }
      
      // Load activity log
      const activityData = localStorage.getItem(this.activityKey);
      if (activityData) {
        this.data.activities = JSON.parse(activityData);
      }
      
      // Load settings
      const settingsData = localStorage.getItem(this.settingsKey);
      if (settingsData) {
        this.data.settings = { ...this.data.settings, ...JSON.parse(settingsData) };
      }
      
      console.log('[Storage] Data loaded from localStorage');
      
    } catch (error) {
      console.error('[Storage] Error loading from storage:', error);
      // Continue with empty data if loading fails
      this.data = {
        personnel: [],
        activities: [],
        settings: this.data.settings
      };
    }
  }

  async saveToStorage() {
    try {
      // Save main data
      localStorage.setItem(this.storageKey, JSON.stringify({
        lastSaved: new Date().toISOString(),
        version: '1.0.0'
      }));
      
      // Save personnel data
      localStorage.setItem(this.personnelKey, JSON.stringify(this.data.personnel));
      
      // Save activity log
      localStorage.setItem(this.activityKey, JSON.stringify(this.data.activities));
      
      // Save settings
      localStorage.setItem(this.settingsKey, JSON.stringify(this.data.settings));
      
      console.log('[Storage] Data saved to localStorage');
      
    } catch (error) {
      console.error('[Storage] Error saving to storage:', error);
      throw new Error('Failed to save data');
    }
  }

  setupAutoSave() {
    if (this.data.settings.autoSave) {
      // Save data every 30 seconds
      setInterval(() => {
        this.saveToStorage();
      }, 30000);
    }
  }

  // Personnel Management
  async addPersonnel(personnelData) {
    try {
      const person = {
        id: this.generateId(),
        name: personnelData.name,
        role: personnelData.role || 'visitor',
        company: personnelData.company || '',
        phone: personnelData.phone || '',
        email: personnelData.email || '',
        notes: personnelData.notes || '',
        photo: personnelData.photo || null,
        status: 'checked-out',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActivity: null,
        checkedInAt: null,
        totalVisits: 0,
        totalTimeSpent: 0
      };
      
      this.data.personnel.push(person);
      await this.saveToStorage();
      
      // Log activity
      await this.logActivity('personnel_added', {
        personnelId: person.id,
        name: person.name,
        role: person.role
      });
      
      console.log('[Storage] Personnel added:', person.name);
      return person;
      
    } catch (error) {
      console.error('[Storage] Error adding personnel:', error);
      throw new Error('Failed to add personnel');
    }
  }

  async updatePersonnel(personnelId, updates) {
    try {
      const personIndex = this.data.personnel.findIndex(p => p.id === personnelId);
      if (personIndex === -1) {
        throw new Error('Personnel not found');
      }
      
      const person = this.data.personnel[personIndex];
      const updatedPerson = {
        ...person,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      this.data.personnel[personIndex] = updatedPerson;
      await this.saveToStorage();
      
      // Log activity
      await this.logActivity('personnel_updated', {
        personnelId: person.id,
        name: person.name,
        changes: updates
      });
      
      console.log('[Storage] Personnel updated:', person.name);
      return updatedPerson;
      
    } catch (error) {
      console.error('[Storage] Error updating personnel:', error);
      throw new Error('Failed to update personnel');
    }
  }

  async deletePersonnel(personnelId) {
    try {
      const personIndex = this.data.personnel.findIndex(p => p.id === personnelId);
      if (personIndex === -1) {
        throw new Error('Personnel not found');
      }
      
      const person = this.data.personnel[personIndex];
      this.data.personnel.splice(personIndex, 1);
      await this.saveToStorage();
      
      // Log activity
      await this.logActivity('personnel_deleted', {
        personnelId: person.id,
        name: person.name
      });
      
      console.log('[Storage] Personnel deleted:', person.name);
      return true;
      
    } catch (error) {
      console.error('[Storage] Error deleting personnel:', error);
      throw new Error('Failed to delete personnel');
    }
  }

  getPersonnel(personnelId) {
    return this.data.personnel.find(p => p.id === personnelId);
  }

  getAllPersonnel() {
    return [...this.data.personnel];
  }

  getPersonnelByRole(role) {
    return this.data.personnel.filter(p => p.role === role);
  }

  searchPersonnel(query) {
    const searchTerm = query.toLowerCase();
    return this.data.personnel.filter(person => 
      person.name.toLowerCase().includes(searchTerm) ||
      person.role.toLowerCase().includes(searchTerm) ||
      person.company.toLowerCase().includes(searchTerm)
    );
  }

  // Check-in/Check-out Management
  async checkIn(personnelId) {
    try {
      const person = this.getPersonnel(personnelId);
      if (!person) {
        throw new Error('Personnel not found');
      }
      
      if (person.status === 'checked-in') {
        throw new Error('Person is already checked in');
      }
      
      const now = new Date().toISOString();
      const updatedPerson = await this.updatePersonnel(personnelId, {
        status: 'checked-in',
        checkedInAt: now,
        lastActivity: now,
        totalVisits: person.totalVisits + 1
      });
      
      // Log activity
      await this.logActivity('check_in', {
        personnelId: person.id,
        name: person.name,
        timestamp: now
      });
      
      console.log('[Storage] Check-in successful:', person.name);
      return updatedPerson;
      
    } catch (error) {
      console.error('[Storage] Error during check-in:', error);
      throw error;
    }
  }

  async checkOut(personnelId) {
    try {
      const person = this.getPersonnel(personnelId);
      if (!person) {
        throw new Error('Personnel not found');
      }
      
      if (person.status === 'checked-out') {
        throw new Error('Person is already checked out');
      }
      
      const now = new Date().toISOString();
      const checkedInTime = new Date(person.checkedInAt);
      const timeSpent = Date.now() - checkedInTime.getTime();
      
      const updatedPerson = await this.updatePersonnel(personnelId, {
        status: 'checked-out',
        checkedInAt: null,
        lastActivity: now,
        totalTimeSpent: person.totalTimeSpent + timeSpent
      });
      
      // Log activity
      await this.logActivity('check_out', {
        personnelId: person.id,
        name: person.name,
        timestamp: now,
        duration: timeSpent
      });
      
      console.log('[Storage] Check-out successful:', person.name);
      return updatedPerson;
      
    } catch (error) {
      console.error('[Storage] Error during check-out:', error);
      throw error;
    }
  }

  getCurrentOccupancy() {
    return this.data.personnel.filter(p => p.status === 'checked-in').length;
  }

  getCheckedInPersonnel() {
    return this.data.personnel.filter(p => p.status === 'checked-in');
  }

  getCheckedOutPersonnel() {
    return this.data.personnel.filter(p => p.status === 'checked-out');
  }

  // Statistics and Analytics
  getTodaysStats() {
    const today = new Date().toDateString();
    const todaysActivities = this.data.activities.filter(activity => {
      const activityDate = new Date(activity.timestamp).toDateString();
      return activityDate === today;
    });
    
    const checkins = todaysActivities.filter(a => a.action === 'check_in').length;
    const checkouts = todaysActivities.filter(a => a.action === 'check_out').length;
    
    return { checkins, checkouts };
  }

  getWeeklyStats() {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyActivities = this.data.activities.filter(activity => {
      const activityDate = new Date(activity.timestamp);
      return activityDate >= oneWeekAgo;
    });
    
    const dailyStats = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toDateString();
      const dayActivities = weeklyActivities.filter(a => 
        new Date(a.timestamp).toDateString() === date
      );
      
      dailyStats[date] = {
        checkins: dayActivities.filter(a => a.action === 'check_in').length,
        checkouts: dayActivities.filter(a => a.action === 'check_out').length
      };
    }
    
    return dailyStats;
  }

  getOccupancyTrends() {
    // Get hourly occupancy data for the last 24 hours
    const trends = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourStart = new Date(hour);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      // Calculate occupancy for this hour
      const hourlyActivities = this.data.activities.filter(activity => {
        const activityTime = new Date(activity.timestamp);
        return activityTime >= hourStart && activityTime < hourEnd;
      });
      
      let occupancy = 0;
      hourlyActivities.forEach(activity => {
        if (activity.action === 'check_in') occupancy++;
        if (activity.action === 'check_out') occupancy--;
      });
      
      trends.push({
        hour: hourStart.getHours(),
        occupancy: Math.max(0, occupancy)
      });
    }
    
    return trends;
  }

  getAverageVisitDuration() {
    const completedVisits = this.data.activities.filter(a => a.action === 'check_out');
    if (completedVisits.length === 0) return 0;
    
    const totalDuration = completedVisits.reduce((sum, activity) => 
      sum + (activity.data.duration || 0), 0
    );
    
    return totalDuration / completedVisits.length;
  }

  getFrequentVisitors(limit = 10) {
    return this.data.personnel
      .sort((a, b) => b.totalVisits - a.totalVisits)
      .slice(0, limit);
  }

  // Activity Logging
  async logActivity(action, data = {}) {
    try {
      const activity = {
        id: this.generateId(),
        action,
        timestamp: new Date().toISOString(),
        data,
        userId: 'current_user' // In a real app, this would be the logged-in user
      };
      
      this.data.activities.push(activity);
      
      // Keep only recent activities to prevent storage bloat
      const maxActivities = 10000;
      if (this.data.activities.length > maxActivities) {
        this.data.activities = this.data.activities.slice(-maxActivities);
      }
      
      await this.saveToStorage();
      console.log('[Storage] Activity logged:', action);
      
    } catch (error) {
      console.error('[Storage] Error logging activity:', error);
    }
  }

  getActivityLog(limit = 100) {
    return this.data.activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getActivityLogByAction(action, limit = 100) {
    return this.data.activities
      .filter(a => a.action === action)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  // Settings Management
  getSetting(key) {
    return this.data.settings[key];
  }

  async setSetting(key, value) {
    try {
      this.data.settings[key] = value;
      await this.saveToStorage();
      console.log(`[Storage] Setting updated: ${key} = ${value}`);
    } catch (error) {
      console.error('[Storage] Error updating setting:', error);
      throw new Error('Failed to update setting');
    }
  }

  getAllSettings() {
    return { ...this.data.settings };
  }

  // Data Management
  async exportData() {
    try {
      const exportData = {
        personnel: this.data.personnel,
        activities: this.data.activities,
        settings: this.data.settings,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('[Storage] Error exporting data:', error);
      throw new Error('Failed to export data');
    }
  }

  async importData(jsonData) {
    try {
      const importedData = JSON.parse(jsonData);
      
      // Validate data structure
      if (!importedData.personnel || !Array.isArray(importedData.personnel)) {
        throw new Error('Invalid data format');
      }
      
      // Merge with existing data
      this.data.personnel = [...this.data.personnel, ...importedData.personnel];
      
      if (importedData.activities) {
        this.data.activities = [...this.data.activities, ...importedData.activities];
      }
      
      if (importedData.settings) {
        this.data.settings = { ...this.data.settings, ...importedData.settings };
      }
      
      await this.saveToStorage();
      console.log('[Storage] Data imported successfully');
      
    } catch (error) {
      console.error('[Storage] Error importing data:', error);
      throw new Error('Failed to import data');
    }
  }

  async clearAllData() {
    try {
      this.data = {
        personnel: [],
        activities: [],
        settings: { ...this.data.settings }
      };
      
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.personnelKey);
      localStorage.removeItem(this.activityKey);
      
      await this.saveToStorage();
      console.log('[Storage] All data cleared');
      
    } catch (error) {
      console.error('[Storage] Error clearing data:', error);
      throw new Error('Failed to clear data');
    }
  }

  cleanupOldData() {
    try {
      const retentionDays = this.data.settings.dataRetentionDays || 90;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      // Remove old activities
      this.data.activities = this.data.activities.filter(activity => 
        new Date(activity.timestamp) > cutoffDate
      );
      
      console.log('[Storage] Old data cleanup completed');
      
    } catch (error) {
      console.error('[Storage] Error during data cleanup:', error);
    }
  }

  // Offline Support
  async syncOfflineData() {
    try {
      // In a real application, this would sync with a remote server
      console.log('[Storage] Syncing offline data...');
      
      // For now, just ensure data is saved locally
      await this.saveToStorage();
      
      console.log('[Storage] Offline data sync completed');
      
    } catch (error) {
      console.error('[Storage] Error syncing offline data:', error);
      throw new Error('Failed to sync offline data');
    }
  }

  isOnline() {
    return navigator.onLine;
  }

  // Utility functions
  generateId() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Emergency functions
  async emergencyCheckoutAll() {
    try {
      const checkedInPeople = this.getCheckedInPersonnel();
      const results = [];
      
      for (const person of checkedInPeople) {
        try {
          await this.checkOut(person.id);
          results.push({ success: true, person: person.name });
        } catch (error) {
          results.push({ success: false, person: person.name, error: error.message });
        }
      }
      
      // Log emergency action
      await this.logActivity('emergency_checkout_all', {
        totalPeople: checkedInPeople.length,
        results
      });
      
      console.log('[Storage] Emergency checkout completed');
      return results;
      
    } catch (error) {
      console.error('[Storage] Error during emergency checkout:', error);
      throw new Error('Failed to complete emergency checkout');
    }
  }

  getEmergencyEvacuationList() {
    const checkedInPeople = this.getCheckedInPersonnel();
    return checkedInPeople.map(person => ({
      id: person.id,
      name: person.name,
      role: person.role,
      company: person.company,
      phone: person.phone,
      checkedInAt: person.checkedInAt,
      emergencyContact: person.emergencyContact || 'Not provided'
    }));
  }
}

// Create global instance
window.StorageManager = new StorageManager();

console.log('[Storage] Storage Manager loaded');

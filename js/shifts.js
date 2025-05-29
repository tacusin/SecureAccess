/**
 * Secure Access - Shift Management
 * Handles shift transitions, handover documentation, and shift-related tracking
 */

class ShiftManager {
  constructor() {
    this.currentShift = null;
    this.shifts = [];
    this.handoverNotes = [];
    this.shiftTypes = [
      { id: 'day', name: 'Day Shift', start: '06:00', end: '14:00', color: '#FFC107' },
      { id: 'afternoon', name: 'Afternoon Shift', start: '14:00', end: '22:00', color: '#FF9800' },
      { id: 'night', name: 'Night Shift', start: '22:00', end: '06:00', color: '#3F51B5' },
      { id: 'custom', name: 'Custom Shift', start: '00:00', end: '23:59', color: '#9C27B0' }
    ];
    this.isInitialized = false;
  }

  async init() {
    try {
      console.log('[Shifts] Initializing Shift Manager');
      
      // Load existing shift data
      await this.loadShiftData();
      
      // Check for active shift
      await this.checkActiveShift();
      
      // Setup shift monitoring
      this.setupShiftMonitoring();
      
      this.isInitialized = true;
      console.log('[Shifts] Shift Manager initialized successfully');
      
    } catch (error) {
      console.error('[Shifts] Error initializing Shift Manager:', error);
      throw new Error('Failed to initialize shift management');
    }
  }

  async loadShiftData() {
    const shiftsData = window.StorageManager.getSetting('shifts') || [];
    const handoverData = window.StorageManager.getSetting('handovers') || [];
    const currentShiftData = window.StorageManager.getSetting('currentShift');
    
    this.shifts = shiftsData;
    this.handoverNotes = handoverData;
    this.currentShift = currentShiftData;
  }

  async saveShiftData() {
    await window.StorageManager.setSetting('shifts', this.shifts);
    await window.StorageManager.setSetting('handovers', this.handoverNotes);
    await window.StorageManager.setSetting('currentShift', this.currentShift);
  }

  async checkActiveShift() {
    if (this.currentShift && this.currentShift.endTime && Date.now() > this.currentShift.endTime) {
      // Current shift has ended
      await this.endShift(this.currentShift.id, 'Automatic end - shift time expired');
    }
  }

  setupShiftMonitoring() {
    // Check shift status every 5 minutes
    setInterval(() => this.checkActiveShift(), 5 * 60 * 1000);
    
    // Warn about upcoming shift end
    setInterval(() => this.checkShiftWarnings(), 60 * 1000);
  }

  checkShiftWarnings() {
    if (!this.currentShift || !this.currentShift.endTime) return;
    
    const timeUntilEnd = this.currentShift.endTime - Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    const tenMinutes = 10 * 60 * 1000;
    
    if (timeUntilEnd <= tenMinutes && timeUntilEnd > 0 && !this.currentShift.tenMinuteWarningShown) {
      this.showShiftWarning('Shift ends in 10 minutes. Prepare for handover.');
      this.currentShift.tenMinuteWarningShown = true;
      this.saveShiftData();
    } else if (timeUntilEnd <= thirtyMinutes && timeUntilEnd > tenMinutes && !this.currentShift.thirtyMinuteWarningShown) {
      this.showShiftWarning('Shift ends in 30 minutes.');
      this.currentShift.thirtyMinuteWarningShown = true;
      this.saveShiftData();
    }
  }

  showShiftWarning(message) {
    if (window.app) {
      window.app.showToast(message, 'warning');
    }
  }

  async startShift(officerName, shiftType, customStart = null, customEnd = null) {
    try {
      const shiftConfig = this.shiftTypes.find(type => type.id === shiftType);
      if (!shiftConfig) {
        throw new Error('Invalid shift type');
      }

      // End current shift if exists
      if (this.currentShift && !this.currentShift.endTime) {
        await this.endShift(this.currentShift.id, 'Ended by new shift start');
      }

      const now = Date.now();
      const today = new Date();
      
      let startTime, endTime;
      
      if (shiftType === 'custom' && customStart && customEnd) {
        const [startHour, startMin] = customStart.split(':');
        const [endHour, endMin] = customEnd.split(':');
        
        startTime = new Date(today);
        startTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
        
        endTime = new Date(today);
        endTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);
        
        // If end time is before start time, it's next day
        if (endTime <= startTime) {
          endTime.setDate(endTime.getDate() + 1);
        }
      } else {
        const [startHour, startMin] = shiftConfig.start.split(':');
        const [endHour, endMin] = shiftConfig.end.split(':');
        
        startTime = new Date(today);
        startTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
        
        endTime = new Date(today);
        endTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);
        
        // Handle overnight shifts
        if (shiftType === 'night' || endTime <= startTime) {
          endTime.setDate(endTime.getDate() + 1);
        }
      }

      const shift = {
        id: this.generateShiftId(),
        officerName,
        shiftType,
        shiftConfig,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        actualStartTime: now,
        status: 'active',
        activities: [],
        handoverReceived: null,
        thirtyMinuteWarningShown: false,
        tenMinuteWarningShown: false
      };

      this.currentShift = shift;
      this.shifts.push(shift);
      
      await this.saveShiftData();
      await window.StorageManager.logActivity('shift_started', {
        shiftId: shift.id,
        officerName,
        shiftType,
        startTime: shift.actualStartTime
      });

      console.log('[Shifts] Shift started:', shift);
      return shift;
      
    } catch (error) {
      console.error('[Shifts] Error starting shift:', error);
      throw error;
    }
  }

  async endShift(shiftId, reason = 'Normal end') {
    try {
      const shift = this.shifts.find(s => s.id === shiftId);
      if (!shift) {
        throw new Error('Shift not found');
      }

      const now = Date.now();
      shift.actualEndTime = now;
      shift.endReason = reason;
      shift.status = 'completed';

      // Calculate shift duration
      shift.duration = now - shift.actualStartTime;

      if (this.currentShift && this.currentShift.id === shiftId) {
        this.currentShift = null;
      }

      await this.saveShiftData();
      await window.StorageManager.logActivity('shift_ended', {
        shiftId,
        endTime: now,
        duration: shift.duration,
        reason
      });

      console.log('[Shifts] Shift ended:', shift);
      return shift;
      
    } catch (error) {
      console.error('[Shifts] Error ending shift:', error);
      throw error;
    }
  }

  async createHandover(fromOfficer, toOfficer, notes, incidents = [], keyPoints = []) {
    try {
      const handover = {
        id: this.generateHandoverId(),
        fromOfficer,
        toOfficer,
        timestamp: Date.now(),
        notes,
        incidents,
        keyPoints,
        currentOccupancy: window.StorageManager.getCurrentOccupancy(),
        checkedInPersonnel: window.StorageManager.getCheckedInPersonnel(),
        emergencyStatus: window.EmergencyManager ? window.EmergencyManager.isEmergencyActive() : false,
        acknowledged: false
      };

      this.handoverNotes.push(handover);
      
      // Link handover to current shift
      if (this.currentShift) {
        this.currentShift.handoverGiven = handover.id;
      }

      await this.saveShiftData();
      await window.StorageManager.logActivity('handover_created', {
        handoverId: handover.id,
        fromOfficer,
        toOfficer
      });

      console.log('[Shifts] Handover created:', handover);
      return handover;
      
    } catch (error) {
      console.error('[Shifts] Error creating handover:', error);
      throw error;
    }
  }

  async acknowledgeHandover(handoverId, acknowledgmentNotes = '') {
    try {
      const handover = this.handoverNotes.find(h => h.id === handoverId);
      if (!handover) {
        throw new Error('Handover not found');
      }

      handover.acknowledged = true;
      handover.acknowledgmentTime = Date.now();
      handover.acknowledgmentNotes = acknowledgmentNotes;

      // Link handover to receiving shift
      if (this.currentShift) {
        this.currentShift.handoverReceived = handoverId;
      }

      await this.saveShiftData();
      await window.StorageManager.logActivity('handover_acknowledged', {
        handoverId,
        officer: handover.toOfficer
      });

      console.log('[Shifts] Handover acknowledged:', handover);
      return handover;
      
    } catch (error) {
      console.error('[Shifts] Error acknowledging handover:', error);
      throw error;
    }
  }

  getCurrentShift() {
    return this.currentShift;
  }

  getRecentShifts(limit = 10) {
    return this.shifts
      .sort((a, b) => b.actualStartTime - a.actualStartTime)
      .slice(0, limit);
  }

  getShiftHistory(startDate, endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    return this.shifts.filter(shift => 
      shift.actualStartTime >= start && shift.actualStartTime <= end
    );
  }

  getPendingHandovers() {
    return this.handoverNotes.filter(handover => !handover.acknowledged);
  }

  getHandoverHistory(limit = 10) {
    return this.handoverNotes
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  generateShiftId() {
    return 'shift_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateHandoverId() {
    return 'handover_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  formatDuration(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  isAvailable() {
    return this.isInitialized;
  }

  getShiftTypes() {
    return this.shiftTypes;
  }
}

// Initialize and expose globally
window.ShiftManager = new ShiftManager();
console.log('[Shifts] Shift Manager loaded');
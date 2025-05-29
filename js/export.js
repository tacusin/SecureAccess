/**
 * Security Access Manager - Export Manager
 * Handles data export in various formats (CSV, PDF, JSON)
 */

class ExportManager {
  constructor() {
    this.isInitialized = false;
  }

  async init() {
    try {
      console.log('[Export] Initializing Export Manager');
      this.isInitialized = true;
      console.log('[Export] Export Manager initialized successfully');
    } catch (error) {
      console.error('[Export] Error initializing export manager:', error);
      throw new Error('Failed to initialize export manager');
    }
  }

  // CSV Export
  async exportCSV(options = {}) {
    try {
      console.log('[Export] Starting CSV export');
      
      const {
        includePersonnel = true,
        includeActivities = true,
        dateRange = null,
        filename = null
      } = options;
      
      let csvData = '';
      
      if (includePersonnel) {
        csvData += this.generatePersonnelCSV();
        csvData += '\n\n';
      }
      
      if (includeActivities) {
        csvData += this.generateActivitiesCSV(dateRange);
      }
      
      const finalFilename = filename || this.generateFilename('export', 'csv');
      this.downloadFile(csvData, finalFilename, 'text/csv');
      
      console.log('[Export] CSV export completed');
      return { success: true, filename: finalFilename };
      
    } catch (error) {
      console.error('[Export] Error exporting CSV:', error);
      throw new Error('Failed to export CSV file');
    }
  }

  generatePersonnelCSV() {
    const personnel = window.StorageManager.getAllPersonnel();
    
    const headers = [
      'ID',
      'Name',
      'Role',
      'Company',
      'Phone',
      'Email',
      'Status',
      'Total Visits',
      'Total Time Spent (hours)',
      'Last Activity',
      'Created At',
      'Notes'
    ];
    
    let csv = headers.join(',') + '\n';
    
    personnel.forEach(person => {
      const row = [
        this.escapeCsvValue(person.id),
        this.escapeCsvValue(person.name),
        this.escapeCsvValue(person.role),
        this.escapeCsvValue(person.company || ''),
        this.escapeCsvValue(person.phone || ''),
        this.escapeCsvValue(person.email || ''),
        this.escapeCsvValue(person.status),
        person.totalVisits || 0,
        this.formatDuration(person.totalTimeSpent || 0),
        this.escapeCsvValue(person.lastActivity || ''),
        this.escapeCsvValue(person.createdAt || ''),
        this.escapeCsvValue(person.notes || '')
      ];
      csv += row.join(',') + '\n';
    });
    
    return 'PERSONNEL DATA\n' + csv;
  }

  generateActivitiesCSV(dateRange = null) {
    let activities = window.StorageManager.getActivityLog(1000);
    
    if (dateRange) {
      const { startDate, endDate } = dateRange;
      activities = activities.filter(activity => {
        const activityDate = new Date(activity.timestamp);
        return activityDate >= startDate && activityDate <= endDate;
      });
    }
    
    const headers = [
      'Timestamp',
      'Action',
      'Personnel ID',
      'Personnel Name',
      'Duration (minutes)',
      'Additional Data'
    ];
    
    let csv = headers.join(',') + '\n';
    
    activities.forEach(activity => {
      const row = [
        this.escapeCsvValue(activity.timestamp),
        this.escapeCsvValue(activity.action),
        this.escapeCsvValue(activity.data.personnelId || ''),
        this.escapeCsvValue(activity.data.name || ''),
        activity.data.duration ? Math.round(activity.data.duration / 60000) : '',
        this.escapeCsvValue(JSON.stringify(activity.data))
      ];
      csv += row.join(',') + '\n';
    });
    
    return 'ACTIVITY LOG\n' + csv;
  }

  // PDF Export
  async exportPDF(options = {}) {
    try {
      console.log('[Export] Starting PDF export');
      
      const {
        includePersonnel = true,
        includeActivities = true,
        includeCharts = false,
        title = 'Security Access Report',
        filename = null
      } = options;
      
      const reportHtml = this.generateReportHTML({
        includePersonnel,
        includeActivities,
        includeCharts,
        title
      });
      
      // For a more robust solution, you'd use a library like jsPDF or Puppeteer
      // For now, we'll create a printable HTML report
      const finalFilename = filename || this.generateFilename('report', 'html');
      this.downloadFile(reportHtml, finalFilename, 'text/html');
      
      // Open print dialog
      const printWindow = window.open('', '_blank');
      printWindow.document.write(reportHtml);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
      
      console.log('[Export] PDF export completed (as HTML for printing)');
      return { success: true, filename: finalFilename };
      
    } catch (error) {
      console.error('[Export] Error exporting PDF:', error);
      throw new Error('Failed to export PDF file');
    }
  }

  generateReportHTML(options) {
    const { includePersonnel, includeActivities, title } = options;
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 20px;
            color: #333;
          }
          
          .header {
            text-align: center;
            border-bottom: 3px solid #1976D2;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .header h1 {
            color: #1976D2;
            margin: 0;
            font-size: 28px;
          }
          
          .header .subtitle {
            color: #666;
            font-size: 14px;
            margin-top: 5px;
          }
          
          .section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          
          .section h2 {
            color: #1976D2;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 12px;
          }
          
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          
          th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          
          .stat-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e9ecef;
          }
          
          .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #1976D2;
            display: block;
          }
          
          .stat-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
          }
          
          .status-checked-in {
            color: #4CAF50;
            font-weight: bold;
          }
          
          .status-checked-out {
            color: #9E9E9E;
          }
          
          @media print {
            body { margin: 0; }
            .section { page-break-inside: avoid; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <div class="subtitle">Generated on ${currentDate} at ${currentTime}</div>
        </div>
    `;
    
    // Add statistics section
    html += this.generateStatsSection();
    
    // Add personnel section
    if (includePersonnel) {
      html += this.generatePersonnelSection();
    }
    
    // Add activities section
    if (includeActivities) {
      html += this.generateActivitiesSection();
    }
    
    html += `
      </body>
      </html>
    `;
    
    return html;
  }

  generateStatsSection() {
    const currentOccupancy = window.StorageManager.getCurrentOccupancy();
    const todaysStats = window.StorageManager.getTodaysStats();
    const totalPersonnel = window.StorageManager.getAllPersonnel().length;
    const averageDuration = window.StorageManager.getAverageVisitDuration();
    
    return `
      <div class="section">
        <h2>Current Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-number">${currentOccupancy}</span>
            <div class="stat-label">Current Occupancy</div>
          </div>
          <div class="stat-card">
            <span class="stat-number">${todaysStats.checkins}</span>
            <div class="stat-label">Today's Check-ins</div>
          </div>
          <div class="stat-card">
            <span class="stat-number">${todaysStats.checkouts}</span>
            <div class="stat-label">Today's Check-outs</div>
          </div>
          <div class="stat-card">
            <span class="stat-number">${totalPersonnel}</span>
            <div class="stat-label">Total Personnel</div>
          </div>
          <div class="stat-card">
            <span class="stat-number">${this.formatDuration(averageDuration)}</span>
            <div class="stat-label">Average Visit Duration</div>
          </div>
        </div>
      </div>
    `;
  }

  generatePersonnelSection() {
    const personnel = window.StorageManager.getAllPersonnel();
    
    let html = `
      <div class="section">
        <h2>Personnel Directory (${personnel.length} total)</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Company</th>
              <th>Status</th>
              <th>Total Visits</th>
              <th>Last Activity</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    personnel.forEach(person => {
      const statusClass = person.status === 'checked-in' ? 'status-checked-in' : 'status-checked-out';
      html += `
        <tr>
          <td>${this.escapeHtml(person.name)}</td>
          <td>${this.escapeHtml(person.role)}</td>
          <td>${this.escapeHtml(person.company || 'N/A')}</td>
          <td class="${statusClass}">${person.status.replace('-', ' ').toUpperCase()}</td>
          <td>${person.totalVisits || 0}</td>
          <td>${person.lastActivity ? new Date(person.lastActivity).toLocaleString() : 'Never'}</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    return html;
  }

  generateActivitiesSection() {
    const activities = window.StorageManager.getActivityLog(50); // Last 50 activities
    
    let html = `
      <div class="section">
        <h2>Recent Activity (Last 50 entries)</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Personnel</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    activities.forEach(activity => {
      const actionText = this.formatActionText(activity.action);
      const duration = activity.data.duration ? this.formatDuration(activity.data.duration) : 'N/A';
      
      html += `
        <tr>
          <td>${new Date(activity.timestamp).toLocaleString()}</td>
          <td>${actionText}</td>
          <td>${this.escapeHtml(activity.data.name || 'Unknown')}</td>
          <td>${duration}</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    return html;
  }

  // JSON Export
  async exportJSON(options = {}) {
    try {
      console.log('[Export] Starting JSON export');
      
      const {
        includePersonnel = true,
        includeActivities = true,
        includeSettings = false,
        filename = null
      } = options;
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        app: 'Security Access Manager'
      };
      
      if (includePersonnel) {
        exportData.personnel = window.StorageManager.getAllPersonnel();
      }
      
      if (includeActivities) {
        exportData.activities = window.StorageManager.getActivityLog(1000);
      }
      
      if (includeSettings) {
        exportData.settings = window.StorageManager.getAllSettings();
      }
      
      // Add summary statistics
      exportData.summary = {
        totalPersonnel: exportData.personnel ? exportData.personnel.length : 0,
        currentOccupancy: window.StorageManager.getCurrentOccupancy(),
        totalActivities: exportData.activities ? exportData.activities.length : 0
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const finalFilename = filename || this.generateFilename('data', 'json');
      
      this.downloadFile(jsonString, finalFilename, 'application/json');
      
      console.log('[Export] JSON export completed');
      return { success: true, filename: finalFilename };
      
    } catch (error) {
      console.error('[Export] Error exporting JSON:', error);
      throw new Error('Failed to export JSON file');
    }
  }

  // Utility methods
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  generateFilename(prefix, extension) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `${prefix}_${date}_${time}.${extension}`;
  }

  escapeCsvValue(value) {
    if (value === null || value === undefined) return '';
    
    const stringValue = String(value);
    
    // If the value contains commas, quotes, or newlines, wrap it in quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      // Escape quotes by doubling them
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatDuration(milliseconds) {
    if (!milliseconds || milliseconds === 0) return '0h 0m';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  formatActionText(action) {
    const actionMap = {
      'check_in': 'Check In',
      'check_out': 'Check Out',
      'personnel_added': 'Personnel Added',
      'personnel_updated': 'Personnel Updated',
      'personnel_deleted': 'Personnel Deleted',
      'emergency_checkout_all': 'Emergency Checkout All'
    };
    
    return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Email export (placeholder for future implementation)
  async emailExport(recipients, format = 'pdf', options = {}) {
    try {
      console.log('[Export] Email export not yet implemented');
      
      if (window.app) {
        window.app.showToast('Email export coming soon! File will be downloaded instead.', 'info');
      }
      
      // Fall back to regular export
      switch (format) {
        case 'csv':
          return await this.exportCSV(options);
        case 'pdf':
          return await this.exportPDF(options);
        case 'json':
          return await this.exportJSON(options);
        default:
          throw new Error(`Unknown format: ${format}`);
      }
      
    } catch (error) {
      console.error('[Export] Error in email export:', error);
      throw error;
    }
  }

  // Scheduled export (placeholder for future implementation)
  scheduleExport(schedule, format, options = {}) {
    console.log('[Export] Scheduled export not yet implemented');
    
    if (window.app) {
      window.app.showToast('Scheduled exports coming soon!', 'info');
    }
    
    return false;
  }
}

// Create global instance
window.ExportManager = new ExportManager();

console.log('[Export] Export Manager loaded');

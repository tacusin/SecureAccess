/**
 * Secure Access - Dashboard Manager
 * Handles dashboard analytics, charts, and real-time updates
 */

class DashboardManager {
  constructor() {
    this.charts = {};
    this.updateInterval = null;
    this.isInitialized = false;
    this.refreshRate = 30000; // 30 seconds
  }

  async init() {
    try {
      console.log('[Dashboard] Initializing Dashboard Manager');
      
      // Initialize charts
      await this.initializeCharts();
      
      // Setup real-time updates
      this.setupRealTimeUpdates();
      
      this.isInitialized = true;
      console.log('[Dashboard] Dashboard Manager initialized successfully');
      
    } catch (error) {
      console.error('[Dashboard] Error initializing dashboard:', error);
      throw new Error('Failed to initialize dashboard');
    }
  }

  async initializeCharts() {
    try {
      // Wait for Chart.js to be available with retry limit
      if (typeof Chart === 'undefined') {
        if (!this.chartRetryCount) this.chartRetryCount = 0;
        this.chartRetryCount++;
        
        if (this.chartRetryCount > 10) {
          console.warn('[Dashboard] Chart.js failed to load after multiple attempts, skipping charts');
          return;
        }
        
        console.warn('[Dashboard] Chart.js not loaded yet, retrying... (' + this.chartRetryCount + '/10)');
        setTimeout(() => this.initializeCharts(), 2000);
        return;
      }
      
      // Configure Chart.js defaults
      Chart.defaults.font.family = "'Roboto', sans-serif";
      Chart.defaults.color = 'hsl(210, 7%, 46%)';
      Chart.defaults.plugins.legend.display = true;
      Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
      Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
      Chart.defaults.plugins.tooltip.bodyColor = '#ffffff';
      Chart.defaults.plugins.tooltip.cornerRadius = 8;
      
      // Initialize occupancy chart
      await this.initOccupancyChart();
      
      // Initialize duration chart
      await this.initDurationChart();
      
      console.log('[Dashboard] Charts initialized successfully');
      
    } catch (error) {
      console.error('[Dashboard] Error initializing charts:', error);
    }
  }

  async initOccupancyChart() {
    const canvas = document.getElementById('occupancy-chart');
    if (!canvas) {
      console.warn('[Dashboard] Occupancy chart canvas not found');
      return;
    }
    
    // Set explicit canvas dimensions to prevent growing
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '250px';
    
    const ctx = canvas.getContext('2d');
    const occupancyData = this.getOccupancyTrendData();
    
    this.charts.occupancy = new Chart(ctx, {
      type: 'line',
      data: {
        labels: occupancyData.labels,
        datasets: [{
          label: 'Occupancy',
          data: occupancyData.data,
          borderColor: 'hsl(25, 79%, 44%)',
          backgroundColor: 'hsl(25, 79%, 44%, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'hsl(25, 79%, 44%)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: '24-Hour Occupancy Trend',
            font: {
              size: 16,
              weight: '500'
            },
            color: 'hsl(210, 11%, 15%)'
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'hsl(210, 7%, 82%)'
            },
            ticks: {
              stepSize: 1,
              color: 'hsl(210, 7%, 46%)'
            }
          },
          x: {
            grid: {
              color: 'hsl(210, 7%, 82%)'
            },
            ticks: {
              color: 'hsl(210, 7%, 46%)'
            }
          }
        },
        elements: {
          point: {
            hoverBackgroundColor: 'hsl(25, 79%, 44%)'
          }
        }
      }
    });
  }

  async initDurationChart() {
    const canvas = document.getElementById('duration-chart');
    if (!canvas) {
      console.warn('[Dashboard] Duration chart canvas not found');
      return;
    }
    
    // Set explicit canvas dimensions to prevent growing
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '250px';
    
    const ctx = canvas.getContext('2d');
    const durationData = this.getVisitDurationData();
    
    this.charts.duration = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: durationData.labels,
        datasets: [{
          data: durationData.data,
          backgroundColor: [
            'hsl(122, 39%, 49%)',
            'hsl(45, 100%, 51%)',
            'hsl(4, 90%, 58%)',
            'hsl(25, 79%, 44%)',
            'hsl(210, 7%, 46%)'
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Visit Duration Distribution',
            font: {
              size: 16,
              weight: '500'
            },
            color: 'hsl(210, 11%, 15%)'
          },
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} visits (${percentage}%)`;
              }
            }
          }
        },
        cutout: '60%'
      }
    });
  }

  getOccupancyTrendData() {
    const trends = window.StorageManager.getOccupancyTrends();
    const labels = [];
    const data = [];
    
    // If no trends data, create sample structure
    if (trends.length === 0) {
      for (let i = 0; i < 24; i++) {
        labels.push(`${i}:00`);
        data.push(0);
      }
    } else {
      trends.forEach(trend => {
        labels.push(`${trend.hour}:00`);
        data.push(trend.occupancy);
      });
    }
    
    return { labels, data };
  }

  getVisitDurationData() {
    const activities = window.StorageManager.getActivityLogByAction('check_out', 100);
    
    const durations = {
      'Quick (< 1h)': 0,
      'Short (1-2h)': 0,
      'Medium (2-4h)': 0,
      'Long (4-8h)': 0,
      'Extended (> 8h)': 0
    };
    
    activities.forEach(activity => {
      const duration = activity.data.duration || 0;
      const hours = duration / (1000 * 60 * 60);
      
      if (hours < 1) {
        durations['Quick (< 1h)']++;
      } else if (hours < 2) {
        durations['Short (1-2h)']++;
      } else if (hours < 4) {
        durations['Medium (2-4h)']++;
      } else if (hours < 8) {
        durations['Long (4-8h)']++;
      } else {
        durations['Extended (> 8h)']++;
      }
    });
    
    return {
      labels: Object.keys(durations),
      data: Object.values(durations)
    };
  }

  setupRealTimeUpdates() {
    // Update dashboard every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updateRealTimeData();
    }, this.refreshRate);
    
    console.log('[Dashboard] Real-time updates enabled');
  }

  async updateRealTimeData() {
    try {
      // Update occupancy counter
      this.updateOccupancyCounter();
      
      // Update today's stats
      this.updateTodaysStats();
      
      // Update current occupants list
      this.updateCurrentOccupantsList();
      
      // Update charts periodically (every 5 minutes)
      if (Date.now() % (5 * 60 * 1000) < this.refreshRate) {
        await this.updateCharts();
      }
      
    } catch (error) {
      console.error('[Dashboard] Error updating real-time data:', error);
    }
  }

  updateOccupancyCounter() {
    const currentOccupancy = window.StorageManager.getCurrentOccupancy();
    const occupancyElement = document.getElementById('current-occupancy');
    
    if (occupancyElement) {
      // Animate the counter update
      this.animateCounter(occupancyElement, parseInt(occupancyElement.textContent) || 0, currentOccupancy);
    }
  }

  updateTodaysStats() {
    const todaysStats = window.StorageManager.getTodaysStats();
    
    const checkinsElement = document.getElementById('todays-checkins');
    const checkoutsElement = document.getElementById('todays-checkouts');
    
    if (checkinsElement) {
      this.animateCounter(checkinsElement, parseInt(checkinsElement.textContent) || 0, todaysStats.checkins);
    }
    
    if (checkoutsElement) {
      this.animateCounter(checkoutsElement, parseInt(checkoutsElement.textContent) || 0, todaysStats.checkouts);
    }
  }

  updateCurrentOccupantsList() {
    const checkedInPeople = window.StorageManager.getCheckedInPersonnel();
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

  async updateCharts() {
    try {
      console.log('[Dashboard] Updating charts');
      
      // Update occupancy chart
      if (this.charts.occupancy) {
        const occupancyData = this.getOccupancyTrendData();
        this.charts.occupancy.data.labels = occupancyData.labels;
        this.charts.occupancy.data.datasets[0].data = occupancyData.data;
        this.charts.occupancy.update('none'); // No animation for real-time updates
      }
      
      // Update duration chart
      if (this.charts.duration) {
        const durationData = this.getVisitDurationData();
        this.charts.duration.data.labels = durationData.labels;
        this.charts.duration.data.datasets[0].data = durationData.data;
        this.charts.duration.update('none');
      }
      
    } catch (error) {
      console.error('[Dashboard] Error updating charts:', error);
    }
  }

  animateCounter(element, startValue, endValue, duration = 1000) {
    if (startValue === endValue) return;
    
    const startTime = Date.now();
    const difference = endValue - startValue;
    
    const updateCounter = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (difference * easeOut));
      
      element.textContent = currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = endValue;
      }
    };
    
    requestAnimationFrame(updateCounter);
  }

  // Statistics calculation methods
  calculatePeakHours() {
    const trends = window.StorageManager.getOccupancyTrends();
    if (trends.length === 0) return [];
    
    const maxOccupancy = Math.max(...trends.map(t => t.occupancy));
    return trends.filter(t => t.occupancy === maxOccupancy);
  }

  calculateAverageOccupancy() {
    const trends = window.StorageManager.getOccupancyTrends();
    if (trends.length === 0) return 0;
    
    const total = trends.reduce((sum, trend) => sum + trend.occupancy, 0);
    return (total / trends.length).toFixed(1);
  }

  getTopVisitors(limit = 5) {
    return window.StorageManager.getFrequentVisitors(limit);
  }

  getRoleDistribution() {
    const personnel = window.StorageManager.getAllPersonnel();
    const distribution = {};
    
    personnel.forEach(person => {
      distribution[person.role] = (distribution[person.role] || 0) + 1;
    });
    
    return distribution;
  }

  getWeeklyComparison() {
    const weeklyStats = window.StorageManager.getWeeklyStats();
    const days = Object.keys(weeklyStats).slice(-7);
    
    return days.map(day => ({
      day: new Date(day).toLocaleDateString('en-US', { weekday: 'short' }),
      checkins: weeklyStats[day].checkins,
      checkouts: weeklyStats[day].checkouts
    }));
  }

  // Export dashboard data
  async exportDashboardData() {
    try {
      const dashboardData = {
        timestamp: new Date().toISOString(),
        currentOccupancy: window.StorageManager.getCurrentOccupancy(),
        todaysStats: window.StorageManager.getTodaysStats(),
        weeklyStats: this.getWeeklyComparison(),
        occupancyTrends: window.StorageManager.getOccupancyTrends(),
        averageOccupancy: this.calculateAverageOccupancy(),
        peakHours: this.calculatePeakHours(),
        topVisitors: this.getTopVisitors(),
        roleDistribution: this.getRoleDistribution(),
        averageVisitDuration: window.StorageManager.getAverageVisitDuration()
      };
      
      return dashboardData;
      
    } catch (error) {
      console.error('[Dashboard] Error exporting dashboard data:', error);
      throw new Error('Failed to export dashboard data');
    }
  }

  // Theme support for charts
  updateChartsTheme(theme) {
    const isDark = theme === 'dark' || theme === 'night-shift';
    const textColor = isDark ? 'hsl(210, 11%, 91%)' : 'hsl(210, 11%, 15%)';
    const gridColor = isDark ? 'hsl(210, 7%, 36%)' : 'hsl(210, 7%, 82%)';
    
    Object.values(this.charts).forEach(chart => {
      if (chart.options.plugins.title) {
        chart.options.plugins.title.color = textColor;
      }
      
      if (chart.options.scales) {
        if (chart.options.scales.x) {
          chart.options.scales.x.grid.color = gridColor;
          chart.options.scales.x.ticks.color = textColor;
        }
        if (chart.options.scales.y) {
          chart.options.scales.y.grid.color = gridColor;
          chart.options.scales.y.ticks.color = textColor;
        }
      }
      
      chart.update('none');
    });
  }

  // Utility methods
  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDuration(milliseconds) {
    if (!milliseconds) return '0m';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Cleanup
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    Object.values(this.charts).forEach(chart => {
      chart.destroy();
    });
    this.charts = {};
    
    console.log('[Dashboard] Dashboard Manager destroyed');
  }
}

// Create global instance
window.DashboardManager = new DashboardManager();

console.log('[Dashboard] Dashboard Manager loaded');

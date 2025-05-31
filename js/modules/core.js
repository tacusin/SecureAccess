/**
 * Secure Access - Core Module
 * Core application utilities and helpers
 */

class CoreModule {
  constructor() {
    this.initialized = false;
  }

  async init() {
    console.log('[Core] Core module initialized');
    this.initialized = true;
  }

  // Theme management
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      const icon = themeToggle.querySelector('.material-icons');
      if (icon) {
        icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
      }
    }
  }

  // Utility functions
  formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
  }

  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Toast notifications
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="material-icons">${this.getToastIcon(type)}</span>
      <span>${message}</span>
    `;
    
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  getToastIcon(type) {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }

  // Error handling
  showError(message) {
    this.showToast(message, 'error');
  }

  // Modal utilities
  showModal(content) {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    
    if (modalOverlay && modalContent) {
      modalContent.innerHTML = content;
      modalOverlay.classList.add('active');
    }
  }

  closeModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
      modalOverlay.classList.remove('active');
    }
  }
}

// Export for global use
window.CoreModule = new CoreModule();
console.log('[Core] Core module loaded');
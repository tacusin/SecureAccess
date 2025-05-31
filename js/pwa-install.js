/**
 * Secure Access - PWA Installation Manager
 * Handles app installation prompts and PWA features
 */

class PWAInstallManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isStandalone = false;
    this.installButton = null;
  }

  async init() {
    try {
      console.log('[PWA] Initializing PWA Install Manager');
      
      // Check if app is running as standalone PWA
      this.checkStandaloneMode();
      
      // Setup install prompt listeners
      this.setupInstallPrompt();
      
      // Check if already installed
      this.checkInstallStatus();
      
      // Add install button to UI
      this.addInstallButton();
      
      console.log('[PWA] PWA Install Manager initialized');
      
    } catch (error) {
      console.error('[PWA] Error initializing PWA install manager:', error);
    }
  }

  checkStandaloneMode() {
    // Check if running as standalone PWA
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone || 
                      document.referrer.includes('android-app://');
    
    if (this.isStandalone) {
      console.log('[PWA] App is running in standalone mode');
      document.body.classList.add('pwa-standalone');
    }
  }

  setupInstallPrompt() {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] Install prompt available');
      
      // Prevent the mini-infobar from appearing
      e.preventDefault();
      
      // Store the event for later use
      this.deferredPrompt = e;
      
      // Show install button
      this.showInstallButton();
    });

    // Listen for app installation
    window.addEventListener('appinstalled', (e) => {
      console.log('[PWA] App was installed');
      this.isInstalled = true;
      this.hideInstallButton();
      this.showInstallSuccessMessage();
    });
  }

  checkInstallStatus() {
    // Check if app is already installed
    if (this.isStandalone) {
      this.isInstalled = true;
      return;
    }

    // For iOS Safari, check if added to home screen
    if (window.navigator.standalone === true) {
      this.isInstalled = true;
      console.log('[PWA] App is installed on iOS');
    }
  }

  addInstallButton() {
    // Create install button if it doesn't exist
    if (!document.getElementById('pwa-install-btn')) {
      const installBtn = document.createElement('button');
      installBtn.id = 'pwa-install-btn';
      installBtn.className = 'install-button hidden';
      installBtn.innerHTML = `
        <span class="material-icons">get_app</span>
        Install App
      `;
      installBtn.addEventListener('click', () => this.promptInstall());
      
      // Add to app bar actions
      const appBarActions = document.querySelector('.app-bar-actions');
      if (appBarActions) {
        appBarActions.insertBefore(installBtn, appBarActions.firstChild);
        this.installButton = installBtn;
      }
    }
  }

  showInstallButton() {
    if (this.installButton && !this.isInstalled) {
      this.installButton.classList.remove('hidden');
      console.log('[PWA] Install button shown');
    }
  }

  hideInstallButton() {
    if (this.installButton) {
      this.installButton.classList.add('hidden');
    }
  }

  async promptInstall() {
    if (!this.deferredPrompt) {
      console.log('[PWA] No install prompt available');
      this.showManualInstallInstructions();
      return;
    }

    try {
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      // Wait for the user's response
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log('[PWA] User choice:', outcome);
      
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        this.hideInstallButton();
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }
      
      // Clear the deferred prompt
      this.deferredPrompt = null;
      
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
      this.showManualInstallInstructions();
    }
  }

  showManualInstallInstructions() {
    const userAgent = navigator.userAgent.toLowerCase();
    let instructions = '';
    
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
      instructions = `
        <h3>Install on Chrome</h3>
        <ol>
          <li>Click the menu (⋮) in the top-right corner</li>
          <li>Select "Install Secure Access"</li>
          <li>Click "Install" in the dialog</li>
        </ol>
      `;
    } else if (userAgent.includes('safari') && userAgent.includes('iphone')) {
      instructions = `
        <h3>Install on iPhone Safari</h3>
        <ol>
          <li>Tap the Share button (□↗)</li>
          <li>Scroll down and tap "Add to Home Screen"</li>
          <li>Tap "Add" to confirm</li>
        </ol>
      `;
    } else if (userAgent.includes('safari') && userAgent.includes('ipad')) {
      instructions = `
        <h3>Install on iPad Safari</h3>
        <ol>
          <li>Tap the Share button (□↗)</li>
          <li>Tap "Add to Home Screen"</li>
          <li>Tap "Add" to confirm</li>
        </ol>
      `;
    } else if (userAgent.includes('firefox')) {
      instructions = `
        <h3>Install on Firefox</h3>
        <ol>
          <li>Click the menu (☰) in the top-right corner</li>
          <li>Select "Install this site as an app"</li>
          <li>Click "Install" to confirm</li>
        </ol>
      `;
    } else {
      instructions = `
        <h3>Install this App</h3>
        <p>Look for an "Install App" or "Add to Home Screen" option in your browser's menu.</p>
      `;
    }

    if (window.app && window.app.showModal) {
      window.app.showModal(`
        <div class="install-instructions">
          <div class="modal-header">
            <span class="material-icons">get_app</span>
            <h2>Install Secure Access</h2>
          </div>
          <div class="modal-body">
            ${instructions}
            <p class="install-benefits">
              <strong>Benefits of installing:</strong><br>
              • Faster loading times<br>
              • Works offline<br>
              • App-like experience<br>
              • Quick access from home screen
            </p>
          </div>
          <div class="modal-footer">
            <button onclick="app.closeModal()" class="action-button secondary">
              Close
            </button>
          </div>
        </div>
      `);
    }
  }

  showInstallSuccessMessage() {
    if (window.app && window.app.showToast) {
      window.app.showToast('App installed successfully! 🎉', 'success');
    }
  }

  // Check for app updates
  async checkForUpdates() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          console.log('[PWA] Checked for app updates');
        }
      } catch (error) {
        console.error('[PWA] Error checking for updates:', error);
      }
    }
  }

  // Get installation status
  getInstallStatus() {
    return {
      isInstalled: this.isInstalled,
      isStandalone: this.isStandalone,
      canInstall: !!this.deferredPrompt
    };
  }
}

// Create global instance
window.PWAInstallManager = new PWAInstallManager();

console.log('[PWA] PWA Install Manager loaded');
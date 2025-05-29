/**
 * Security Access Manager - Tutorial Manager
 * Interactive tutorial system for first-time users
 */

class TutorialManager {
  constructor() {
    this.currentStep = 0;
    this.totalSteps = 0;
    this.isActive = false;
    this.overlay = null;
    this.tooltip = null;
    this.completedSteps = new Set();
    
    this.steps = [
      {
        target: '.app-title',
        title: 'Welcome to Secure Access',
        content: 'This is your security access management dashboard. Let\'s take a quick tour to get you started.',
        position: 'bottom',
        action: 'highlight'
      },
      {
        target: '#current-occupancy',
        title: 'Current Occupancy',
        content: 'This shows how many people are currently checked in to the building. It updates in real-time.',
        position: 'bottom',
        action: 'highlight'
      },
      {
        target: '[data-action="quick-checkin"]',
        title: 'Quick Check-in',
        content: 'Use this button to quickly navigate to the check-in page for fast personnel management.',
        position: 'top',
        action: 'highlight'
      },
      {
        target: '[data-page="checkin"]',
        title: 'Check-in Page',
        content: 'Click here to access the main check-in/out functionality. This is where you\'ll spend most of your time.',
        position: 'right',
        action: 'navigate',
        page: 'checkin'
      },
      {
        target: '#person-search',
        title: 'Search Personnel',
        content: 'Use this search bar to quickly find people by name, role, or company. It updates as you type.',
        position: 'bottom',
        action: 'highlight'
      },
      {
        target: '#add-visitor-btn',
        title: 'Add New Visitor',
        content: 'Click here to add a new visitor or personnel member. You can capture photos and enter details.',
        position: 'left',
        action: 'highlight'
      },
      {
        target: '[data-page="personnel"]',
        title: 'Personnel Management',
        content: 'This section lets you manage all registered personnel, edit their information, and view their history.',
        position: 'right',
        action: 'navigate',
        page: 'personnel'
      },
      {
        target: '#emergency-btn',
        title: 'Emergency Mode',
        content: 'In case of emergency, this button provides quick access to evacuation lists and emergency procedures.',
        position: 'bottom',
        action: 'highlight'
      },
      {
        target: '#theme-toggle',
        title: 'Theme Settings',
        content: 'Toggle between light, dark, and high-contrast themes for better visibility in different conditions.',
        position: 'bottom',
        action: 'highlight'
      },
      {
        target: '#fab-main',
        title: 'Quick Add',
        content: 'This floating button provides quick access to add new personnel from any page.',
        position: 'left',
        action: 'highlight'
      }
    ];
    
    this.totalSteps = this.steps.length;
  }

  start() {
    if (this.isActive) {
      console.log('[Tutorial] Tutorial already active');
      return;
    }
    
    console.log('[Tutorial] Starting tutorial');
    this.isActive = true;
    this.currentStep = 0;
    this.completedSteps.clear();
    
    this.createTutorialOverlay();
    this.showStep(0);
    
    // Track tutorial start
    if (window.StorageManager) {
      window.StorageManager.logActivity('tutorial_started');
    }
  }

  createTutorialOverlay() {
    // Remove existing overlay if any
    this.removeTutorialOverlay();
    
    // Create main overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'tutorial-overlay';
    this.overlay.innerHTML = `
      <div class="tutorial-backdrop"></div>
      <div class="tutorial-progress">
        <div class="tutorial-progress-bar">
          <div class="tutorial-progress-fill" style="width: 0%"></div>
        </div>
        <span class="tutorial-progress-text">Step 1 of ${this.totalSteps}</span>
      </div>
    `;
    
    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tutorial-tooltip';
    
    // Add styles
    this.addTutorialStyles();
    
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.tooltip);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  addTutorialStyles() {
    if (document.getElementById('tutorial-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'tutorial-styles';
    styles.textContent = `
      .tutorial-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        pointer-events: none;
      }
      
      .tutorial-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(2px);
      }
      
      .tutorial-progress {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: hsl(var(--surface));
        padding: var(--spacing-md) var(--spacing-lg);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        pointer-events: all;
        z-index: 10001;
        min-width: 200px;
        text-align: center;
      }
      
      .tutorial-progress-bar {
        width: 100%;
        height: 4px;
        background: hsl(var(--outline-variant));
        border-radius: 2px;
        margin-bottom: var(--spacing-sm);
        overflow: hidden;
      }
      
      .tutorial-progress-fill {
        height: 100%;
        background: hsl(var(--primary));
        border-radius: 2px;
        transition: width var(--transition-normal);
      }
      
      .tutorial-progress-text {
        font-size: var(--font-size-sm);
        color: hsl(var(--on-surface-variant));
        font-weight: 500;
      }
      
      .tutorial-tooltip {
        position: fixed;
        background: hsl(var(--surface));
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-xl);
        max-width: 320px;
        z-index: 10002;
        pointer-events: all;
        animation: tutorialSlideIn var(--transition-normal);
      }
      
      .tutorial-tooltip-header {
        padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-md);
        border-bottom: 1px solid hsl(var(--outline-variant));
      }
      
      .tutorial-tooltip-title {
        font-size: var(--font-size-lg);
        font-weight: 500;
        color: hsl(var(--on-surface));
        margin: 0;
      }
      
      .tutorial-tooltip-body {
        padding: var(--spacing-md) var(--spacing-lg);
      }
      
      .tutorial-tooltip-content {
        color: hsl(var(--on-surface-variant));
        line-height: 1.5;
        margin-bottom: var(--spacing-lg);
      }
      
      .tutorial-tooltip-actions {
        display: flex;
        gap: var(--spacing-sm);
        justify-content: space-between;
        align-items: center;
      }
      
      .tutorial-tooltip-nav {
        display: flex;
        gap: var(--spacing-sm);
      }
      
      .tutorial-button {
        padding: var(--spacing-sm) var(--spacing-md);
        border: none;
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        font-weight: 500;
        cursor: pointer;
        transition: var(--transition-fast);
        min-height: 36px;
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }
      
      .tutorial-button.primary {
        background: hsl(var(--primary));
        color: hsl(var(--on-primary));
      }
      
      .tutorial-button.primary:hover {
        background: hsl(var(--primary-variant));
      }
      
      .tutorial-button.secondary {
        background: hsl(var(--surface-variant));
        color: hsl(var(--on-surface));
        border: 1px solid hsl(var(--outline));
      }
      
      .tutorial-button.secondary:hover {
        background: hsl(var(--primary) / 0.08);
        border-color: hsl(var(--primary));
      }
      
      .tutorial-button.danger {
        background: hsl(var(--error));
        color: hsl(var(--on-primary));
      }
      
      .tutorial-button.danger:hover {
        background: hsl(var(--error) / 0.9);
      }
      
      .tutorial-highlight {
        position: relative;
        z-index: 10001 !important;
        box-shadow: 0 0 0 4px hsl(var(--primary)), 
                    0 0 20px hsl(var(--primary) / 0.3) !important;
        border-radius: var(--radius-md) !important;
        background: hsl(var(--surface)) !important;
      }
      
      .tutorial-tooltip-arrow {
        position: absolute;
        width: 12px;
        height: 12px;
        background: hsl(var(--surface));
        transform: rotate(45deg);
        z-index: -1;
      }
      
      .tutorial-tooltip-arrow.top {
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
      }
      
      .tutorial-tooltip-arrow.bottom {
        top: -6px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
      }
      
      .tutorial-tooltip-arrow.left {
        right: -6px;
        top: 50%;
        transform: translateY(-50%) rotate(45deg);
      }
      
      .tutorial-tooltip-arrow.right {
        left: -6px;
        top: 50%;
        transform: translateY(-50%) rotate(45deg);
      }
      
      @keyframes tutorialSlideIn {
        from {
          opacity: 0;
          transform: scale(0.9) translateY(-10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      
      @media (max-width: 768px) {
        .tutorial-tooltip {
          max-width: 90vw;
          margin: 0 var(--spacing-md);
        }
        
        .tutorial-progress {
          min-width: 150px;
          padding: var(--spacing-sm) var(--spacing-md);
        }
        
        .tutorial-tooltip-actions {
          flex-direction: column;
          gap: var(--spacing-md);
        }
        
        .tutorial-tooltip-nav {
          width: 100%;
          justify-content: space-between;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }

  showStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      this.complete();
      return;
    }
    
    this.currentStep = stepIndex;
    const step = this.steps[stepIndex];
    
    console.log(`[Tutorial] Showing step ${stepIndex + 1}: ${step.title}`);
    
    // Clear previous highlights
    this.clearHighlights();
    
    // Handle navigation if needed
    if (step.action === 'navigate' && step.page) {
      if (window.app) {
        window.app.navigateTo(step.page);
      }
      
      // Wait for navigation to complete
      setTimeout(() => {
        this.renderStep(step);
      }, 300);
    } else {
      this.renderStep(step);
    }
    
    // Update progress
    this.updateProgress();
  }

  renderStep(step) {
    const targetElement = document.querySelector(step.target);
    
    if (!targetElement) {
      console.warn(`[Tutorial] Target element not found: ${step.target}`);
      this.nextStep();
      return;
    }
    
    // Highlight target element
    if (step.action === 'highlight') {
      targetElement.classList.add('tutorial-highlight');
      
      // Scroll target into view
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    }
    
    // Position and show tooltip
    this.positionTooltip(targetElement, step);
    this.renderTooltipContent(step);
  }

  positionTooltip(targetElement, step) {
    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let left, top, arrowPosition;
    
    // Calculate position based on step.position
    switch (step.position) {
      case 'top':
        left = rect.left + (rect.width / 2) - (320 / 2);
        top = rect.top - 320 - 20;
        arrowPosition = 'bottom';
        break;
        
      case 'bottom':
        left = rect.left + (rect.width / 2) - (320 / 2);
        top = rect.bottom + 20;
        arrowPosition = 'top';
        break;
        
      case 'left':
        left = rect.left - 320 - 20;
        top = rect.top + (rect.height / 2) - 100;
        arrowPosition = 'right';
        break;
        
      case 'right':
        left = rect.right + 20;
        top = rect.top + (rect.height / 2) - 100;
        arrowPosition = 'left';
        break;
        
      default:
        left = rect.left + (rect.width / 2) - (320 / 2);
        top = rect.bottom + 20;
        arrowPosition = 'top';
    }
    
    // Ensure tooltip stays within viewport
    const margin = 20;
    left = Math.max(margin, Math.min(left, windowWidth - 320 - margin));
    top = Math.max(margin, Math.min(top, windowHeight - 200 - margin));
    
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.tooltip.className = `tutorial-tooltip tutorial-tooltip-${arrowPosition}`;
  }

  renderTooltipContent(step) {
    const isFirst = this.currentStep === 0;
    const isLast = this.currentStep === this.steps.length - 1;
    
    this.tooltip.innerHTML = `
      <div class="tutorial-tooltip-arrow ${step.position}"></div>
      <div class="tutorial-tooltip-header">
        <h3 class="tutorial-tooltip-title">${step.title}</h3>
      </div>
      <div class="tutorial-tooltip-body">
        <p class="tutorial-tooltip-content">${step.content}</p>
        <div class="tutorial-tooltip-actions">
          <button class="tutorial-button danger" onclick="tutorialManager.skip()">
            Skip Tour
          </button>
          <div class="tutorial-tooltip-nav">
            ${!isFirst ? `
              <button class="tutorial-button secondary" onclick="tutorialManager.previousStep()">
                <span class="material-icons">arrow_back</span>
                Previous
              </button>
            ` : ''}
            <button class="tutorial-button primary" onclick="tutorialManager.${isLast ? 'complete' : 'nextStep'}()">
              ${isLast ? 'Finish' : 'Next'}
              ${!isLast ? '<span class="material-icons">arrow_forward</span>' : ''}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  updateProgress() {
    const progressFill = document.querySelector('.tutorial-progress-fill');
    const progressText = document.querySelector('.tutorial-progress-text');
    
    if (progressFill) {
      const percentage = ((this.currentStep + 1) / this.totalSteps) * 100;
      progressFill.style.width = `${percentage}%`;
    }
    
    if (progressText) {
      progressText.textContent = `Step ${this.currentStep + 1} of ${this.totalSteps}`;
    }
  }

  nextStep() {
    this.completedSteps.add(this.currentStep);
    this.showStep(this.currentStep + 1);
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  skip() {
    console.log('[Tutorial] Tutorial skipped by user');
    this.complete(false);
  }

  complete(finished = true) {
    console.log(`[Tutorial] Tutorial ${finished ? 'completed' : 'skipped'}`);
    
    this.isActive = false;
    this.clearHighlights();
    this.removeTutorialOverlay();
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Mark tutorial as completed
    if (finished) {
      localStorage.setItem('tutorial_completed', 'true');
      this.showCompletionMessage();
    }
    
    // Track tutorial completion
    if (window.StorageManager) {
      window.StorageManager.logActivity(finished ? 'tutorial_completed' : 'tutorial_skipped', {
        completedSteps: this.completedSteps.size,
        totalSteps: this.totalSteps
      });
    }
  }

  showCompletionMessage() {
    if (window.app) {
      window.app.showToast('Tutorial completed! You\'re ready to manage building access.', 'success');
    }
  }

  clearHighlights() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight');
    });
  }

  removeTutorialOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
    
    const styles = document.getElementById('tutorial-styles');
    if (styles) {
      styles.remove();
    }
  }

  // Quick help for specific features
  showQuickHelp(feature) {
    const helpContent = this.getQuickHelpContent(feature);
    if (!helpContent) return;
    
    const modal = `
      <div class="tutorial-tooltip" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000;">
        <div class="tutorial-tooltip-header">
          <h3 class="tutorial-tooltip-title">${helpContent.title}</h3>
        </div>
        <div class="tutorial-tooltip-body">
          <p class="tutorial-tooltip-content">${helpContent.content}</p>
          <div class="tutorial-tooltip-actions">
            <button class="tutorial-button primary" onclick="tutorialManager.closeQuickHelp()">
              Got it
            </button>
          </div>
        </div>
      </div>
    `;
    
    if (window.app) {
      window.app.showModal(modal);
    }
  }

  getQuickHelpContent(feature) {
    const helpTopics = {
      'photo-capture': {
        title: 'Photo Capture',
        content: 'Click "Take Photo" to use your camera, or "Upload" to select an image file. Photos are automatically compressed for optimal storage.'
      },
      'search': {
        title: 'Search Personnel',
        content: 'Type any part of a person\'s name, role, or company to filter the list. The search is instant and case-insensitive.'
      },
      'emergency': {
        title: 'Emergency Mode',
        content: 'Use emergency mode to quickly generate evacuation lists, identify missing persons, or perform bulk check-outs during emergencies.'
      },
      'export': {
        title: 'Data Export',
        content: 'Export your data in CSV format for spreadsheets, PDF for reports, or JSON for system integration. All exports include timestamps and are GDPR compliant.'
      }
    };
    
    return helpTopics[feature];
  }

  closeQuickHelp() {
    if (window.app) {
      window.app.closeModal();
    }
  }

  // Reset tutorial (for testing or re-onboarding)
  reset() {
    localStorage.removeItem('tutorial_completed');
    this.currentStep = 0;
    this.completedSteps.clear();
    this.isActive = false;
    
    console.log('[Tutorial] Tutorial reset - will show again on next app load');
    
    if (window.app) {
      window.app.showToast('Tutorial reset successfully', 'success');
    }
  }

  // Check if tutorial should be shown
  shouldShow() {
    return !localStorage.getItem('tutorial_completed');
  }
}

// Create global instance
window.TutorialManager = new TutorialManager();

// Make methods available globally for HTML onclick handlers
window.tutorialManager = {
  nextStep: () => window.TutorialManager.nextStep(),
  previousStep: () => window.TutorialManager.previousStep(),
  skip: () => window.TutorialManager.skip(),
  complete: () => window.TutorialManager.complete(),
  closeQuickHelp: () => window.TutorialManager.closeQuickHelp()
};

console.log('[Tutorial] Tutorial Manager loaded');

/**
 * Secure Access - Template Loader
 * Handles dynamic loading of page templates
 */

class TemplateLoader {
  constructor() {
    this.templateCache = new Map();
    this.currentTemplate = null;
  }

  async init() {
    console.log('[TemplateLoader] Template Loader initialized');
  }

  async loadTemplate(templateName) {
    try {
      // Check cache first
      if (this.templateCache.has(templateName)) {
        console.log(`[TemplateLoader] Loading ${templateName} from cache`);
        return this.templateCache.get(templateName);
      }

      console.log(`[TemplateLoader] Fetching template: ${templateName}`);
      const response = await fetch(`templates/${templateName}.html?v=2`);
      
      if (!response.ok) {
        throw new Error(`Failed to load template: ${templateName}`);
      }

      const templateHTML = await response.text();
      
      // Cache the template
      this.templateCache.set(templateName, templateHTML);
      
      console.log(`[TemplateLoader] Template ${templateName} loaded and cached`);
      return templateHTML;
      
    } catch (error) {
      console.error(`[TemplateLoader] Error loading template ${templateName}:`, error);
      return this.getErrorTemplate(templateName);
    }
  }

  async renderTemplate(templateName, containerId = 'main-content') {
    try {
      const templateHTML = await this.loadTemplate(templateName);
      const container = document.getElementById(containerId);
      
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      // Fade out current content
      container.style.opacity = '0';
      
      setTimeout(() => {
        container.innerHTML = templateHTML;
        this.currentTemplate = templateName;
        
        // Fade in new content
        container.style.opacity = '1';
        
        // Trigger template loaded event
        window.dispatchEvent(new CustomEvent('template-loaded', {
          detail: { templateName, container }
        }));
        
        console.log(`[TemplateLoader] Template ${templateName} rendered`);
      }, 150);

      return true;
      
    } catch (error) {
      console.error(`[TemplateLoader] Error rendering template ${templateName}:`, error);
      return false;
    }
  }

  getErrorTemplate(templateName) {
    return `
      <div class="error-template">
        <div class="error-icon">
          <span class="material-icons">error_outline</span>
        </div>
        <h3>Template Error</h3>
        <p>Failed to load ${templateName} template.</p>
        <button class="btn btn-primary" onclick="location.reload()">
          <span class="material-icons">refresh</span>
          Reload Page
        </button>
      </div>
    `;
  }

  getCurrentTemplate() {
    return this.currentTemplate;
  }

  clearCache() {
    this.templateCache.clear();
    console.log('[TemplateLoader] Template cache cleared');
  }

  preloadTemplates(templateNames) {
    templateNames.forEach(async (templateName) => {
      try {
        await this.loadTemplate(templateName);
      } catch (error) {
        console.warn(`[TemplateLoader] Failed to preload ${templateName}:`, error);
      }
    });
  }
}

// Initialize global template loader
window.TemplateLoader = new TemplateLoader();
console.log('[TemplateLoader] Template Loader loaded');
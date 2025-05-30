/**
 * Secure Access - OCR Manager
 * Handles optical character recognition for ID card scanning
 */

class OCRManager {
  constructor() {
    this.isInitialized = false;
    this.worker = null;
    this.supportedLanguages = ['eng'];
    this.isProcessing = false;
  }

  async init() {
    try {
      console.log('[OCR] Initializing OCR Manager');
      
      // Check if Tesseract is available
      if (typeof Tesseract === 'undefined') {
        console.warn('[OCR] Tesseract.js not loaded');
        return false;
      }

      // Create worker
      this.worker = await Tesseract.createWorker('eng');
      
      this.isInitialized = true;
      console.log('[OCR] OCR Manager initialized successfully');
      return true;
      
    } catch (error) {
      console.error('[OCR] Error initializing OCR:', error);
      return false;
    }
  }

  async scanIDCard(imageData) {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.worker) {
      throw new Error('OCR system not available');
    }

    if (this.isProcessing) {
      throw new Error('OCR is currently processing another image');
    }

    try {
      console.log('[OCR] Starting ID card scan');
      this.isProcessing = true;

      // Show processing indicator
      if (window.app) {
        window.app.showToast('Scanning ID card...', 'info');
      }

      // Recognize text from image
      const { data: { text } } = await this.worker.recognize(imageData);
      
      // Parse the recognized text to extract relevant information
      const parsedData = this.parseIDCardText(text);
      
      console.log('[OCR] ID card scan completed');
      return parsedData;
      
    } catch (error) {
      console.error('[OCR] Error scanning ID card:', error);
      throw new Error('Failed to scan ID card');
    } finally {
      this.isProcessing = false;
    }
  }

  parseIDCardText(text) {
    console.log('[OCR] Raw OCR text:', text);
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const result = {
      name: '',
      company: '',
      id: '',
      phone: '',
      email: '',
      confidence: 0
    };

    // Common patterns for different ID card formats
    const patterns = {
      name: /^[A-Z][a-z]+ [A-Z][a-z]+.*$/,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      phone: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/,
      id: /\b[A-Z0-9]{4,}\b/,
      company: /(?:Corp|Corporation|Inc|LLC|Ltd|Company|Co\.|Organization|Org)\.?/i
    };

    let foundFields = 0;

    lines.forEach((line, index) => {
      // Try to extract name (usually first or second line, capitalized)
      if (!result.name && patterns.name.test(line) && line.length < 50) {
        result.name = this.cleanText(line);
        foundFields++;
      }

      // Extract email
      const emailMatch = line.match(patterns.email);
      if (emailMatch && !result.email) {
        result.email = emailMatch[0].toLowerCase();
        foundFields++;
      }

      // Extract phone number
      const phoneMatch = line.match(patterns.phone);
      if (phoneMatch && !result.phone) {
        result.phone = phoneMatch[0];
        foundFields++;
      }

      // Extract ID number
      const idMatch = line.match(patterns.id);
      if (idMatch && !result.id && line.length < 20) {
        result.id = idMatch[0];
        foundFields++;
      }

      // Extract company name
      if (!result.company && patterns.company.test(line)) {
        result.company = this.cleanText(line);
        foundFields++;
      }
    });

    // If we didn't find a specific name pattern, try to use the first meaningful line
    if (!result.name && lines.length > 0) {
      const firstLine = lines.find(line => 
        line.length > 3 && 
        line.length < 50 && 
        /^[A-Za-z\s]+$/.test(line) &&
        !patterns.company.test(line)
      );
      if (firstLine) {
        result.name = this.cleanText(firstLine);
        foundFields++;
      }
    }

    // Calculate confidence based on found fields
    result.confidence = Math.min((foundFields / 3) * 100, 100);

    console.log('[OCR] Parsed data:', result);
    return result;
  }

  cleanText(text) {
    return text
      .replace(/[^\w\s@.-]/g, '') // Remove special characters except email-safe ones
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  async scanDriversLicense(imageData) {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      console.log('[OCR] Starting driver\'s license scan');
      this.isProcessing = true;

      if (window.app) {
        window.app.showToast('Scanning driver\'s license...', 'info');
      }

      const { data: { text } } = await this.worker.recognize(imageData);
      const parsedData = this.parseDriversLicenseText(text);
      
      console.log('[OCR] Driver\'s license scan completed');
      return parsedData;
      
    } catch (error) {
      console.error('[OCR] Error scanning driver\'s license:', error);
      throw new Error('Failed to scan driver\'s license');
    } finally {
      this.isProcessing = false;
    }
  }

  parseDriversLicenseText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const result = {
      name: '',
      licenseNumber: '',
      address: '',
      dateOfBirth: '',
      expirationDate: '',
      confidence: 0
    };

    const patterns = {
      name: /^[A-Z][a-z]+,?\s+[A-Z][a-z]+/,
      licenseNumber: /\b[A-Z0-9]{8,}\b/,
      date: /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/,
      address: /\d+\s+[A-Za-z\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard)/i
    };

    let foundFields = 0;

    lines.forEach(line => {
      if (!result.name && patterns.name.test(line)) {
        result.name = this.cleanText(line);
        foundFields++;
      }

      if (!result.licenseNumber && patterns.licenseNumber.test(line)) {
        const match = line.match(patterns.licenseNumber);
        if (match) {
          result.licenseNumber = match[0];
          foundFields++;
        }
      }

      if (!result.address && patterns.address.test(line)) {
        result.address = this.cleanText(line);
        foundFields++;
      }

      const dateMatches = line.match(patterns.date);
      if (dateMatches) {
        if (!result.dateOfBirth && line.toLowerCase().includes('dob')) {
          result.dateOfBirth = dateMatches[0];
          foundFields++;
        } else if (!result.expirationDate && (line.toLowerCase().includes('exp') || line.toLowerCase().includes('expires'))) {
          result.expirationDate = dateMatches[0];
          foundFields++;
        }
      }
    });

    result.confidence = Math.min((foundFields / 3) * 100, 100);
    
    console.log('[OCR] Parsed driver\'s license data:', result);
    return result;
  }

  async showScanIDModal() {
    return new Promise((resolve, reject) => {
      const modalContent = `
        <div class="scan-id-modal">
          <div class="modal-header">
            <h3>Scan ID Card</h3>
            <button class="icon-button" onclick="window.OCRManager.closeScanModal(false)">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="scan-options">
              <button class="scan-option-btn" onclick="window.OCRManager.startIDScan('id-card')">
                <span class="material-icons">badge</span>
                <span>ID Card</span>
              </button>
              <button class="scan-option-btn" onclick="window.OCRManager.startIDScan('drivers-license')">
                <span class="material-icons">credit_card</span>
                <span>Driver's License</span>
              </button>
              <button class="scan-option-btn" onclick="window.OCRManager.startIDScan('business-card')">
                <span class="material-icons">business_center</span>
                <span>Business Card</span>
              </button>
            </div>
            <div class="scan-instructions">
              <p>Position the ID card within the camera frame and ensure good lighting for best results.</p>
            </div>
          </div>
        </div>
      `;

      // Add OCR-specific styles
      const ocrStyles = `
        <style>
          .scan-id-modal {
            width: 90vw;
            max-width: 500px;
            background: hsl(var(--surface));
            border-radius: var(--radius-lg);
            overflow: hidden;
          }
          
          .scan-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-lg);
          }
          
          .scan-option-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--spacing-sm);
            padding: var(--spacing-lg);
            background: hsl(var(--surface-variant));
            border: 1px solid hsl(var(--outline));
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: var(--transition-fast);
            min-height: 100px;
            justify-content: center;
          }
          
          .scan-option-btn:hover {
            background: hsl(var(--primary) / 0.08);
            border-color: hsl(var(--primary));
            transform: translateY(-2px);
          }
          
          .scan-option-btn .material-icons {
            font-size: 32px;
            color: hsl(var(--primary));
          }
          
          .scan-option-btn span:not(.material-icons) {
            font-size: var(--font-size-sm);
            font-weight: 500;
            color: hsl(var(--on-surface));
          }
          
          .scan-instructions {
            background: hsl(var(--surface-variant));
            padding: var(--spacing-md);
            border-radius: var(--radius-md);
            border-left: 4px solid hsl(var(--primary));
          }
          
          .scan-instructions p {
            margin: 0;
            color: hsl(var(--on-surface-variant));
            font-size: var(--font-size-sm);
          }
        </style>
      `;

      // Show modal
      const modalOverlay = document.getElementById('modal-overlay');
      const modalContentEl = document.getElementById('modal-content');
      modalContentEl.innerHTML = ocrStyles + modalContent;
      modalOverlay.classList.remove('hidden');

      // Store resolve/reject for later use
      this.scanResolver = resolve;
      this.scanRejecter = reject;
    });
  }

  async startIDScan(scanType) {
    try {
      // Close the scan type selection modal
      this.closeScanModal(false);

      // Start camera for ID scanning
      const photoData = await window.CameraManager.capturePhoto();
      
      if (!photoData) {
        if (window.app) {
          window.app.showToast('Photo capture cancelled', 'info');
        }
        return null;
      }

      // Process the image with OCR
      let scannedData;
      switch (scanType) {
        case 'drivers-license':
          scannedData = await this.scanDriversLicense(photoData);
          break;
        case 'id-card':
        case 'business-card':
        default:
          scannedData = await this.scanIDCard(photoData);
          break;
      }

      if (scannedData.confidence < 30) {
        if (window.app) {
          window.app.showToast('Low confidence scan. Please try again with better lighting.', 'warning');
        }
      }

      if (this.scanResolver) {
        this.scanResolver(scannedData);
        this.scanResolver = null;
        this.scanRejecter = null;
      }

      return scannedData;

    } catch (error) {
      console.error('[OCR] Error during ID scan:', error);
      if (window.app) {
        window.app.showError('Failed to scan ID. Please try again.');
      }
      
      if (this.scanRejecter) {
        this.scanRejecter(error);
        this.scanResolver = null;
        this.scanRejecter = null;
      }
      
      throw error;
    }
  }

  closeScanModal(success, data = null) {
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.add('hidden');

    if (this.scanResolver && !success) {
      this.scanResolver(null);
      this.scanResolver = null;
      this.scanRejecter = null;
    }
  }

  // Cleanup
  async destroy() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
    console.log('[OCR] OCR Manager destroyed');
  }

  // Utility methods
  isAvailable() {
    return typeof Tesseract !== 'undefined' && this.isInitialized;
  }

  getProcessingStatus() {
    return this.isProcessing;
  }
}

// Create global instance
window.OCRManager = new OCRManager();

// Make methods available globally for HTML onclick handlers
window.ocrManager = {
  startIDScan: (type) => window.OCRManager.startIDScan(type),
  closeScanModal: (success, data) => window.OCRManager.closeScanModal(success, data),
  scanIDCard: (imageData) => window.OCRManager.scanIDCard(imageData),
  scanDriversLicense: (imageData) => window.OCRManager.scanDriversLicense(imageData),
  showScanIDModal: () => window.OCRManager.showScanIDModal()
};

console.log('[OCR] OCR Manager loaded');
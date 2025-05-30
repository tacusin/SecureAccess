/**
 * Secure Access - QR Code Generator
 * Handles QR code generation and scanning for personnel
 */

class QRGenerator {
  constructor() {
    this.isInitialized = false;
    this.qrSize = 256;
    this.errorCorrectionLevel = 'M';
  }

  async init() {
    try {
      console.log('[QR] Initializing QR Generator');
      
      // Check if QRCode library is available, if not load it
      if (typeof QRCode === 'undefined') {
        console.log('[QR] Loading QRCode.js library...');
        await this.loadQRLibrary();
      }

      if (typeof QRCode !== 'undefined') {
        this.isInitialized = true;
        console.log('[QR] QR Generator initialized successfully');
        return true;
      } else {
        console.warn('[QR] QRCode.js could not be loaded');
        return false;
      }
      
    } catch (error) {
      console.error('[QR] Error initializing QR generator:', error);
      return false;
    }
  }

  async loadQRLibrary() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      script.onload = () => {
        console.log('[QR] QRCode.js library loaded successfully');
        resolve();
      };
      script.onerror = () => {
        console.error('[QR] Failed to load QRCode.js library');
        reject(new Error('Failed to load QR library'));
      };
      document.head.appendChild(script);
    });
  }

  async generatePersonQR(person) {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.isInitialized) {
      throw new Error('QR Code system not available');
    }

    try {
      console.log('[QR] Generating QR code for person:', person.name);

      // Create QR data with essential person information
      const qrData = {
        type: 'person',
        id: person.id,
        name: person.name,
        role: person.role,
        company: person.company || '',
        timestamp: new Date().toISOString(),
        version: '1.0'
      };

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: this.qrSize,
        margin: 2,
        color: {
          dark: '#00E5FF',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: this.errorCorrectionLevel
      });

      console.log('[QR] QR code generated successfully');
      return qrCodeDataURL;

    } catch (error) {
      console.error('[QR] Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  async generateBulkQRCodes(personnelList) {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      console.log('[QR] Generating bulk QR codes for', personnelList.length, 'personnel');

      const qrCodes = [];
      
      for (const person of personnelList) {
        try {
          const qrCode = await this.generatePersonQR(person);
          qrCodes.push({
            person: person,
            qrCode: qrCode,
            success: true
          });
        } catch (error) {
          console.error('[QR] Failed to generate QR for', person.name, error);
          qrCodes.push({
            person: person,
            qrCode: null,
            success: false,
            error: error.message
          });
        }
      }

      console.log('[QR] Bulk QR generation completed');
      return qrCodes;

    } catch (error) {
      console.error('[QR] Error in bulk QR generation:', error);
      throw new Error('Failed to generate bulk QR codes');
    }
  }

  parseQRData(qrText) {
    try {
      const data = JSON.parse(qrText);
      
      // Validate QR data structure
      if (data.type !== 'person' || !data.id || !data.name) {
        throw new Error('Invalid QR code format');
      }

      return {
        isValid: true,
        data: data
      };

    } catch (error) {
      console.error('[QR] Error parsing QR data:', error);
      return {
        isValid: false,
        error: 'Invalid QR code format'
      };
    }
  }

  async showQRModal(person) {
    try {
      const qrCodeDataURL = await this.generatePersonQR(person);
      
      const modalContent = `
        <div class="qr-modal">
          <div class="modal-header">
            <h3>QR Code - ${person.name}</h3>
            <button class="icon-button" onclick="qrGenerator.closeQRModal()">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="qr-code-container">
              <img src="${qrCodeDataURL}" alt="QR Code for ${person.name}" class="qr-code-image">
              <div class="qr-info">
                <div class="person-details">
                  <h4>${person.name}</h4>
                  <p class="person-role">${person.role}</p>
                  ${person.company ? `<p class="person-company">${person.company}</p>` : ''}
                </div>
                <div class="qr-instructions">
                  <p>Scan this QR code for quick check-in/out</p>
                  <p class="qr-id">ID: ${person.id}</p>
                </div>
              </div>
            </div>
            <div class="qr-actions">
              <button class="action-button secondary" onclick="qrGenerator.downloadQR('${person.id}')">
                <span class="material-icons">download</span>
                Download QR
              </button>
              <button class="action-button secondary" onclick="qrGenerator.printQR('${person.id}')">
                <span class="material-icons">print</span>
                Print QR
              </button>
              <button class="action-button primary" onclick="qrGenerator.shareQR('${person.id}')">
                <span class="material-icons">share</span>
                Share QR
              </button>
            </div>
          </div>
        </div>
      `;

      // Add QR-specific styles
      const qrStyles = `
        <style>
          .qr-modal {
            width: 90vw;
            max-width: 500px;
            background: hsl(var(--surface));
            border-radius: var(--radius-lg);
            overflow: hidden;
          }
          
          .qr-code-container {
            text-align: center;
            padding: var(--spacing-lg);
          }
          
          .qr-code-image {
            width: 200px;
            height: 200px;
            border: 2px solid hsl(var(--outline));
            border-radius: var(--radius-md);
            margin-bottom: var(--spacing-lg);
            background: white;
            padding: var(--spacing-sm);
          }
          
          .qr-info {
            margin-bottom: var(--spacing-lg);
          }
          
          .person-details h4 {
            margin: 0 0 var(--spacing-xs) 0;
            color: hsl(var(--on-surface));
            font-size: var(--font-size-lg);
          }
          
          .person-role {
            color: hsl(var(--primary));
            font-weight: 500;
            margin: 0 0 var(--spacing-xs) 0;
            text-transform: uppercase;
            font-size: var(--font-size-sm);
          }
          
          .person-company {
            color: hsl(var(--on-surface-variant));
            margin: 0 0 var(--spacing-md) 0;
          }
          
          .qr-instructions {
            background: hsl(var(--surface-variant));
            padding: var(--spacing-md);
            border-radius: var(--radius-md);
            margin-top: var(--spacing-md);
          }
          
          .qr-instructions p {
            margin: 0;
            color: hsl(var(--on-surface-variant));
            font-size: var(--font-size-sm);
          }
          
          .qr-id {
            font-family: monospace;
            font-size: var(--font-size-xs) !important;
            opacity: 0.7;
            margin-top: var(--spacing-xs) !important;
          }
          
          .qr-actions {
            display: flex;
            gap: var(--spacing-sm);
            padding: 0 var(--spacing-lg) var(--spacing-lg);
            flex-wrap: wrap;
            justify-content: center;
          }
          
          @media (max-width: 480px) {
            .qr-code-image {
              width: 150px;
              height: 150px;
            }
            
            .qr-actions {
              flex-direction: column;
            }
          }
        </style>
      `;

      // Show modal
      const modalOverlay = document.getElementById('modal-overlay');
      const modalContentEl = document.getElementById('modal-content');
      modalContentEl.innerHTML = qrStyles + modalContent;
      modalOverlay.classList.remove('hidden');

      // Store current QR data for actions
      this.currentQR = {
        person: person,
        dataURL: qrCodeDataURL
      };

    } catch (error) {
      console.error('[QR] Error showing QR modal:', error);
      if (window.app) {
        window.app.showError('Failed to generate QR code');
      }
    }
  }

  closeQRModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.add('hidden');
    this.currentQR = null;
  }

  downloadQR(personId) {
    if (!this.currentQR) return;

    try {
      const person = this.currentQR.person;
      const link = document.createElement('a');
      link.download = `qr-code-${person.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = this.currentQR.dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.app) {
        window.app.showToast('QR code downloaded successfully', 'success');
      }

    } catch (error) {
      console.error('[QR] Error downloading QR code:', error);
      if (window.app) {
        window.app.showError('Failed to download QR code');
      }
    }
  }

  printQR(personId) {
    if (!this.currentQR) return;

    try {
      const person = this.currentQR.person;
      const printWindow = window.open('', '_blank');
      
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>QR Code - ${person.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 20px;
              margin: 0;
            }
            .qr-print-container {
              max-width: 400px;
              margin: 0 auto;
              border: 2px solid #1976D2;
              border-radius: 10px;
              padding: 20px;
            }
            .qr-image {
              width: 200px;
              height: 200px;
              margin: 20px auto;
              display: block;
            }
            .person-name {
              font-size: 24px;
              font-weight: bold;
              color: #1976D2;
              margin: 10px 0;
            }
            .person-role {
              font-size: 16px;
              color: #666;
              text-transform: uppercase;
              margin: 5px 0;
            }
            .person-company {
              font-size: 14px;
              color: #999;
              margin: 5px 0;
            }
            .instructions {
              font-size: 12px;
              color: #666;
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #eee;
            }
            @media print {
              body { margin: 0; }
              .qr-print-container { border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="qr-print-container">
            <div class="person-name">${person.name}</div>
            <div class="person-role">${person.role}</div>
            ${person.company ? `<div class="person-company">${person.company}</div>` : ''}
            <img src="${this.currentQR.dataURL}" alt="QR Code" class="qr-image">
            <div class="instructions">
              Scan this QR code for quick check-in/check-out<br>
              Security Access Manager
            </div>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 500);

      if (window.app) {
        window.app.showToast('QR code sent to printer', 'success');
      }

    } catch (error) {
      console.error('[QR] Error printing QR code:', error);
      if (window.app) {
        window.app.showError('Failed to print QR code');
      }
    }
  }

  async shareQR(personId) {
    if (!this.currentQR) return;

    try {
      const person = this.currentQR.person;

      // Check if Web Share API is available
      if (navigator.share) {
        // Convert data URL to blob for sharing
        const response = await fetch(this.currentQR.dataURL);
        const blob = await response.blob();
        const file = new File([blob], `qr-code-${person.name}.png`, { type: 'image/png' });

        await navigator.share({
          title: `QR Code - ${person.name}`,
          text: `QR code for ${person.name} (${person.role})`,
          files: [file]
        });

        if (window.app) {
          window.app.showToast('QR code shared successfully', 'success');
        }
      } else {
        // Fallback: copy QR code data to clipboard
        const qrData = {
          type: 'person',
          id: person.id,
          name: person.name,
          role: person.role,
          company: person.company || ''
        };

        await navigator.clipboard.writeText(JSON.stringify(qrData));
        
        if (window.app) {
          window.app.showToast('QR code data copied to clipboard', 'success');
        }
      }

    } catch (error) {
      console.error('[QR] Error sharing QR code:', error);
      if (window.app) {
        window.app.showError('Failed to share QR code');
      }
    }
  }

  async generateBulkQRSheet(personnelList) {
    try {
      console.log('[QR] Generating bulk QR sheet');

      const qrCodes = await this.generateBulkQRCodes(personnelList);
      const successfulQRs = qrCodes.filter(qr => qr.success);

      if (successfulQRs.length === 0) {
        throw new Error('No QR codes could be generated');
      }

      // Create printable sheet
      const sheetContent = this.createQRSheet(successfulQRs);
      
      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      printWindow.document.write(sheetContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 1000);

      if (window.app) {
        window.app.showToast(`Generated ${successfulQRs.length} QR codes`, 'success');
      }

      return successfulQRs;

    } catch (error) {
      console.error('[QR] Error generating bulk QR sheet:', error);
      if (window.app) {
        window.app.showError('Failed to generate QR sheet');
      }
      throw error;
    }
  }

  createQRSheet(qrCodes) {
    const qrHTML = qrCodes.map(qr => `
      <div class="qr-sheet-item">
        <img src="${qr.qrCode}" alt="QR Code for ${qr.person.name}" class="qr-sheet-image">
        <div class="qr-sheet-info">
          <div class="qr-sheet-name">${qr.person.name}</div>
          <div class="qr-sheet-role">${qr.person.role}</div>
          ${qr.person.company ? `<div class="qr-sheet-company">${qr.person.company}</div>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code Sheet</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: white;
          }
          .qr-sheet-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #1976D2;
            padding-bottom: 10px;
          }
          .qr-sheet-title {
            font-size: 24px;
            color: #1976D2;
            margin: 0;
          }
          .qr-sheet-subtitle {
            font-size: 14px;
            color: #666;
            margin: 5px 0 0 0;
          }
          .qr-sheet-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
          }
          .qr-sheet-item {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            page-break-inside: avoid;
          }
          .qr-sheet-image {
            width: 120px;
            height: 120px;
            margin-bottom: 10px;
          }
          .qr-sheet-name {
            font-weight: bold;
            font-size: 16px;
            color: #333;
            margin-bottom: 5px;
          }
          .qr-sheet-role {
            font-size: 12px;
            color: #1976D2;
            text-transform: uppercase;
            margin-bottom: 3px;
          }
          .qr-sheet-company {
            font-size: 11px;
            color: #666;
          }
          @media print {
            body { margin: 10px; }
            .qr-sheet-grid { grid-template-columns: repeat(3, 1fr); }
          }
        </style>
      </head>
      <body>
        <div class="qr-sheet-header">
          <h1 class="qr-sheet-title">Security Access QR Codes</h1>
          <p class="qr-sheet-subtitle">Generated on ${new Date().toLocaleDateString()} - ${qrCodes.length} codes</p>
        </div>
        <div class="qr-sheet-grid">
          ${qrHTML}
        </div>
      </body>
      </html>
    `;
  }

  // Utility methods
  isAvailable() {
    return typeof QRCode !== 'undefined' && this.isInitialized;
  }

  setQRSize(size) {
    this.qrSize = size;
  }

  setErrorCorrectionLevel(level) {
    this.errorCorrectionLevel = level;
  }
}

// Create global instance
window.QRGenerator = new QRGenerator();

console.log('[QR] QR Generator loaded');
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
      this.isInitialized = true;
      console.log('[QR] QR Generator initialized successfully');
      return true;
    } catch (error) {
      console.error('[QR] Error initializing QR generator:', error);
      return false;
    }
  }

  async loadQRLibrary() {
    return new Promise((resolve, reject) => {
      // Try multiple CDN sources
      const cdnSources = [
        'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
        'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
      ];
      
      let currentIndex = 0;
      
      const tryNextSource = () => {
        if (currentIndex >= cdnSources.length) {
          console.error('[QR] All QR library sources failed');
          reject(new Error('Failed to load QR library from any source'));
          return;
        }
        
        const script = document.createElement('script');
        script.src = cdnSources[currentIndex];
        script.onload = () => {
          console.log('[QR] QRCode.js library loaded successfully from:', cdnSources[currentIndex]);
          resolve();
        };
        script.onerror = () => {
          console.warn('[QR] Failed to load from:', cdnSources[currentIndex]);
          currentIndex++;
          tryNextSource();
        };
        document.head.appendChild(script);
      };
      
      tryNextSource();
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

      // Use QR code API service
      const qrText = JSON.stringify(qrData);
      const qrCodeDataURL = `https://api.qrserver.com/v1/create-qr-code/?size=${this.qrSize}x${this.qrSize}&color=000000&bgcolor=FFFFFF&data=${encodeURIComponent(qrText)}`;

      console.log('[QR] QR code generated successfully');
      return qrCodeDataURL;

    } catch (error) {
      console.error('[QR] Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  async generateSyncHostQR() {
    try {
      console.log('[QR] Generating sync host QR code');

      // Get local IP and sync information
      const deviceId = localStorage.getItem('sync_device_id') || `device-${Date.now()}`;
      let localIP = '10.9.96.7'; // Use the IP shown in the logs
      
      // Try to get actual local IP
      try {
        const detectedIP = await this.getLocalIP();
        if (detectedIP && detectedIP !== '192.168.1.100') {
          localIP = detectedIP;
        }
      } catch (error) {
        console.warn('[QR] Could not get local IP, using fallback:', localIP);
      }

      // Create sync host QR data
      const syncData = {
        type: 'sync-host',
        deviceId: deviceId,
        hostIP: localIP,
        port: 8080,
        protocol: 'http',
        syncEndpoint: '/p2p-sync',
        timestamp: new Date().toISOString(),
        version: '1.0',
        description: 'Security Access Sync Host'
      };

      const qrText = JSON.stringify(syncData);
      
      // Use the same QR generation method as personnel QR codes
      let qrCodeDataURL;
      try {
        if (typeof QRCode !== 'undefined') {
          // Use QRCode library like personnel QR generation
          const canvas = document.createElement('canvas');
          await QRCode.toCanvas(canvas, qrText, {
            width: this.qrSize,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            errorCorrectionLevel: this.errorCorrectionLevel
          });
          qrCodeDataURL = canvas.toDataURL();
          console.log('[QR] QR code generated using QRCode library');
        } else {
          // Fallback to external service
          qrCodeDataURL = `https://api.qrserver.com/v1/create-qr-code/?size=${this.qrSize}x${this.qrSize}&color=000000&bgcolor=FFFFFF&data=${encodeURIComponent(qrText)}`;
          console.log('[QR] QR code generated using external service');
        }
      } catch (serviceError) {
        console.warn('[QR] QR generation failed, using connection info only');
        qrCodeDataURL = null;
      }

      console.log('[QR] Sync host QR code generated successfully');
      console.log('[QR] QR code URL:', qrCodeDataURL);
      console.log('[QR] Connection string:', `${localIP}:8080`);
      
      return {
        dataURL: qrCodeDataURL,
        syncData: syncData,
        connectionString: `${localIP}:8080`
      };

    } catch (error) {
      console.error('[QR] Error generating sync host QR code:', error);
      throw new Error('Failed to generate sync host QR code: ' + error.message);
    }
  }

  async getLocalIP() {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve('192.168.1.100'); // Fallback IP
        }
      }, 3000);
      
      const pc = new RTCPeerConnection({
        iceServers: []
      });
      
      pc.createDataChannel('');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate || resolved) return;
        const candidate = ice.candidate.candidate;
        const ip = candidate.split(' ')[4];
        
        if (ip && (
          ip.startsWith('192.168.') || 
          ip.startsWith('10.') || 
          (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31)
        )) {
          resolved = true;
          clearTimeout(timeout);
          pc.close();
          resolve(ip);
        }
      };
    });
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

  async showSyncHostQRModal() {
    try {
      console.log('[QR] Starting sync host QR modal generation');
      const qrResult = await this.generateSyncHostQR();
      console.log('[QR] QR result generated:', qrResult);
      
      const modalContent = `
        <div class="qr-modal">
          <div class="modal-header">
            <h3>Connection Information</h3>
            <button class="icon-button" onclick="window.QRGenerator.closeQRModal()">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="connection-info">
              <p>Other devices can connect using this address:</p>
              <h4>QR Code</h4>
              <div class="qr-code-display">
                ${qrResult.dataURL ? 
                  `<img src="${qrResult.dataURL}" alt="Sync Host QR Code" class="qr-code-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                   <div class="qr-error" style="display: none;">
                     <span class="material-icons">qr_code</span>
                     <p>QR Code unavailable</p>
                   </div>` :
                  `<div class="qr-error">
                     <span class="material-icons">qr_code</span>
                     <p>QR service unavailable<br>Use connection string below</p>
                   </div>`
                }
              </div>
              <div class="connection-string">
                <strong>${qrResult.connectionString}</strong>
              </div>
              <p>Enter this IP:port on other devices to connect</p>
              <div class="connection-actions">
                <button class="action-button secondary" onclick="navigator.clipboard.writeText('${qrResult.connectionString}'); window.app.showToast('Address copied!', 'success')">
                  Copy Address
                </button>
                <button class="action-button primary" onclick="navigator.share({title: 'Sync Connection', text: '${qrResult.connectionString}'}).catch(() => navigator.clipboard.writeText('${qrResult.connectionString}'))">
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Add sync QR-specific styles
      const syncQrStyles = `
        <style>
          .qr-modal {
            width: 90vw;
            max-width: 450px;
            background: hsl(var(--surface));
            border-radius: var(--radius-lg);
            overflow: hidden;
          }
          
          .connection-info {
            text-align: center;
            padding: var(--spacing-lg);
          }
          
          .connection-info p {
            margin: 0 0 var(--spacing-md) 0;
            color: hsl(var(--on-surface-variant));
            font-size: var(--font-size-sm);
          }
          
          .connection-info h4 {
            margin: 0 0 var(--spacing-md) 0;
            color: hsl(var(--primary));
            font-size: var(--font-size-lg);
          }
          
          .qr-code-display {
            margin: var(--spacing-md) 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 200px;
          }
          
          .qr-code-image {
            width: 180px;
            height: 180px;
            border: 2px solid hsl(var(--outline));
            border-radius: var(--radius-md);
            background: white;
            padding: var(--spacing-sm);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          
          .qr-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            color: hsl(var(--on-surface-variant));
          }
          
          .qr-error .material-icons {
            font-size: 48px;
            margin-bottom: var(--spacing-sm);
            opacity: 0.5;
          }
          
          .connection-string {
            background: hsl(var(--surface-variant));
            padding: var(--spacing-md);
            border-radius: var(--radius-md);
            margin: var(--spacing-md) 0;
            font-family: monospace;
            font-size: var(--font-size-lg);
            color: hsl(var(--primary));
            border: 1px solid hsl(var(--outline));
          }
          
          .connection-actions {
            display: flex;
            gap: var(--spacing-sm);
            justify-content: center;
            margin-top: var(--spacing-lg);
          }
          
          .action-button {
            padding: var(--spacing-sm) var(--spacing-md);
            border: none;
            border-radius: var(--radius-md);
            font-size: var(--font-size-sm);
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          
          .action-button.primary {
            background: hsl(var(--primary));
            color: hsl(var(--on-primary));
          }
          
          .action-button.secondary {
            background: hsl(var(--surface-variant));
            color: hsl(var(--on-surface));
            border: 1px solid hsl(var(--outline));
          }
          
          .action-button:hover {
            opacity: 0.9;
            transform: translateY(-1px);
          }
          
          @media (max-width: 480px) {
            .qr-code-image {
              width: 150px;
              height: 150px;
            }
            
            .connection-actions {
              flex-direction: column;
            }
          }
        </style>
      `;

      // Show modal
      const modalOverlay = document.getElementById('modal-overlay');
      const modalContentEl = document.getElementById('modal-content');
      modalContentEl.innerHTML = syncQrStyles + modalContent;
      modalOverlay.classList.remove('hidden');

      // Store current sync QR data for actions
      this.currentSyncQR = qrResult;

    } catch (error) {
      console.error('[QR] Error showing sync host QR modal:', error);
      console.error('[QR] Error details:', error.message, error.stack);
      if (window.app) {
        window.app.showError('Failed to generate sync host QR code: ' + (error.message || 'Unknown error'));
      }
      throw error; // Re-throw to help with debugging
    }
  }

  async showQRModal(person) {
    try {
      const qrCodeDataURL = await this.generatePersonQR(person);
      
      const modalContent = `
        <div class="qr-modal">
          <div class="modal-header">
            <h3>QR Code - ${person.name}</h3>
            <button class="icon-button" onclick="window.QRGenerator.closeQRModal()">
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
              <button class="action-button secondary" onclick="window.QRGenerator.downloadQR('${person.id}')">
                <span class="material-icons">download</span>
                Download QR
              </button>
              <button class="action-button secondary" onclick="window.QRGenerator.printQR('${person.id}')">
                <span class="material-icons">print</span>
                Print QR
              </button>
              <button class="action-button primary" onclick="window.QRGenerator.shareQR('${person.id}')">
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
      const fileName = `qr-code-${person.name.replace(/\s+/g, '-').toLowerCase()}.png`;

      // Check if Web Share API is available and supports files
      if (navigator.share && navigator.canShare) {
        try {
          // Convert QR code URL to blob
          const response = await fetch(this.currentQR.dataURL);
          const blob = await response.blob();
          const file = new File([blob], fileName, { type: 'image/png' });

          // Check if files can be shared
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `QR Code - ${person.name}`,
              text: `QR code for ${person.name} (${person.role})`,
              files: [file]
            });

            if (window.app) {
              window.app.showToast('QR code shared successfully', 'success');
            }
            return;
          }
        } catch (shareError) {
          console.log('[QR] Web Share API failed, falling back to download');
        }
      }

      // Fallback: Download the image directly
      const link = document.createElement('a');
      link.download = fileName;
      link.href = this.currentQR.dataURL;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.app) {
        window.app.showToast('QR code image saved to device', 'success');
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

  downloadSyncQR() {
    if (!this.currentSyncQR) return;
    
    const link = document.createElement('a');
    link.download = `sync-host-qr-${this.currentSyncQR.syncData.deviceId.slice(-8)}.png`;
    link.href = this.currentSyncQR.dataURL;
    link.click();
  }

  printSyncQR() {
    if (!this.currentSyncQR) return;
    
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sync Host QR Code</title>
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
          .sync-title {
            font-size: 24px;
            font-weight: bold;
            color: #1976D2;
            margin: 10px 0;
          }
          .connection-string {
            font-size: 18px;
            font-family: monospace;
            color: #333;
            margin: 10px 0;
          }
          .device-id {
            font-size: 14px;
            color: #666;
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="qr-print-container">
          <div class="sync-title">Device Sync Host</div>
          <div class="connection-string">${this.currentSyncQR.connectionString}</div>
          <div class="device-id">Device: ${this.currentSyncQR.syncData.deviceId.slice(-8)}</div>
          <img src="${this.currentSyncQR.dataURL}" alt="Sync Host QR Code" class="qr-image">
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }

  async shareSyncQR() {
    if (!this.currentSyncQR) return;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Sync Host QR Code',
          text: `Connect to sync host: ${this.currentSyncQR.connectionString}`,
          url: this.currentSyncQR.dataURL
        });
      } else {
        await navigator.clipboard.writeText(this.currentSyncQR.connectionString);
        if (window.app) {
          window.app.showToast('Sync connection info copied to clipboard', 'success');
        }
      }
    } catch (error) {
      console.error('[QR] Error sharing sync QR code:', error);
      if (window.app) {
        window.app.showError('Failed to share sync QR code');
      }
    }
  }

  async scanSyncHostQR(qrCodeData) {
    try {
      console.log('[QR] Processing scanned sync host QR code');
      
      let syncData;
      try {
        syncData = JSON.parse(qrCodeData);
      } catch (error) {
        if (qrCodeData.includes(':')) {
          const [ip, port] = qrCodeData.split(':');
          syncData = {
            type: 'sync-host',
            hostIP: ip,
            port: parseInt(port) || 8080,
            connectionString: qrCodeData
          };
        } else {
          throw new Error('Invalid QR code format');
        }
      }

      if (syncData.type !== 'sync-host') {
        throw new Error('QR code is not a sync host code');
      }

      const connectionString = syncData.connectionString || `${syncData.hostIP}:${syncData.port}`;
      
      if (window.SyncClient) {
        await window.SyncClient.connectToServer(connectionString);
        if (window.app) {
          window.app.showToast(`Connected to sync host: ${connectionString}`, 'success');
        }
        return true;
      } else if (window.P2PSync) {
        await window.P2PSync.connectToPeer(connectionString);
        if (window.app) {
          window.app.showToast(`Connected to sync host: ${connectionString}`, 'success');
        }
        return true;
      } else {
        throw new Error('No sync system available');
      }

    } catch (error) {
      console.error('[QR] Error processing sync host QR:', error);
      if (window.app) {
        window.app.showError('Failed to connect to sync host: ' + error.message);
      }
      return false;
    }
  }
}

// Create global instance
window.QRGenerator = new QRGenerator();

// Make methods available globally for HTML onclick handlers
window.qrGenerator = {
  generatePersonQR: (person) => window.QRGenerator.generatePersonQR(person),
  showQRModal: (person) => window.QRGenerator.showQRModal(person),
  closeQRModal: () => window.QRGenerator.closeQRModal(),
  downloadQR: (personId) => window.QRGenerator.downloadQR(personId),
  printQR: (personId) => window.QRGenerator.printQR(personId),
  shareQR: (personId) => window.QRGenerator.shareQR(personId),
  generateBulkQRCodes: (personnelList) => window.QRGenerator.generateBulkQRCodes(personnelList)
};

console.log('[QR] QR Generator loaded');
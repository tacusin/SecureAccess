/**
 * Secure Access - Camera Manager
 * Handles camera access, photo capture, and image processing
 */

class CameraManager {
  constructor() {
    this.stream = null;
    this.isInitialized = false;
    this.constraints = {
      video: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        facingMode: { ideal: 'environment', exact: undefined }
      }
    };
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.quality = 0.8;
  }

  async init() {
    try {
      console.log('[Camera] Initializing Camera Manager');
      
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('[Camera] Camera API not available');
        return false;
      }
      
      // Check permissions
      const permissions = await this.checkPermissions();
      if (!permissions) {
        console.warn('[Camera] Camera permissions not granted');
        return false;
      }
      
      this.isInitialized = true;
      console.log('[Camera] Camera Manager initialized successfully');
      return true;
      
    } catch (error) {
      console.error('[Camera] Error initializing camera:', error);
      return false;
    }
  }

  async checkPermissions() {
    try {
      if (!navigator.permissions) {
        // Permissions API not available, try to access camera directly
        return true;
      }
      
      const result = await navigator.permissions.query({ name: 'camera' });
      return result.state === 'granted' || result.state === 'prompt';
      
    } catch (error) {
      console.error('[Camera] Error checking permissions:', error);
      return true; // Assume we can try
    }
  }

  async requestCameraAccess() {
    try {
      console.log('[Camera] Requesting camera access');
      
      // Try with preferred constraints first
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);
        console.log('[Camera] Camera access granted with preferred settings');
        return this.stream;
      } catch (firstError) {
        console.warn('[Camera] Failed with preferred constraints, trying fallback');
        
        // Fallback to basic constraints
        const fallbackConstraints = {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        };
        
        this.stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        console.log('[Camera] Camera access granted with fallback settings');
        return this.stream;
      }
      
    } catch (error) {
      console.error('[Camera] Error accessing camera:', error);
      
      // Provide specific error messages
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera access denied. Please enable camera permissions in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera found. Please connect a camera and try again.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Camera is busy. Please close other applications using the camera.');
      } else if (error.name === 'OverconstrainedError') {
        throw new Error('Camera constraints not supported. Trying with basic settings...');
      } else {
        throw new Error('Failed to access camera. Please try again or check your browser permissions.');
      }
    }
  }

  async capturePhoto() {
    try {
      console.log('[Camera] Starting photo capture');
      
      if (!this.isInitialized) {
        await this.init();
      }
      
      // Show camera modal
      const photoData = await this.showCameraModal();
      return photoData;
      
    } catch (error) {
      console.error('[Camera] Error capturing photo:', error);
      throw error;
    }
  }

  async showCameraModal() {
    return new Promise((resolve, reject) => {
      const modalContent = `
        <div class="camera-modal">
          <div class="camera-header">
            <h3>Take Photo</h3>
            <button class="icon-button" onclick="window.CameraManager.closeCameraModal(false)">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="camera-body">
            <div class="camera-container">
              <video id="camera-video" autoplay playsinline></video>
              <canvas id="camera-canvas" style="display: none;"></canvas>
              <div class="camera-overlay">
                <div class="camera-focus-area"></div>
              </div>
            </div>
            <div class="camera-controls">
              <button id="switch-camera-btn" class="icon-button" title="Switch Camera">
                <span class="material-icons">flip_camera_ios</span>
              </button>
              <button id="capture-btn" class="capture-button">
                <span class="material-icons">camera_alt</span>
              </button>
              <button id="cancel-camera-btn" class="icon-button" title="Cancel">
                <span class="material-icons">close</span>
              </button>
            </div>
            <div class="camera-preview" id="photo-preview" style="display: none;">
              <img id="captured-image" alt="Captured photo">
              <div class="preview-controls">
                <button class="action-button secondary" onclick="window.CameraManager.retakePhoto()">
                  <span class="material-icons">refresh</span>
                  Retake
                </button>
                <button class="action-button primary" onclick="window.CameraManager.confirmPhoto()">
                  <span class="material-icons">check</span>
                  Use Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add camera-specific styles
      const cameraStyles = `
        <style>
          .camera-modal {
            width: 90vw;
            max-width: 600px;
            max-height: 90vh;
            background: hsl(var(--surface));
            border-radius: var(--radius-lg);
            overflow: hidden;
          }
          
          .camera-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: var(--spacing-lg);
            border-bottom: 1px solid hsl(var(--outline-variant));
          }
          
          .camera-header h3 {
            margin: 0;
            color: hsl(var(--on-surface));
          }
          
          .camera-body {
            padding: var(--spacing-lg);
          }
          
          .camera-container {
            position: relative;
            background: #000;
            border-radius: var(--radius-md);
            overflow: hidden;
            margin-bottom: var(--spacing-lg);
            aspect-ratio: 16/9;
          }
          
          #camera-video {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          #camera-canvas {
            width: 100%;
            height: 100%;
          }
          
          .camera-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
          }
          
          .camera-focus-area {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 200px;
            height: 200px;
            border: 2px solid rgba(255, 255, 255, 0.8);
            border-radius: 50%;
          }
          
          .camera-controls {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-lg);
          }
          
          .capture-button {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: 4px solid hsl(var(--primary));
            background: hsl(var(--surface));
            color: hsl(var(--primary));
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: var(--transition-fast);
          }
          
          .capture-button:hover {
            background: hsl(var(--primary));
            color: hsl(var(--on-primary));
            transform: scale(1.05);
          }
          
          .capture-button .material-icons {
            font-size: 36px;
          }
          
          .camera-preview {
            text-align: center;
          }
          
          .camera-preview img {
            max-width: 100%;
            max-height: 300px;
            border-radius: var(--radius-md);
            margin-bottom: var(--spacing-lg);
          }
          
          .preview-controls {
            display: flex;
            gap: var(--spacing-md);
            justify-content: center;
          }
          
          @media (max-width: 480px) {
            .camera-modal {
              width: 95vw;
            }
            
            .camera-container {
              aspect-ratio: 4/3;
            }
            
            .capture-button {
              width: 60px;
              height: 60px;
            }
            
            .capture-button .material-icons {
              font-size: 28px;
            }
          }
        </style>
      `;
      
      // Show modal with camera interface
      const modalOverlay = document.getElementById('modal-overlay');
      const modalContentEl = document.getElementById('modal-content');
      modalContentEl.innerHTML = cameraStyles + modalContent;
      modalOverlay.classList.remove('hidden');
      
      // Store resolve/reject for later use
      this.photoResolver = resolve;
      this.photoRejecter = reject;
      this.capturedPhotoData = null;
      
      // Initialize camera
      this.initializeCameraModal();
    });
  }

  async initializeCameraModal() {
    try {
      const video = document.getElementById('camera-video');
      const captureBtn = document.getElementById('capture-btn');
      const switchBtn = document.getElementById('switch-camera-btn');
      const cancelBtn = document.getElementById('cancel-camera-btn');
      
      // Request camera access
      this.stream = await this.requestCameraAccess();
      video.srcObject = this.stream;
      
      // Set up event listeners
      captureBtn.addEventListener('click', () => this.takeSnapshot());
      switchBtn.addEventListener('click', () => this.switchCamera());
      cancelBtn.addEventListener('click', () => this.closeCameraModal(false));
      
      // Handle video load
      video.addEventListener('loadedmetadata', () => {
        console.log('[Camera] Video loaded, ready to capture');
      });
      
    } catch (error) {
      console.error('[Camera] Error initializing camera modal:', error);
      this.closeCameraModal(false);
      if (this.photoRejecter) {
        this.photoRejecter(error);
      }
    }
  }

  takeSnapshot() {
    try {
      const video = document.getElementById('camera-video');
      const canvas = document.getElementById('camera-canvas');
      const context = canvas.getContext('2d');
      
      // Set canvas dimensions to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to blob and then to data URL
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.capturedPhotoData = e.target.result;
          this.showPhotoPreview(this.capturedPhotoData);
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', this.quality);
      
    } catch (error) {
      console.error('[Camera] Error taking snapshot:', error);
      if (window.app) {
        window.app.showError('Failed to capture photo. Please try again.');
      }
    }
  }

  showPhotoPreview(photoData) {
    const video = document.getElementById('camera-video');
    const preview = document.getElementById('photo-preview');
    const capturedImage = document.getElementById('captured-image');
    
    // Hide video, show preview
    video.style.display = 'none';
    preview.style.display = 'block';
    capturedImage.src = photoData;
    
    // Stop camera stream
    this.stopCameraStream();
  }

  retakePhoto() {
    const video = document.getElementById('camera-video');
    const preview = document.getElementById('photo-preview');
    
    // Show video, hide preview
    video.style.display = 'block';
    preview.style.display = 'none';
    
    // Restart camera
    this.initializeCameraModal();
  }

  confirmPhoto() {
    if (this.capturedPhotoData) {
      // Compress image if too large
      this.compressImage(this.capturedPhotoData)
        .then((compressedData) => {
          this.closeCameraModal(true, compressedData);
        })
        .catch((error) => {
          console.error('[Camera] Error compressing image:', error);
          this.closeCameraModal(true, this.capturedPhotoData);
        });
    }
  }

  async compressImage(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions (max 800px width)
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', this.quality);
        
        resolve(compressedDataUrl);
      };
      img.src = dataUrl;
    });
  }

  async switchCamera() {
    try {
      // Toggle between front and back camera
      const currentFacingMode = this.constraints.video.facingMode;
      this.constraints.video.facingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      
      // Stop current stream
      this.stopCameraStream();
      
      // Start new stream with different camera
      const video = document.getElementById('camera-video');
      this.stream = await this.requestCameraAccess();
      video.srcObject = this.stream;
      
    } catch (error) {
      console.error('[Camera] Error switching camera:', error);
      // Revert to original facing mode
      this.constraints.video.facingMode = this.constraints.video.facingMode === 'user' ? 'environment' : 'user';
      
      if (window.app) {
        window.app.showError('Failed to switch camera. Using current camera.');
      }
    }
  }

  stopCameraStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }
  }

  closeCameraModal(success, photoData = null) {
    // Stop camera stream
    this.stopCameraStream();
    
    // Close modal
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    
    // Resolve or reject promise
    if (this.photoResolver) {
      if (success && photoData) {
        this.photoResolver(photoData);
      } else if (!success) {
        this.photoResolver(null);
      }
      this.photoResolver = null;
      this.photoRejecter = null;
    }
  }

  // QR Code scanning (placeholder for future implementation)
  async scanQRCode() {
    try {
      console.log('[Camera] Starting QR code scanning...');
      
      // Check if QR scanner is available
      if (typeof QrScanner === 'undefined') {
        throw new Error('QR Scanner library not loaded');
      }

      return new Promise((resolve, reject) => {
        // Create QR scanner modal
        const modal = document.createElement('div');
        modal.id = 'qr-scanner-modal';
        modal.className = 'modal active';
        modal.innerHTML = `
          <div class="modal-content qr-scanner-content">
            <div class="modal-header">
              <h3>Scan QR Code</h3>
              <button class="close-button" id="close-qr-scanner">
                <span class="material-icons">close</span>
              </button>
            </div>
            <div class="modal-body">
              <div class="qr-scanner-container">
                <video id="qr-video" class="qr-scanner-video"></video>
                <div class="qr-scanner-overlay">
                  <div class="qr-scanner-frame"></div>
                </div>
              </div>
              <div class="qr-scanner-status">
                <p>Position the QR code within the frame</p>
              </div>
            </div>
            <div class="modal-footer">
              <button class="action-button secondary" id="cancel-qr-scan">Cancel</button>
            </div>
          </div>
        `;

        // Add styles for QR scanner
        const style = document.createElement('style');
        style.textContent = `
          .qr-scanner-content {
            width: 90vw;
            max-width: 500px;
            max-height: 90vh;
          }
          
          .qr-scanner-container {
            position: relative;
            width: 100%;
            height: 300px;
            background: #000;
            border-radius: 8px;
            overflow: hidden;
          }
          
          .qr-scanner-video {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .qr-scanner-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
          }
          
          .qr-scanner-frame {
            width: 200px;
            height: 200px;
            border: 3px solid hsl(var(--primary));
            border-radius: 12px;
            position: relative;
          }
          
          .qr-scanner-frame::before,
          .qr-scanner-frame::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            border: 3px solid hsl(var(--primary));
          }
          
          .qr-scanner-frame::before {
            top: -3px;
            left: -3px;
            border-right: none;
            border-bottom: none;
          }
          
          .qr-scanner-frame::after {
            bottom: -3px;
            right: -3px;
            border-left: none;
            border-top: none;
          }
          
          .qr-scanner-status {
            text-align: center;
            padding: var(--spacing-md);
            color: hsl(var(--on-surface));
          }
        `;
        document.head.appendChild(style);

        document.body.appendChild(modal);

        const video = modal.querySelector('#qr-video');
        const closeBtn = modal.querySelector('#close-qr-scanner');
        const cancelBtn = modal.querySelector('#cancel-qr-scan');
        const statusText = modal.querySelector('.qr-scanner-status p');

        let qrScanner = null;

        const cleanup = () => {
          if (qrScanner) {
            qrScanner.stop();
            qrScanner.destroy();
          }
          document.body.removeChild(modal);
          document.head.removeChild(style);
        };

        const handleClose = () => {
          cleanup();
          resolve(null);
        };

        closeBtn.addEventListener('click', handleClose);
        cancelBtn.addEventListener('click', handleClose);

        // Initialize QR Scanner
        QrScanner.hasCamera().then(hasCamera => {
          if (!hasCamera) {
            statusText.textContent = 'No camera available';
            setTimeout(handleClose, 2000);
            return;
          }

          qrScanner = new QrScanner(video, result => {
            console.log('[Camera] QR code detected:', result);
            cleanup();
            resolve(result);
          }, {
            returnDetailedScanResult: false,
            highlightScanRegion: false,
            highlightCodeOutline: false,
          });

          qrScanner.start().then(() => {
            console.log('[Camera] QR scanner started successfully');
            statusText.textContent = 'Position the QR code within the frame';
          }).catch(error => {
            console.error('[Camera] Failed to start QR scanner:', error);
            statusText.textContent = 'Failed to start camera';
            setTimeout(handleClose, 2000);
          });
        }).catch(error => {
          console.error('[Camera] Camera check failed:', error);
          statusText.textContent = 'Camera access denied';
          setTimeout(handleClose, 2000);
        });
      });
    } catch (error) {
      console.error('[Camera] Error scanning QR code:', error);
      if (window.app) {
        window.app.showToast('Failed to start QR scanner', 'error');
      }
      throw error;
    }
  }

  // Utility methods
  isAvailable() {
    return this.isInitialized && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  }

  getSupportedConstraints() {
    if (navigator.mediaDevices && navigator.mediaDevices.getSupportedConstraints) {
      return navigator.mediaDevices.getSupportedConstraints();
    }
    return {};
  }

  async getDevices() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'videoinput');
      }
      return [];
    } catch (error) {
      console.error('[Camera] Error getting devices:', error);
      return [];
    }
  }
}

// Create global instance
window.CameraManager = new CameraManager();

// Make methods available globally for HTML onclick handlers
window.cameraManager = {
  closeCameraModal: (success, photoData) => window.CameraManager.closeCameraModal(success, photoData),
  retakePhoto: () => window.CameraManager.retakePhoto(),
  confirmPhoto: () => window.CameraManager.confirmPhoto()
};

console.log('[Camera] Camera Manager loaded');

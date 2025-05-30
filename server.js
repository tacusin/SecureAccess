const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 5000;

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

function serveFile(filePath, res) {
  const extname = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

function serveFileWithEnv(filePath, res) {
  fs.readFile(filePath, 'utf8', (error, content) => {
    if (error) {
      res.writeHead(500);
      res.end('Server error: ' + error.code);
      return;
    }

    // Inject environment variables
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY || '';
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
    
    const injectedContent = content.replace(
      'window.GOOGLE_DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY;',
      `window.GOOGLE_DRIVE_API_KEY = '${apiKey}';`
    ).replace(
      'window.GOOGLE_DRIVE_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;',
      `window.GOOGLE_DRIVE_CLIENT_ID = '${clientId}';`
    ).replace(
      '${process.env.GOOGLE_DRIVE_API_KEY}',
      apiKey
    ).replace(
      '${process.env.GOOGLE_DRIVE_CLIENT_ID}',
      clientId
    );

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(injectedContent, 'utf-8');
  });
}

function serveIndexWithEnv(res) {
  serveFileWithEnv('index.html', res);
}

const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  
  // Add Content Security Policy to allow Google APIs
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://content.googleapis.com; " +
    "frame-src 'self' https://accounts.google.com https://content.googleapis.com; " +
    "connect-src 'self' https://accounts.google.com https://content.googleapis.com https://www.googleapis.com; " +
    "img-src 'self' data: https:; " +
    "style-src 'self' 'unsafe-inline';"
  );

  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  // Default to index.html
  if (pathname === '/') {
    serveIndexWithEnv(res);
    return;
  }

  // Handle test page with environment injection
  if (pathname === '/test-google-api.html') {
    serveFileWithEnv('test-google-api.html', res);
    return;
  }

  // Remove leading slash and resolve file path
  const filePath = path.join(__dirname, pathname);

  // Check if file exists
  fs.stat(filePath, (error, stat) => {
    if (error) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    if (stat.isFile()) {
      serveFile(filePath, res);
    } else {
      res.writeHead(404);
      res.end('File not found');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Security Access Manager server running on port ${PORT}`);
});
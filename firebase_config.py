#!/usr/bin/env python3
import os
import json
import http.server
import socketserver
from urllib.parse import urlparse, parse_qs

class FirebaseConfigHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/firebase-config':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            config = {
                'apiKey': os.getenv('FIREBASE_API_KEY', ''),
                'authDomain': os.getenv('FIREBASE_AUTH_DOMAIN', ''),
                'projectId': os.getenv('FIREBASE_PROJECT_ID', ''),
                'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET', ''),
                'messagingSenderId': os.getenv('FIREBASE_MESSAGING_SENDER_ID', ''),
                'appId': os.getenv('FIREBASE_APP_ID', ''),
                'databaseURL': f"https://{os.getenv('FIREBASE_PROJECT_ID', '')}-default-rtdb.firebaseio.com/"
            }
            
            self.wfile.write(json.dumps(config).encode())
        else:
            super().do_GET()

if __name__ == '__main__':
    PORT = 5001
    with socketserver.TCPServer(("", PORT), FirebaseConfigHandler) as httpd:
        print(f"Firebase config server running on port {PORT}")
        httpd.serve_forever()
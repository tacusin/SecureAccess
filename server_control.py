#!/usr/bin/env python3
"""
Secure Access - Server Control
Handles starting and stopping the Node.js HTTP mesh sync server
"""

import http.server
import socketserver
import json
import subprocess
import os
import threading
import time
from urllib.parse import urlparse, parse_qs

class ServerControlHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.mesh_server_process = None
        super().__init__(*args, **kwargs)

    def do_POST(self):
        if self.path == '/start-mesh-server':
            self.handle_start_mesh_server()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_start_mesh_server(self):
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            if request_data.get('action') == 'start':
                # Check if Node.js server is already running
                if self.is_mesh_server_running():
                    self.send_json_response({
                        'success': True,
                        'message': 'Mesh server is already running',
                        'port': 8082
                    })
                    return
                
                # Start the Node.js mesh server
                success = self.start_mesh_server()
                
                if success:
                    self.send_json_response({
                        'success': True,
                        'message': 'Mesh server started successfully',
                        'port': 8082
                    })
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'Failed to start mesh server'
                    }, status_code=500)
            else:
                self.send_json_response({
                    'success': False,
                    'error': 'Invalid action'
                }, status_code=400)
                
        except Exception as e:
            self.send_json_response({
                'success': False,
                'error': str(e)
            }, status_code=500)

    def start_mesh_server(self):
        try:
            # Start the Node.js server in a separate process
            self.mesh_server_process = subprocess.Popen(
                ['node', 'server.js'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=os.getcwd()
            )
            
            # Give it a moment to start
            time.sleep(2)
            
            # Check if the process is still running
            if self.mesh_server_process.poll() is None:
                print(f"[ServerControl] Mesh server started with PID {self.mesh_server_process.pid}")
                return True
            else:
                print("[ServerControl] Mesh server failed to start")
                return False
                
        except Exception as e:
            print(f"[ServerControl] Error starting mesh server: {e}")
            return False

    def is_mesh_server_running(self):
        try:
            # Try to connect to the mesh server port
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('127.0.0.1', 8082))
            sock.close()
            return result == 0
        except:
            return False

    def send_json_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        response = json.dumps(data).encode('utf-8')
        self.wfile.write(response)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

class ServerControlHTTPServer(socketserver.TCPServer):
    def __init__(self, server_address, RequestHandlerClass):
        super().__init__(server_address, RequestHandlerClass)
        self.mesh_server_process = None

    def server_close(self):
        # Clean up mesh server when main server shuts down
        if self.mesh_server_process and self.mesh_server_process.poll() is None:
            print("[ServerControl] Stopping mesh server...")
            self.mesh_server_process.terminate()
        super().server_close()

if __name__ == "__main__":
    PORT = 5000
    
    with ServerControlHTTPServer(("", PORT), ServerControlHandler) as httpd:
        print(f"[ServerControl] Server running on port {PORT}")
        print(f"[ServerControl] Mesh server control available at /start-mesh-server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[ServerControl] Server shutting down...")
            httpd.server_close()
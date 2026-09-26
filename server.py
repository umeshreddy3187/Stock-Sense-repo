#!/usr/bin/env python3
"""
StockSense Local Development Server
Launches a lightweight HTTP server serving the current directory with proper MIME types.
"""
import http.server
import socketserver
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class StockSenseHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.js'):
            return 'application/javascript'
        if path.endswith('.css'):
            return 'text/css'
        if path.endswith('.html'):
            return 'text/html'
        return super().guess_type(path)

def find_available_port(start_port=8000, max_attempts=20):
    import socket
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start_port

def run():
    port = find_available_port(PORT)
    handler = StockSenseHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"\n==================================================")
        print(f"  StockSense Inventory Management System")
        print(f"  Local Server running at: http://localhost:{port}")
        print(f"  Serving files from: {DIRECTORY}")
        print(f"==================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.server_close()

if __name__ == '__main__':
    run()

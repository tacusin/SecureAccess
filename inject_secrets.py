#!/usr/bin/env python3
import os
import re

def inject_firebase_secrets():
    """Inject Firebase secrets into the HTML file"""
    
    # Read the HTML template
    with open('index.html', 'r') as f:
        html_content = f.read()
    
    # Get Firebase secrets from environment
    firebase_secrets = {
        'FIREBASE_API_KEY': os.getenv('FIREBASE_API_KEY', ''),
        'FIREBASE_AUTH_DOMAIN': os.getenv('FIREBASE_AUTH_DOMAIN', ''),
        'FIREBASE_PROJECT_ID': os.getenv('FIREBASE_PROJECT_ID', ''),
        'FIREBASE_STORAGE_BUCKET': os.getenv('FIREBASE_STORAGE_BUCKET', ''),
        'FIREBASE_MESSAGING_SENDER_ID': os.getenv('FIREBASE_MESSAGING_SENDER_ID', ''),
        'FIREBASE_APP_ID': os.getenv('FIREBASE_APP_ID', '')
    }
    
    # Replace placeholders with actual values
    for key, value in firebase_secrets.items():
        placeholder = f'${{{key}}}'
        html_content = html_content.replace(placeholder, value)
    
    # Write the updated HTML
    with open('index.html', 'w') as f:
        f.write(html_content)
    
    print("Firebase secrets injected into HTML")

if __name__ == '__main__':
    inject_firebase_secrets()
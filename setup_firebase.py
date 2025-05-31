#!/usr/bin/env python3
import os
import re

def setup_firebase_credentials():
    """Inject Firebase credentials into the HTML file"""
    
    # Get Firebase secrets from environment
    firebase_secrets = {
        'FIREBASE_API_KEY': os.getenv('FIREBASE_API_KEY', ''),
        'FIREBASE_AUTH_DOMAIN': os.getenv('FIREBASE_AUTH_DOMAIN', ''),
        'FIREBASE_PROJECT_ID': os.getenv('FIREBASE_PROJECT_ID', ''),
        'FIREBASE_STORAGE_BUCKET': os.getenv('FIREBASE_STORAGE_BUCKET', ''),
        'FIREBASE_MESSAGING_SENDER_ID': os.getenv('FIREBASE_MESSAGING_SENDER_ID', ''),
        'FIREBASE_APP_ID': os.getenv('FIREBASE_APP_ID', '')
    }
    
    # Check if secrets are available
    missing_secrets = [key for key, value in firebase_secrets.items() if not value]
    if missing_secrets:
        print(f"Error: Missing Firebase secrets: {missing_secrets}")
        return False
    
    # Read the HTML file
    html_path = 'index.html'
    with open(html_path, 'r', encoding='utf-8') as file:
        html_content = file.read()
    
    # Remove any existing Firebase configuration script
    pattern = r'<script>\s*// Firebase configuration from environment variables.*?</script>'
    html_content = re.sub(pattern, '', html_content, flags=re.DOTALL)
    
    # Create the injection script
    injection_script = f"""
    <script>
        // Firebase configuration from environment variables
        window.FIREBASE_API_KEY = '{firebase_secrets['FIREBASE_API_KEY']}';
        window.FIREBASE_AUTH_DOMAIN = '{firebase_secrets['FIREBASE_AUTH_DOMAIN']}';
        window.FIREBASE_PROJECT_ID = '{firebase_secrets['FIREBASE_PROJECT_ID']}';
        window.FIREBASE_STORAGE_BUCKET = '{firebase_secrets['FIREBASE_STORAGE_BUCKET']}';
        window.FIREBASE_MESSAGING_SENDER_ID = '{firebase_secrets['FIREBASE_MESSAGING_SENDER_ID']}';
        window.FIREBASE_APP_ID = '{firebase_secrets['FIREBASE_APP_ID']}';
        console.log('[Firebase] Configuration loaded from environment');
        console.log('[Firebase] Project ID:', window.FIREBASE_PROJECT_ID);
    </script>
    """
    
    # Find the head tag and inject the script
    head_end = html_content.find('</head>')
    if head_end != -1:
        html_content = html_content[:head_end] + injection_script + html_content[head_end:]
        
        # Write the modified HTML back
        with open(html_path, 'w', encoding='utf-8') as file:
            file.write(html_content)
        
        print("✓ Firebase credentials injected successfully")
        print(f"✓ Project ID: {firebase_secrets['FIREBASE_PROJECT_ID']}")
        print(f"✓ Auth Domain: {firebase_secrets['FIREBASE_AUTH_DOMAIN']}")
        return True
    else:
        print("Error: Could not find </head> tag in HTML")
        return False

if __name__ == '__main__':
    if setup_firebase_credentials():
        print("\nFirebase is now configured! Reload the application to connect.")
    else:
        print("\nFailed to configure Firebase credentials.")
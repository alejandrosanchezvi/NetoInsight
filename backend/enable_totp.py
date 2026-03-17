import google.auth
import google.auth.transport.requests
import requests
import json

try:
    print("Obtaining credentials...")
    credentials, project = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    
    auth_req = google.auth.transport.requests.Request()
    credentials.refresh(auth_req)
    token = credentials.token
    
    print(f"Token acquired. Project: {project or 'netoinsight-fed03'}")
    
    url = "https://identitytoolkit.googleapis.com/admin/v2/projects/netoinsight-fed03/config?updateMask=mfa"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Goog-User-Project": "netoinsight-fed03"
    }
    
    payload = {
        "mfa": {
            "providerConfigs": [
                {
                    "state": "ENABLED",
                    "totpProviderConfig": {
                        "adjacentIntervals": 5
                    }
                }
            ]
        }
    }
    
    print("Calling Identity Toolkit API...")
    response = requests.patch(url, headers=headers, json=payload)
    
    if response.status_code == 200:
        print("Success! TOTP MFA enabled.")
    else:
        print(f"Failed: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"Error: {e}")

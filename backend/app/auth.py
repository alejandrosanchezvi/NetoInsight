import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

security = HTTPBearer()

# Flag para saber si Firebase está inicializado
firebase_initialized = False

try:
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "./firebase-credentials.json")
    
    if os.path.exists(cred_path):
        print(f"✅ Using credentials file: {cred_path}")
        cred = credentials.Certificate(cred_path)
    else:
        print("⚠️  Credentials file not found")
        print("💡 Using Application Default Credentials")
        print("💡 Make sure you ran: gcloud auth application-default login")
        cred = credentials.ApplicationDefault()
    
    firebase_admin.initialize_app(cred)
    firebase_initialized = True
    print("✅ Firebase initialized successfully")
    
except ValueError as e:
    if "already exists" in str(e):
        firebase_initialized = True
        print("✅ Firebase already initialized")
    else:
        print(f"❌ Firebase init error: {e}")
except Exception as e:
    print(f"❌ Firebase init error: {e}")
    print("⚠️  Backend will start but Firebase auth will not work")

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify Firebase ID token"""
    if not firebase_initialized:
        raise HTTPException(
            status_code=500, 
            detail="Firebase not initialized. Check server logs."
        )
    
    try:
        token = credentials.credentials
        decoded = firebase_auth.verify_id_token(token)
        print(f"✅ Token verified for: {decoded.get('email')}")
        return decoded
    except Exception as e:
        print(f"❌ Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
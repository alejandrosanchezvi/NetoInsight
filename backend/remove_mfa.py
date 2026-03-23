import os
import firebase_admin
from firebase_admin import credentials, auth
from dotenv import load_dotenv

load_dotenv()
cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH', './firebase-credentials.json')
cred = credentials.Certificate(cred_path) if os.path.exists(cred_path) else credentials.ApplicationDefault()
firebase_admin.initialize_app(credential=cred, options={'projectId': os.getenv('FIREBASE_PROJECT_ID', 'netoinsight-fed03')})

try:
    u = auth.get_user_by_email('alejandro.sanchezvi@tiendasneto.com')
    print(f"Borrando forzosamente MFA para {u.email} ({u.uid})")
    
    # Intento 1: Pasando lista vacia
    try:
        auth.update_user(u.uid, multi_factor=auth.MultiFactorUpdate([]))
        print('Exito: Borrado con MultiFactorUpdate([])')
    except Exception as e:
        print(f'Fallo Intento 1: {e}')
        # Intento 2: Pasando None
        try:
            auth.update_user(u.uid, multi_factor=None)
            print('Exito: Borrado con multi_factor=None')
        except Exception as e2:
            print(f'Fallo Intento 2: {e2}')
            
except Exception as e3:
    print(f"No se encontro el usuario: {e3}")

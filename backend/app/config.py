# ⚙️ NetoInsight - Configuration (VALIDADO)

import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Función helper para obtener variables y validar
def get_env_var(key: str, default: str = None) -> str:
    """Obtiene variable de entorno y asegura que sea string"""
    value = os.getenv(key, default)
    
    if value is None:
        raise ValueError(f"❌ Variable de entorno '{key}' no encontrada")
    
    # Asegurar que sea string
    value = str(value).strip()
    
    if not value:
        raise ValueError(f"❌ Variable de entorno '{key}' está vacía")
    
    return value

# ===== TABLEAU CONFIGURATION =====
TABLEAU_SERVER = get_env_var('TABLEAU_SERVER')
TABLEAU_SITE = get_env_var('TABLEAU_SITE')
TABLEAU_CONNECTED_APP_CLIENT_ID = get_env_var('TABLEAU_CONNECTED_APP_CLIENT_ID')
TABLEAU_CONNECTED_APP_SECRET_ID = get_env_var('TABLEAU_CONNECTED_APP_SECRET_ID')
TABLEAU_CONNECTED_APP_SECRET_VALUE = get_env_var('TABLEAU_CONNECTED_APP_SECRET_VALUE')

# ===== FIREBASE CONFIGURATION =====
FIREBASE_CREDENTIALS_PATH = get_env_var('FIREBASE_CREDENTIALS_PATH', './firebase-credentials.json')

# ===== API CONFIGURATION =====
BACKEND_URL = get_env_var('BACKEND_URL', 'http://localhost:8000')
FRONTEND_URL = get_env_var('FRONTEND_URL', 'http://localhost:4200')

# ===== VALIDATION & LOGGING =====
print("\n" + "="*80)
print("  CONFIGURACIN CARGADA")
print("="*80)
print(f" Tableau Server: {TABLEAU_SERVER}")
print(f" Tableau Site: {TABLEAU_SITE}")
print(f" Client ID: {TABLEAU_CONNECTED_APP_CLIENT_ID[:20]}...")
print(f" Secret ID: {TABLEAU_CONNECTED_APP_SECRET_ID[:20]}...")
print(f" Secret Value: {TABLEAU_CONNECTED_APP_SECRET_VALUE[:20]}...")
print(f" Firebase Path: {FIREBASE_CREDENTIALS_PATH}")
print(f" Backend URL: {BACKEND_URL}")
print(f" Frontend URL: {FRONTEND_URL}")
print("="*80 + "\n")

# Validar tipos
assert isinstance(TABLEAU_CONNECTED_APP_CLIENT_ID, str), "Client ID debe ser string"
assert isinstance(TABLEAU_CONNECTED_APP_SECRET_ID, str), "Secret ID debe ser string"
assert isinstance(TABLEAU_CONNECTED_APP_SECRET_VALUE, str), "Secret Value debe ser string"

print(" Todas las variables son strings vlidos\n")
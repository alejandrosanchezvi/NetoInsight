#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  NetoInsight — Deploy Backend a Cloud Run (producción)
#  Uso: ./deploy-backend.sh
# ─────────────────────────────────────────────────────────────

set -e  # detener si cualquier comando falla

PROJECT_ID="netoinsight-fed03"
SERVICE="netoinsight-api-prod"
REGION="us-central1"
ACCOUNT="alejandro.sanchezvi@tiendasnetows.com"

echo "🔧 Configurando cuenta y proyecto..."
gcloud config set account $ACCOUNT
gcloud config set project $PROJECT_ID

echo "🕐 Corrigiendo timestamps (fix ZIP < 1980)..."
find . -type f | xargs touch

echo "🚀 Desplegando $SERVICE..."
gcloud run deploy $SERVICE \
  --source . \
  --region $REGION \
  --project $PROJECT_ID \
  --update-env-vars FRONTEND_URL=https://netoinsight.soyneto.com

echo "✅ Deploy completado — $SERVICE en $REGION"
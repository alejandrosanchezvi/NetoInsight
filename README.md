# NetoInsight

Monorepo que contiene el frontend y backend de NetoInsight.

## Estructura

```
NetoInsight/
├── frontend/   # Angular app
└── backend/    # FastAPI (Python)
```

## Frontend (Angular)

```bash
cd frontend
npm install
npm run start
```

## Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
python -m uvicorn main:app --reload --port 8000
```

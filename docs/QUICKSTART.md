# Quickstart

## Start Everything

```bash
npm install --prefix frontend
docker-compose up --build
```

## Local Backend Setup

```bash
python -m pip install -r backend/requirements.txt
# Copy backend/.env.example to backend/.env
python backend/main.py
```

The backend automatically loads environment variables from the repo root `.env` and `backend/.env`.

## Windows PowerShell Shortcuts

```powershell
.\scripts\install.ps1
.\scripts\backend-dev.ps1
.\scripts\frontend-dev.ps1
```

## App URLs

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

## Useful Commands

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down -v
npm --prefix frontend run build
npm --prefix frontend run dev
python backend/main.py
npm --prefix frontend run lint
```

## API Smoke Checks

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/products
curl http://localhost:8000/api/categories
```

Example inquiry:

```bash
curl -X POST http://localhost:8000/api/inquiries ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Customer\",\"phone\":\"9000000000\",\"message\":\"Need 20 return gift sets\",\"productId\":\"sacred-return-gift-set\"}"
```

## Key Files

- `frontend/src/App.tsx`
- `frontend/src/context/StoreContext.tsx`
- `frontend/src/content/siteCopy.ts`
- `backend/app/main.py`
- `docker-compose.yml`

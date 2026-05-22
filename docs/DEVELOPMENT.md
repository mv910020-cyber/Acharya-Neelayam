# Development Guide

## Local Workflow

Frontend:

```bash
npm install --prefix frontend
npm --prefix frontend run dev
```

Docker hot reload:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This starts the frontend with Vite inside Docker on `http://localhost:5173` and bind-mounts `frontend/`, so `src/components/LoginPage.tsx` and `src/components/LoginPage.css` update immediately in the browser.

Backend:

```bash
python -m pip install -r backend/requirements.txt
# Copy backend/.env.example to backend/.env
python backend/main.py
```

The backend loads environment variables from the repo root `.env` and `backend/.env`, with `backend/.env` taking priority.

Windows PowerShell shortcuts:

```powershell
.\scripts\install.ps1
.\scripts\docker-dev.ps1
.\scripts\backend-dev.ps1
.\scripts\frontend-dev.ps1
```

## Main Source Files

Frontend:

- `frontend/src/App.tsx` wires routing and layout.
- `frontend/src/context/StoreContext.tsx` handles product loading, inquiry submission, and cart state.
- `frontend/src/context/LanguageContext.tsx` manages English and Telugu copy.
- `frontend/src/content/siteCopy.ts` contains storefront copy and translated labels.
- `frontend/src/components/` contains page and UI components.

Backend:

- `backend/app/main.py` contains the FastAPI app, mock catalog, inquiry models, and PostgreSQL persistence for inquiries.

## Current API Surface

- `GET /api/products`
- `GET /api/products/{product_id}`
- `GET /api/categories`
- `POST /api/inquiries`
- `GET /api/health`

## Data Notes

- Product catalog data is currently defined in `backend/app/main.py`.
- Inquiry records are stored in PostgreSQL when `DATABASE_URL` is available.
- If PostgreSQL is unavailable, inquiries are kept in memory for the process lifetime.

## Assets

- Public product media lives in `frontend/public/products`.
- Branding assets live in `frontend/public/`.

## Helpful Commands

```bash
make help
make install
make dev
make frontend-dev
make backend-dev
make logs
make test-api
```

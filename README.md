# Aachara Nilayam Storefront

React + FastAPI storefront for puja products, festival kits, and customer inquiries. The frontend serves a catalog and cart flow, while the backend exposes product, category, health, and inquiry endpoints. Docker Compose starts the frontend, backend, and PostgreSQL together.

## Stack

- React 19 + TypeScript + Vite
- FastAPI + Pydantic
- PostgreSQL for inquiry storage when `DATABASE_URL` is configured
- Docker, Docker Compose, and Nginx

## Project Layout

```text
my-app/
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |-- content/
|   |   |-- context/
|   |   |-- App.tsx
|   |   `-- main.tsx
|   |-- public/
|   |   |-- products/
|   |   `-- aachara-nilayam-logo.svg
|   |-- Dockerfile
|   `-- nginx.conf
|-- backend/
|   |-- app/
|   |   `-- main.py
|   |-- requirements.txt
|   `-- Dockerfile
|-- docs/
|   |-- QUICKSTART.md
|   |-- DEVELOPMENT.md
|   |-- DEPLOYMENT.md
|   `-- IMPLEMENTATION_SUMMARY.md
|-- docker-compose.yml
`-- Makefile
```

## Quick Start

### Docker Compose

```bash
npm install --prefix frontend
docker-compose up --build
```

App URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

### Docker Hot Reload

Use the dev compose file when you want frontend `tsx` and `css` edits to appear immediately without rebuilding the image:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Hot-reload URLs:

- Frontend dev server: `http://localhost:5173`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

### Local Development

Frontend:

```bash
npm install --prefix frontend
npm --prefix frontend run dev
```

Backend:

```bash
python -m pip install -r backend/requirements.txt
# Copy backend/.env.example to backend/.env
# Or set the same backend variables in the repo root .env
python backend/main.py
```

Windows PowerShell shortcut:

```powershell
.\scripts\install.ps1
.\scripts\docker-dev.ps1
.\scripts\backend-dev.ps1
.\scripts\frontend-dev.ps1
```

## API Endpoints

- `GET /api/products`
- `GET /api/products/{product_id}`
- `GET /api/categories`
- `POST /api/inquiries`
- `GET /api/health`
- `GET /`

## Notes

- Product images are served from `frontend/public/products`.
- Inquiry records fall back to in-memory storage if PostgreSQL is not available.
- Authentication endpoints require a reachable PostgreSQL database via `DATABASE_URL`.
- Local backend runs automatically load environment variables from both the repo root `.env` and `backend/.env`.
- CORS origins can be configured with `CORS_ORIGINS`.

## Related Docs

- [QUICKSTART.md](./docs/QUICKSTART.md)
- [DEVELOPMENT.md](./docs/DEVELOPMENT.md)
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [IMPLEMENTATION_SUMMARY.md](./docs/IMPLEMENTATION_SUMMARY.md)

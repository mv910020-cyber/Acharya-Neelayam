# Deployment Guide

## Runtime Services

- Frontend served by Nginx on port `80`
- FastAPI backend on port `8000`
- PostgreSQL 16 for inquiry persistence

## Environment

Frontend build arg:

```env
VITE_API_URL=/api
```

Backend environment:

```env
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=False
CORS_ORIGINS=["https://your-domain.example"]
DATABASE_URL=postgresql://user:password@db:5432/database_name
```

## Docker Compose

```bash
docker-compose up --build -d
docker-compose ps
docker-compose logs -f
```

## Health Checks

- Frontend: `GET /health.html`
- Backend: `GET /api/health`

## Production Checklist

- Set `CORS_ORIGINS` to your real frontend origins.
- Replace default PostgreSQL credentials.
- Point `DATABASE_URL` at persistent storage.
- Terminate TLS at your reverse proxy or load balancer.
- Keep `frontend/public/products` and brand assets in the deployed image.

## Rollback

If you deploy with Docker Compose, redeploy the previous image tags and restart the stack. If you deploy with another platform, keep the same backend health endpoint and `/api` proxy contract so the frontend remains compatible.

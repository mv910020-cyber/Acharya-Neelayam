# Implementation Summary

## Current Application

This project is now a puja-products storefront instead of the previous sample review app.

## Frontend

- React storefront with routes for home, products, product detail, auspicious days, about, and contact
- Cart drawer with checkout flow
- English and Telugu copy through shared content files
- Local product assets served from `frontend/public/products`

## Backend

- FastAPI API for products, categories, inquiries, health, and root metadata
- In-memory product catalog
- PostgreSQL-backed inquiry persistence when configured
- CORS support for local and deployed frontends

## Infra

- Frontend Docker image built with Vite and served by Nginx
- Backend Docker image runs Uvicorn
- Docker Compose starts frontend, backend, and PostgreSQL together

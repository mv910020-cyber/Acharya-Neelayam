# Development commands for the Aachara Nilayam storefront

.PHONY: help install install-frontend install-backend dev frontend-dev backend-dev build start stop restart logs logs-frontend logs-backend down clean build-frontend build-backend test-api ps shell-frontend shell-backend docker-dev

help:
	@echo "Aachara Nilayam - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install          - Install frontend and backend dependencies"
	@echo "  make install-frontend - Install frontend dependencies"
	@echo "  make install-backend  - Install backend dependencies in the active Python environment"
	@echo "  make build            - Build Docker images"
	@echo ""
	@echo "Running:"
	@echo "  make dev              - Start the Docker hot-reload stack on port 5173"
	@echo "  make docker-dev       - Alias for make dev"
	@echo "  make frontend-dev     - Start the Vite dev server"
	@echo "  make backend-dev      - Start the FastAPI backend from the repo root"
	@echo "  make start            - Start all services in detached mode"
	@echo "  make stop             - Stop all services"
	@echo "  make restart          - Restart all services"
	@echo ""
	@echo "Logs:"
	@echo "  make logs             - View all logs"
	@echo "  make logs-frontend    - View frontend logs"
	@echo "  make logs-backend     - View backend logs"
	@echo ""
	@echo "Building:"
	@echo "  make build-frontend   - Build frontend Docker image"
	@echo "  make build-backend    - Build backend Docker image"
	@echo ""
	@echo "Utility:"
	@echo "  make test-api         - Check health, products, and categories"
	@echo "  make ps               - Show container status"
	@echo "  make clean            - Remove stopped containers"
	@echo "  make down             - Remove services and volumes"

install: install-frontend install-backend
	@echo "Frontend and backend dependencies installed"

install-frontend:
	npm install --prefix frontend
	@echo "Frontend dependencies installed"

install-backend:
	python -m venv backend/.venv
	backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
	@echo "Backend dependencies installed in backend/.venv"

dev:
	docker compose -f docker-compose.dev.yml up --build
	@echo "Hot-reload frontend started at http://localhost:5173"

docker-dev:
	docker compose -f docker-compose.dev.yml up --build
	@echo "Hot-reload frontend started at http://localhost:5173"

frontend-dev:
	npm --prefix frontend run dev

backend-dev:
	backend/.venv/Scripts/python.exe backend/main.py

build:
	docker-compose build --no-cache
	@echo "Docker images built"

build-frontend:
	docker build -t sampradaya-frontend:latest ./frontend
	@echo "Frontend image built"

build-backend:
	docker build -t sampradaya-backend:latest ./backend
	@echo "Backend image built"

start:
	docker-compose up -d
	@echo "Services started"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:8000"
	@echo "API Docs: http://localhost:8000/docs"

stop:
	docker-compose stop
	@echo "Services stopped"

restart: stop start

logs:
	docker-compose logs -f

logs-frontend:
	docker-compose logs -f frontend

logs-backend:
	docker-compose logs -f backend

clean: stop
	docker-compose rm -f
	@echo "Containers removed"

down:
	docker-compose down -v
	@echo "Services and volumes removed"

test-api:
	@echo "Health:"
	@curl -s http://localhost:8000/api/health | python -m json.tool
	@echo ""
	@echo "Products:"
	@curl -s http://localhost:8000/api/products | python -m json.tool
	@echo ""
	@echo "Categories:"
	@curl -s http://localhost:8000/api/categories | python -m json.tool

ps:
	docker-compose ps

shell-frontend:
	docker-compose exec frontend sh

shell-backend:
	docker-compose exec backend sh

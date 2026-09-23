#!/bin/bash

# ESSR_PA Multi-Service Startup Script
eval "$(mise activate bash 2>/dev/null)" || true

echo "==================================="
echo "Starting ESSR_PA Services..."
echo "==================================="

# 1. Start Backend API (FastAPI)
echo "=> Starting Backend API (Port 8000)..."
cd backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# 2. Check and start Redis if not running
if ! redis-cli ping >/dev/null 2>&1; then
  echo "=> Starting Redis server in background..."
  redis-server --daemonize yes 2>/dev/null || true
fi

# 3. Start Celery Worker
echo "=> Starting Celery Worker..."
cd backend
source .venv/bin/activate
celery -A celery_app worker --loglevel=info &
CELERY_PID=$!
cd ..

# 3. Start Frontend UI (Next.js)
echo "=> Starting Frontend UI (Port 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "==================================="
echo "All services started!"
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop all services."
echo "==================================="

# Trap Ctrl+C (SIGINT) to kill all background processes
trap "echo 'Stopping all services...'; kill $BACKEND_PID $CELERY_PID $FRONTEND_PID; exit" INT

# Wait indefinitely
wait

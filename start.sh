#!/usr/bin/env bash
# ==============================================================================
# Flint Prepress Studio - Service Control & Desktop Launcher
# ==============================================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Ensure mise / environment variables are loaded
eval "$(mise activate bash 2>/dev/null)" || true

RUN_DIR="$PROJECT_DIR/.run"
mkdir -p "$RUN_DIR"

BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

is_backend_running() {
    curl -s -m 2 http://127.0.0.1:8000/ >/dev/null 2>&1
}

is_frontend_running() {
    curl -s -m 2 http://127.0.0.1:3000/ >/dev/null 2>&1
}

focus_window() {
    if command -v hyprctl >/dev/null 2>&1; then
        # Check if Zen Browser window with Flint / 3000 is open and focus it
        ADDR=$(hyprctl clients -j 2>/dev/null | grep -B 5 -iE "Flint|3000|Prepress" | grep '"address":' | head -n 1 | awk -F'"' '{print $4}')
        if [ -n "$ADDR" ]; then
            hyprctl dispatch focuswindow "address:$ADDR" >/dev/null 2>&1
            return 0
        fi
    fi
    return 1
}

open_app_window() {
    echo "Opening Flint app window..."
    if command -v zen-browser >/dev/null 2>&1; then
        zen-browser --new-window "http://localhost:3000" >/dev/null 2>&1 &
    elif command -v google-chrome >/dev/null 2>&1; then
        google-chrome --app="http://localhost:3000" >/dev/null 2>&1 &
    elif command -v chromium >/dev/null 2>&1; then
        chromium --app="http://localhost:3000" >/dev/null 2>&1 &
    else
        xdg-open "http://localhost:3000" >/dev/null 2>&1 &
    fi
}

start_services() {
    echo "Starting Flint Prepress Studio..."
    command -v notify-send >/dev/null 2>&1 && notify-send -i flint "Flint" "Starting Prepress Studio..." || true

    # 1. Backend
    if ! is_backend_running; then
        echo "=> Starting Backend API (Port 8000)..."
        systemctl --user stop flint-backend 2>/dev/null || true
        fuser -k 8000/tcp 2>/dev/null || true
        pkill -9 -f "uvicorn.*8000" 2>/dev/null || true
        systemd-run --user --unit=flint-backend bash -c "cd '$PROJECT_DIR/backend' && source .venv/bin/activate && exec uvicorn main:app --reload --host 0.0.0.0 --port 8000" >/dev/null 2>&1
    fi

    # 2. Frontend
    if ! is_frontend_running; then
        echo "=> Starting Frontend UI (Port 3000)..."
        systemctl --user stop flint-frontend 2>/dev/null || true
        fuser -k 3000/tcp 2>/dev/null || true
        pkill -9 -f "next-server" 2>/dev/null || true
        systemd-run --user --unit=flint-frontend bash -c "cd '$PROJECT_DIR/frontend' && exec npm run dev" >/dev/null 2>&1
    fi

    # Wait for services to become responsive
    echo -n "Waiting for Flint to initialize..."
    for i in {1..25}; do
        if is_frontend_running && is_backend_running; then
            echo " Ready!"
            command -v notify-send >/dev/null 2>&1 && notify-send -i flint "Flint" "Studio is ready on port 3000" || true
            return 0
        fi
        sleep 0.5
        echo -n "."
    done
    echo " Started (waiting for final compilation)."
}

stop_services() {
    echo "Stopping Flint services..."
    command -v notify-send >/dev/null 2>&1 && notify-send -i flint "Flint" "Shutting down services..." || true

    systemctl --user stop flint-backend flint-frontend 2>/dev/null || true

    # Cleanup any lingering processes on ports 8000 and 3000
    pkill -f "uvicorn main:app.*8000" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true

    echo "Flint has stopped cleanly."
}

case "$1" in
    launch)
        if is_frontend_running; then
            echo "Flint is already running."
            if ! focus_window; then
                open_app_window
            fi
            command -v notify-send >/dev/null 2>&1 && notify-send -i flint "Flint" "Focused active Flint window" || true
        else
            start_services
            open_app_window
        fi
        ;;
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 1
        start_services
        ;;
    status)
        echo "=== Flint Status ==="
        echo -n "Backend  (8000): " && (is_backend_running && echo "ONLINE" || echo "OFFLINE")
        echo -n "Frontend (3000): " && (is_frontend_running && echo "ONLINE" || echo "OFFLINE")
        ;;
    *)
        # Default foreground mode (like classic ./start.sh)
        trap "stop_services; exit" INT TERM
        start_services
        echo "==================================="
        echo "Flint Prepress Studio is running!"
        echo "Frontend: http://localhost:3000"
        echo "Backend:  http://localhost:8000"
        echo "Press Ctrl+C to stop all services."
        echo "==================================="
        wait
        ;;
esac

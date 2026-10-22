#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
if [[ ! -x .venv/bin/python || ! -d frontend/node_modules ]]; then
  echo "Run the README local installation steps first."
  exit 1
fi
mkdir -p .local artifacts
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
.venv/bin/python - "$BACKEND_PORT" "$FRONTEND_PORT" <<'PY'
import socket
import sys
for port in map(int, sys.argv[1:]):
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            raise SystemExit(f"Port {port} is in use. Choose unused BACKEND_PORT and FRONTEND_PORT values before starting XAIFlow.")
PY
export DATABASE_URL="${DATABASE_URL:-sqlite:///$PROJECT_DIR/.local/xaiflow.db}"
export ARTIFACT_ROOT="${ARTIFACT_ROOT:-$PROJECT_DIR/artifacts}"
export PYTHONPATH="$PROJECT_DIR/backend"
export MPLCONFIGDIR="$PROJECT_DIR/.local/matplotlib"
export XDG_CACHE_HOME="$PROJECT_DIR/.local/cache"
export API_TARGET="http://127.0.0.1:$BACKEND_PORT"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:$FRONTEND_PORT,http://127.0.0.1:$FRONTEND_PORT}"
cleanup() { kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
cd backend
../.venv/bin/alembic upgrade head
../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" &
BACKEND_PID=$!
cd ../frontend
npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort &
FRONTEND_PID=$!
echo "XAIFlow: http://localhost:$FRONTEND_PORT | API documentation: http://localhost:$BACKEND_PORT/docs"
wait "$BACKEND_PID" "$FRONTEND_PID"

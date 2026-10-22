FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 MPLCONFIGDIR=/tmp/matplotlib XDG_CACHE_HOME=/tmp/cache
WORKDIR /app
COPY backend/requirements.txt backend/requirements.lock ./
RUN pip install 'torch==2.14.1' --index-url https://download.pytorch.org/whl/cpu \
    && pip install -r requirements.txt -c requirements.lock
COPY backend/ ./
COPY data/ /app/data/
RUN useradd --create-home --uid 10001 xaiflow && mkdir -p /app/artifacts && chown -R xaiflow:xaiflow /app
USER xaiflow
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]

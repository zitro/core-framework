FROM python:3.11-slim AS base

WORKDIR /app

RUN addgroup --system --gid 1001 appuser && \
    adduser --system --uid 1001 --ingroup appuser appuser

COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir . && \
    pip install --no-cache-dir ".[local]" && \
    pip install --no-cache-dir ".[azure]"

COPY app ./app

# Pre-create /data subdirs with appuser ownership so named volumes / bind
# mounts inherit correct perms on first creation (avoids root-owned volumes).
RUN mkdir -p /app/data /data/storage /data/projects /data/prompts /data/extensions && \
    chown -R appuser:appuser /app /data

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health',timeout=3).status==200 else 1)"

# `--proxy-headers` honours `X-Forwarded-For` / `X-Forwarded-Proto` so client IPs
# (used by per-user rate limiting) reflect the real client when running behind
# a reverse proxy or ingress controller.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]

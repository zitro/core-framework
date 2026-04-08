FROM python:3.11-slim AS base

WORKDIR /app

RUN addgroup --system --gid 1001 appuser && \
    adduser --system --uid 1001 --ingroup appuser appuser

COPY pyproject.toml ./
RUN pip install --no-cache-dir . && \
    pip install --no-cache-dir ".[local]"

COPY app ./app

RUN mkdir -p /app/data && chown -R appuser:appuser /app/data

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

## Use newer Dockerfile syntax for cache mounts
# syntax=docker/dockerfile:1.6
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies in a dedicated layer with pip cache reuse.
# If requirements.txt is unchanged this layer will be fully cached.
FROM base AS deps
COPY backend/requirements.txt /app/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Final runtime image (can be slimmed further later by separating dev deps)
FROM base AS runtime
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
WORKDIR /app
ENV OPENAI_MODEL=gpt-4o-mini \
    OPENAI_TEMPERATURE=0.2 \
    GIT_COMMIT=${GIT_COMMIT} \
    BUILD_TIME=${BUILD_TIME}
COPY --from=deps /usr/local /usr/local
COPY backend/ /app/backend/
EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]

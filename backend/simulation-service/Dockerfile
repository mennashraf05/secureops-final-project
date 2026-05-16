FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

WORKDIR /app/simulation-service

# Copy and install requirements specific to the simulation engine
COPY simulation-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared utilities and the simulation service source code
COPY shared /app/shared
COPY simulation-service /app/simulation-service

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
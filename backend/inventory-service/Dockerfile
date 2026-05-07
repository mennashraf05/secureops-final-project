FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

WORKDIR /app/inventory-service

COPY inventory-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY shared /app/shared
COPY inventory-service /app/inventory-service

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

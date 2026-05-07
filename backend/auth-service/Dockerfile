FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

WORKDIR /app/auth-service

COPY auth-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY shared /app/shared
COPY auth-service /app/auth-service

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

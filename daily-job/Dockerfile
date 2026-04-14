# Cloud Run / Cloud Functions (2nd gen) — build context: this directory (daily-job/)
FROM python:3.11-slim

WORKDIR /workspace

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV PORT=8080
CMD exec functions-framework --target=update_mlb_players_snapshot --port=$PORT

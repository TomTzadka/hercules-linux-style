FROM python:3.12-slim
WORKDIR /app

# System libraries required by ibm_db CLIDRIVER at runtime
# gcc + python3-dev are needed only if a pre-compiled wheel is unavailable
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    libpam0g \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install core dependencies first (always succeeds)
RUN grep -vE "^ibm_db" requirements.txt | pip install --no-cache-dir -r /dev/stdin

# IBM Db2 driver — optional. If install fails the backend still starts;
# DB2 panel will show "DB2 not configured" until a connection is available.
RUN pip install --no-cache-dir "ibm_db==3.2.8" "ibm_db_sa==0.4.4" \
    || echo "WARNING: ibm_db install failed — DB2 panel will be in degraded mode"

COPY app/ ./app/
RUN adduser --disabled-password --gecos '' appuser
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

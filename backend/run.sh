#!/usr/bin/env bash
# One-line backend boot: install (first run), seed demo data, serve on :8000.
set -e
cd "$(dirname "$0")"
python -m pip install -q -r requirements.txt
if [ ! -f data/app.db ]; then python seed.py --reset; fi
exec python -m uvicorn main:app --host 127.0.0.1 --port 8000

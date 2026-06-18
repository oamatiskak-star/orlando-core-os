#!/usr/bin/env bash
# ScrapeGraph Engine — eenmalige setup op CLI-R / CLI-L
# Voer uit vanuit de project-root: bash scrapegraph-engine/setup.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[scrapegraph-engine] Python-versie:"
python3 --version

echo "[scrapegraph-engine] venv aanmaken in scrapegraph-engine/venv ..."
python3 -m venv venv

echo "[scrapegraph-engine] pip install in venv..."
venv/bin/pip install --upgrade pip -q
venv/bin/pip install -r requirements.txt

echo "[scrapegraph-engine] playwright browsers installeren..."
venv/bin/playwright install chromium

echo "[scrapegraph-engine] klaar — start met:"
echo "  pm2 start ecosystem.config.js --only scrapegraph-engine"
echo "  of: cd scrapegraph-engine && venv/bin/python main.py"

#!/usr/bin/env bash
# ScrapeGraph Engine — eenmalige setup op CLI-R / CLI-L
# Voer uit vanuit de project-root: bash scrapegraph-engine/setup.sh
set -e

echo "[scrapegraph-engine] Python-versie:"
python3 --version

echo "[scrapegraph-engine] pip install..."
pip3 install -r scrapegraph-engine/requirements.txt

echo "[scrapegraph-engine] playwright browsers installeren..."
playwright install chromium

echo "[scrapegraph-engine] klaar — start met:"
echo "  pm2 start ecosystem.config.js --only scrapegraph-engine"
echo "  of: cd scrapegraph-engine && python main.py"

"""
ScrapeGraph Engine — Orlando Core OS
LLM-gestuurde webscraper via ScrapeGraphAI + Claude.
Draait als Python microservice (port 3013); Node.js workers roepen het aan via fetch().

Endpoints:
  GET  /health       — uptime check
  POST /scrape       — SmartScraper: URL + prompt → gestructureerde JSON
  POST /search       — SearchGraph: zoekopdracht + prompt → resultaten
  POST /markdownify  — MarkdownifyGraph: URL → schone Markdown
  POST /batch        — meerdere URLs tegelijk scrapen
"""

import os
import sys
import json
import logging
from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.gh-secrets'), override=False)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'), override=False)

ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
PORT = int(os.getenv('SCRAPEGRAPH_PORT', '3013'))
DEFAULT_MODEL = os.getenv('SCRAPEGRAPH_MODEL', 'claude-3-5-haiku-latest')
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s [scrapegraph-engine] %(levelname)s %(message)s',
)
log = logging.getLogger(__name__)

if not ANTHROPIC_API_KEY:
    log.warning('ANTHROPIC_API_KEY niet gezet — scrape-verzoeken zullen mislukken')


def make_llm_config(model: Optional[str] = None) -> dict:
    return {
        'llm': {
            'api_key': ANTHROPIC_API_KEY,
            'model': f'anthropic/{model or DEFAULT_MODEL}',
        },
        'headless': True,
        'verbose': False,
    }


# ── Request/Response schemas ──────────────────────────────────

class ScrapeRequest(BaseModel):
    url: str
    prompt: str
    model: Optional[str] = None
    schema_: Optional[dict] = None  # optioneel Pydantic-schema als dict

class SearchRequest(BaseModel):
    query: str
    prompt: str
    num_results: int = 5
    model: Optional[str] = None

class MarkdownifyRequest(BaseModel):
    url: str
    model: Optional[str] = None

class BatchScrapeRequest(BaseModel):
    urls: list[str]
    prompt: str
    model: Optional[str] = None


# ── FastAPI app ───────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(f'scrapegraph-engine gestart op port {PORT} (model: {DEFAULT_MODEL})')
    yield
    log.info('scrapegraph-engine gestopt')

app = FastAPI(title='ScrapeGraph Engine', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])


@app.get('/health')
def health():
    return {
        'service': 'scrapegraph-engine',
        'status': 'ok',
        'model': DEFAULT_MODEL,
        'anthropic_key_set': bool(ANTHROPIC_API_KEY),
    }


@app.post('/scrape')
async def scrape(req: ScrapeRequest):
    """SmartScraper: geeft gestructureerde JSON terug op basis van prompt + URL."""
    from scrapegraphai.graphs import SmartScraperGraph

    log.info(f'[scrape] {req.url} — {req.prompt[:80]}')
    try:
        graph = SmartScraperGraph(
            prompt=req.prompt,
            source=req.url,
            config=make_llm_config(req.model),
        )
        result = graph.run()
        return {'ok': True, 'result': result, 'url': req.url}
    except Exception as e:
        log.error(f'[scrape] fout: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/search')
async def search(req: SearchRequest):
    """SearchGraph: voert webzoekopdracht uit en extraheert structuur via prompt."""
    from scrapegraphai.graphs import SearchGraph

    log.info(f'[search] query="{req.query}" — {req.prompt[:80]}')
    try:
        config = make_llm_config(req.model)
        config['max_results'] = req.num_results
        graph = SearchGraph(
            prompt=req.prompt,
            source=req.query,
            config=config,
        )
        result = graph.run()
        return {'ok': True, 'result': result, 'query': req.query}
    except Exception as e:
        log.error(f'[search] fout: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/markdownify')
async def markdownify(req: MarkdownifyRequest):
    """MarkdownifyGraph: converteert een pagina naar schone Markdown voor LLM-ingestie."""
    from scrapegraphai.graphs import MarkdownifyGraph

    log.info(f'[markdownify] {req.url}')
    try:
        graph = MarkdownifyGraph(
            prompt='Converteer de hele pagina naar nette Markdown, behoud structuur.',
            source=req.url,
            config=make_llm_config(req.model),
        )
        result = graph.run()
        markdown = result.get('content') or result.get('markdown') or str(result)
        return {'ok': True, 'markdown': markdown, 'url': req.url}
    except Exception as e:
        log.error(f'[markdownify] fout: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/batch')
async def batch(req: BatchScrapeRequest):
    """Scrapet meerdere URLs met dezelfde prompt; gooit fouten weg (fail-open)."""
    from scrapegraphai.graphs import SmartScraperMultiGraph

    log.info(f'[batch] {len(req.urls)} URLs — {req.prompt[:80]}')
    try:
        graph = SmartScraperMultiGraph(
            prompt=req.prompt,
            source=req.urls,
            config=make_llm_config(req.model),
        )
        result = graph.run()
        return {'ok': True, 'result': result, 'count': len(req.urls)}
    except Exception as e:
        log.error(f'[batch] fout: {e}')
        raise HTTPException(status_code=500, detail=str(e))


# ── Standalone runner ─────────────────────────────────────────
if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=PORT, log_level=LOG_LEVEL.lower())

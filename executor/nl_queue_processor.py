#!/usr/bin/env python3
"""
YouTube Queue Processor Daemon
Controleert elke 5 min de youtube_upload_queue en produceert + uploadt due slots.
"""
from __future__ import annotations
import os, sys, time, logging, subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from supabase import create_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(Path(__file__).parent / "queue_processor.log"),
    ]
)
log = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
CHECK_INTERVAL = 300        # 5 minuten
WINDOW_MINUTES = 15         # slots die binnen 15 min gepland staan
MAX_PAST_HOURS = 3          # pas ook slots toe die tot 3 uur geleden gepland waren
PYTHON = sys.executable
PRODUCER = str(Path(__file__).parent / "nl_produce_and_upload.py")

NL_CHANNELS = {"VermogenTv", "SpaarTv", "VastgoedTv", "CryptoVermogen", "BeleggingsTv"}
EN_CHANNELS  = {"PropertyInvestorTv"}

def get_db():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def refresh_tokens():
    """Vernieuw alle verlopen tokens via de live API."""
    import httpx
    db = get_db()
    channels = db.table("youtube_channels").select("id,name,oauth_status").execute().data or []
    for ch in channels:
        try:
            r = httpx.post(
                "https://dashboard.strkbeheer.nl/api/youtube/token-refresh",
                json={"channelId": ch["id"]},
                timeout=15,
            )
            if r.status_code == 200:
                log.info(f"Token vernieuwd: {ch['name']}")
            else:
                log.warning(f"Token refresh mislukt {ch['name']}: {r.text[:80]}")
        except Exception as e:
            log.warning(f"Token refresh fout {ch['name']}: {e}")

def get_due_slots(db) -> list[dict]:
    now = datetime.now(timezone.utc)
    window_end  = now + timedelta(minutes=WINDOW_MINUTES)
    window_start = now - timedelta(hours=MAX_PAST_HOURS)

    res = db.table("youtube_upload_queue") \
        .select("id,title,channel_id,scheduled_publish_at,status,retry_count") \
        .eq("status", "planned") \
        .gte("scheduled_publish_at", window_start.isoformat()) \
        .lte("scheduled_publish_at", window_end.isoformat()) \
        .order("scheduled_publish_at") \
        .execute()
    return res.data or []

def parse_slot(slot: dict, channel_name: str) -> tuple[str, str]:
    """Returns (video_type, channel_name)."""
    title = slot.get("title", "")
    is_short = title.startswith("[Short]")
    return ("short" if is_short else "long", channel_name)

def process_slot(slot: dict, channel_name: str, db):
    slot_id = slot["id"]
    video_type, ch = parse_slot(slot, channel_name)

    log.info(f"Verwerken: {channel_name} | {video_type} | gepland {slot['scheduled_publish_at']}")

    # Mark as producing
    db.table("youtube_upload_queue").update({
        "status": "uploading",
        "upload_started_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", slot_id).execute()

    cmd = [PYTHON, PRODUCER, "--channel", channel_name, "--type", video_type]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode == 0:
            # Extract youtube_id from last JSON line
            yt_id = ""
            for line in reversed(result.stdout.splitlines()):
                line = line.strip()
                if '"youtube_id"' in line:
                    import json
                    try:
                        data = json.loads(line if line.startswith("{") else "{" + line.split("{",1)[-1])
                        yt_id = data.get("youtube_id", "")
                    except Exception:
                        pass
                    break
                if '"url":' in line:
                    import re
                    m = re.search(r'watch\?v=([A-Za-z0-9_-]+)', line)
                    if m: yt_id = m.group(1)
                    break

            # Parse full stdout for JSON output block
            import json, re
            stdout = result.stdout
            json_match = re.search(r'\{[^{}]*"youtube_id"[^{}]*\}', stdout, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group())
                    yt_id = data.get("youtube_id", yt_id)
                except Exception:
                    pass

            db.table("youtube_upload_queue").update({
                "status": "uploaded",
                "upload_finished_at": datetime.now(timezone.utc).isoformat(),
                "youtube_video_id": yt_id or None,
                "youtube_url": f"https://youtube.com/watch?v={yt_id}" if yt_id else None,
            }).eq("id", slot_id).execute()
            log.info(f"✅ Klaar: {channel_name} → {yt_id or '(geen id)'}")

        else:
            err = (result.stderr or result.stdout)[-300:]
            retry = (slot.get("retry_count") or 0) + 1
            new_status = "failed" if retry >= 3 else "planned"
            db.table("youtube_upload_queue").update({
                "status": new_status,
                "last_error": err,
                "retry_count": retry,
            }).eq("id", slot_id).execute()
            log.error(f"❌ Mislukt ({retry}/3): {channel_name}\n{err}")

    except subprocess.TimeoutExpired:
        db.table("youtube_upload_queue").update({
            "status": "failed",
            "last_error": "Timeout na 600s",
        }).eq("id", slot_id).execute()
        log.error(f"❌ Timeout: {channel_name}")

def run_cycle():
    db = get_db()

    # Refresh tokens elke cycle
    try:
        refresh_tokens()
    except Exception as e:
        log.warning(f"Token refresh cycle fout: {e}")

    slots = get_due_slots(db)
    if not slots:
        log.info("Geen due slots")
        return

    log.info(f"{len(slots)} slot(s) te verwerken")

    # Haal channel namen op
    channel_ids = list({s["channel_id"] for s in slots})
    ch_res = db.table("youtube_channels").select("id,name").in_("id", channel_ids).execute()
    id_to_name = {ch["id"]: ch["name"] for ch in (ch_res.data or [])}

    for slot in slots:
        channel_name = id_to_name.get(slot["channel_id"], "")
        if not channel_name:
            log.warning(f"Kanaal niet gevonden voor slot {slot['id']}")
            continue
        try:
            process_slot(slot, channel_name, db)
        except Exception as e:
            log.error(f"Fout bij slot {slot['id']}: {e}")

def main():
    log.info("Queue processor gestart")
    log.info(f"Check interval: {CHECK_INTERVAL}s | Window: {WINDOW_MINUTES}min | Python: {PYTHON}")

    while True:
        try:
            run_cycle()
        except Exception as e:
            log.error(f"Cycle fout: {e}")
        log.info(f"Volgende check over {CHECK_INTERVAL}s")
        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main()

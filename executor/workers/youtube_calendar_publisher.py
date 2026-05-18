from __future__ import annotations
"""
YouTube Calendar Publisher.
Bewaakt yt_content_calendar en maakt upload_jobs aan voor entries waarvan
de publish_date is bereikt en het videobestand beschikbaar is.

Detecteert ook gemiste tijdsloten en stuurt Telegram-alerts.
Draait elke 10 minuten via APScheduler.
"""

import logging
from datetime import datetime, timezone, timedelta, date

from db import get_db

logger = logging.getLogger(__name__)

AGENT_ID = "youtube-calendar-publisher"

# Status die als "klaar voor upload" telt
READY_STATUSES = ("produced",)

# Status die als "al verwerkt" telt (geen actie nodig)
DONE_STATUSES = ("queued", "uploaded", "published", "cancelled", "missed")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return date.today().isoformat()


def _yesterday() -> str:
    return (date.today() - timedelta(days=1)).isoformat()


async def _send_telegram(message: str) -> None:
    try:
        from telegram import send_youtube
        await send_youtube(message)
    except Exception as e:
        logger.warning(f"Telegram versturen mislukt: {e}")


def _job_exists_for_calendar(db, calendar_id: str) -> bool:
    """True als er al een actieve upload_job is voor dit calendar-item."""
    try:
        res = db.table("youtube_upload_jobs").select("id").eq(
            "workflow_id", calendar_id
        ).in_("status", ["queued", "uploading", "verifying", "success"]).execute()
        return bool(res.data)
    except Exception:
        return False


def _create_upload_job(db, entry: dict) -> str | None:
    """Maakt een upload_job aan voor een calendar-item. Geeft job-id terug."""
    try:
        res = db.table("youtube_upload_jobs").insert({
            "channel_id":     entry["channel_id"],
            "video_path":     entry["video_path"],
            "title":          entry["title"],
            "description":    entry.get("description", ""),
            "tags":           entry.get("tags") or [],
            "privacy_status": "public",
            "workflow_id":    entry["id"],
            "status":         "queued",
        }).execute()
        job_id = (res.data or [{}])[0].get("id")
        return job_id
    except Exception as e:
        logger.error(f"Upload_job aanmaken mislukt voor {entry['id']}: {e}")
        return None


def _get_channel_name(db, channel_id: str) -> str:
    try:
        res = db.table("youtube_channels").select("name").eq("id", channel_id).maybe_single().execute()
        return (res.data or {}).get("name", "?")
    except Exception:
        return "?"


async def run_calendar_publisher() -> dict:
    """
    1. Detecteer overdue entries (publish_date < vandaag, nog niet verwerkt) → Telegram-alert.
    2. Maak upload_jobs aan voor entries met publish_date <= vandaag en video_path beschikbaar.
    3. Log entries die 'produced' zijn maar geen video_path hebben.
    Returns: summary dict.
    """
    db     = get_db()
    today  = _today()
    result = {"overdue_alerts": 0, "jobs_created": 0, "missing_video": 0, "errors": 0}

    # ── 1. Overdue entries detecteren ────────────────────────────────────────
    try:
        overdue_res = db.table("yt_content_calendar").select(
            "id,channel_id,title,publish_date,status,video_type"
        ).lt("publish_date", today).not_.in_("status", list(DONE_STATUSES)).execute()
        overdue = overdue_res.data or []
    except Exception as e:
        logger.error(f"Overdue query mislukt: {e}")
        overdue = []

    for entry in overdue:
        ch_name  = _get_channel_name(db, entry["channel_id"])
        pub_date = entry.get("publish_date", "?")
        title    = entry.get("title", "?")
        vtype    = entry.get("video_type", "?")

        logger.warning(f"Gemist tijdslot: [{ch_name}] {title} ({pub_date})")

        import asyncio
        asyncio.create_task(_send_telegram(
            f"⏰ *Gemist tijdslot*\n"
            f"📺 {ch_name}\n"
            f"🎬 {title}\n"
            f"📅 Gepland: {pub_date} | Type: {vtype}\n"
            f"⚠️ Status: {entry.get('status', '?')} — geen upload_job aangemaakt"
        ))

        try:
            db.table("yt_content_calendar").update({
                "status":     "missed",
                "updated_at": _now(),
            }).eq("id", entry["id"]).execute()
        except Exception as e:
            logger.warning(f"Status → missed update mislukt voor {entry['id']}: {e}")

        result["overdue_alerts"] += 1

    # ── 2. Klaar-voor-upload entries ophalen (publish_date <= vandaag) ────────
    try:
        ready_res = db.table("yt_content_calendar").select("*").lte(
            "publish_date", today
        ).in_("status", list(READY_STATUSES)).execute()
        ready = ready_res.data or []
    except Exception as e:
        logger.error(f"Ready-to-publish query mislukt: {e}")
        ready = []

    for entry in ready:
        cal_id  = entry["id"]
        title   = entry.get("title", "?")
        ch_name = _get_channel_name(db, entry["channel_id"])

        # Controleer of er al een job is
        if _job_exists_for_calendar(db, cal_id):
            logger.info(f"Upload_job bestaat al voor: {title}")
            try:
                db.table("yt_content_calendar").update({"status": "queued"}).eq("id", cal_id).execute()
            except Exception:
                pass
            continue

        # Controleer video_path
        video_path = entry.get("video_path")
        if not video_path:
            logger.warning(f"Geen video_path voor kalender-item '{title}' ({cal_id}) — video nog produceren")
            import asyncio
            asyncio.create_task(_send_telegram(
                f"⚠️ *Video niet klaar voor upload*\n"
                f"📺 {ch_name}\n"
                f"🎬 {title}\n"
                f"📅 Gepland: {entry.get('publish_date')}\n"
                f"❌ Geen video_path in database — productie nog niet voltooid of bestand niet opgeslagen"
            ))
            result["missing_video"] += 1
            continue

        # Job aanmaken
        job_id = _create_upload_job(db, entry)
        if not job_id:
            result["errors"] += 1
            continue

        # Calendar status bijwerken
        try:
            db.table("yt_content_calendar").update({
                "status":        "queued",
                "upload_job_id": job_id,
                "updated_at":    _now(),
            }).eq("id", cal_id).execute()
        except Exception as e:
            logger.warning(f"Calendar status update mislukt voor {cal_id}: {e}")

        logger.info(f"Upload_job aangemaakt: [{ch_name}] {title} → job {job_id}")
        result["jobs_created"] += 1

    if result["jobs_created"] > 0 or result["overdue_alerts"] > 0:
        logger.info(
            f"Calendar publisher: {result['jobs_created']} jobs aangemaakt, "
            f"{result['overdue_alerts']} alerts, {result['missing_video']} zonder video"
        )

    return result


async def check_upcoming_slots(lookahead_minutes: int = 30) -> None:
    """
    Stuur een Telegram-herinnering voor video's die binnen `lookahead_minutes`
    gepland staan maar nog geen video_path hebben.
    """
    db    = get_db()
    today = _today()

    try:
        res = db.table("yt_content_calendar").select(
            "id,channel_id,title,publish_date,video_type,status,video_path"
        ).eq("publish_date", today).not_.in_("status", list(DONE_STATUSES)).execute()
        entries = res.data or []
    except Exception as e:
        logger.error(f"Upcoming-slot check mislukt: {e}")
        return

    for entry in entries:
        if entry.get("video_path"):
            continue  # klaar, geen actie nodig

        ch_name = _get_channel_name(db, entry["channel_id"])
        import asyncio
        asyncio.create_task(_send_telegram(
            f"📣 *Vandaag te publiceren — geen video*\n"
            f"📺 {ch_name}\n"
            f"🎬 {entry.get('title', '?')}\n"
            f"📅 Geplande datum: {entry.get('publish_date')}\n"
            f"⚡ Produceer video en sla video_path op in yt_content_calendar"
        ))

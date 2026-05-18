#!/usr/bin/env python3
"""
YouTube Production Pipeline — NL + EN kanalen
Stap 1: Script genereren via Claude
Stap 2: Video produceren via macOS say + PIL + MoviePy
Stap 3: Upload via YouTube API

Gebruik:
  python3 nl_produce_and_upload.py --channel VermogenTv --type short
  python3 nl_produce_and_upload.py --channel PropertyInvestorTv --type long
"""
from __future__ import annotations
import os, sys, re, json, subprocess, tempfile, textwrap, argparse, logging, uuid, time
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import anthropic
from supabase import create_client
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

OUTPUT_DIR = Path("/tmp/nl_videos")
OUTPUT_DIR.mkdir(exist_ok=True)

NAVY  = (8,  20, 35)
GOLD  = (212, 175, 55)
WHITE = (255, 255, 255)

CHANNEL_CONFIG = {
    # NL kanalen — stem: Xander (NL male), snelheid 160 wpm
    "VermogenTv":     {"lang": "nl", "voice": "Xander", "rate": 160, "color": (99, 102, 241),  "handle": "@VermogenTv",         "topic": "vermogensopbouw, investeren, passief inkomen"},
    "SpaarTv":        {"lang": "nl", "voice": "Xander", "rate": 160, "color": (16, 185, 129),   "handle": "@SpaarTv",            "topic": "sparen, rente, financiele vrijheid"},
    "VastgoedTv":     {"lang": "nl", "voice": "Xander", "rate": 160, "color": (14, 165, 233),   "handle": "@VastgoedTv",         "topic": "vastgoed beleggen, huurwoningen, rendement"},
    "CryptoVermogen": {"lang": "nl", "voice": "Xander", "rate": 160, "color": (245, 158, 11),   "handle": "@CryptoVermogen",     "topic": "crypto, bitcoin, blockchain, digitale assets"},
    "BeleggingsTv":   {"lang": "nl", "voice": "Xander", "rate": 160, "color": (139, 92, 246),   "handle": "@BeleggingsTv",       "topic": "aandelen, ETF, beleggen, dividenden"},
    # EN kanaal — stem: Daniel (British English male), snelheid 165 wpm
    "PropertyInvestorTv": {"lang": "en", "voice": "Daniel", "rate": 165, "color": (236, 72, 153), "handle": "@property_investor_tv", "topic": "property investment, UK real estate, BRRRR, HMO yields, rental income"},
}


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def get_channel(name: str) -> dict:
    db = get_db()
    res = db.table("youtube_channels").select("*").eq("name", name).single().execute()
    if not res.data:
        raise ValueError(f"Kanaal '{name}' niet gevonden in DB")
    return res.data


# ── Script genereren ──────────────────────────────────────────────────────────

NL_SHORT_SYSTEM = """Je bent een professionele YouTube scriptschrijver voor NL finance kanalen.
Stijl: direct, energiek, cijfers-gedreven, Nederlandstalig. Geen Engelse termen tenzij gangbaar (ETF, ROI, crypto).
Scripts zijn voor gesproken delivery — korte zinnen, geen opsommingen in de body.
Schrijf altijd een sterke HOOK in de eerste zin die direct de kijker pakt."""

NL_LONG_SYSTEM = """Je bent een professionele YouTube scriptschrijver voor NL finance kanalen.
Stijl: autoriteit, data-gedreven, educatief maar toegankelijk. Nederlandstalig.
Gebruik concrete cijfers, percentages en Nederlandse voorbeelden.
Scripts zijn voor gesproken delivery — verhalend, geen bullet-points."""

EN_SHORT_SYSTEM = """You are a professional YouTube Shorts scriptwriter for a UK/EU property investment channel.
Tone: authoritative, data-driven, calm British delivery. No American slang.
45-60 seconds, ~130 words. Open with a shocking stat or bold claim. End with a strong CTA.
Spoken delivery only — natural sentences, no bullet points."""

EN_LONG_SYSTEM = """You are a professional YouTube scriptwriter for Property Investor TV, covering UK, EU and US real estate.
Tone: authoritative, calm, backed by facts and numbers. British English. No American slang.
8-12 minutes (~1500 words). Structured sections using ## headers. Spoken delivery — no bullet lists in body."""


def generate_script(channel: str, video_type: str, title: str) -> tuple[str, str]:
    """Returns (title, script_text)"""
    cfg = CHANNEL_CONFIG[channel]
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    is_en = cfg["lang"] == "en"

    if video_type == "short":
        if is_en:
            prompt = f"""Write a YouTube Short script (45-60 seconds, ~130 words) for {channel}.
Topic: {cfg['topic']}
Title: {title}

Structure:
HOOK (first 3 seconds — shocking stat or bold question)
BODY (3-4 sentences with hard numbers)
CTA (subscribe + next video teaser)

Spoken text only — no stage directions or brackets."""
            system = EN_SHORT_SYSTEM
        else:
            prompt = f"""Schrijf een YouTube Short script (45-60 seconden, ~130 woorden) voor {channel}.
Onderwerp: {cfg['topic']}
Titel: {title}

Format:
HOOK (eerste 3 seconden — shockerende stat of vraag)
BODY (kern, 3-4 zinnen met feiten/cijfers)
CTA (abonneer + volgende video)

Schrijf ALLEEN de gesproken tekst, geen stage directions."""
            system = NL_SHORT_SYSTEM
    else:
        if is_en:
            prompt = f"""Write a complete YouTube video script (8-12 minutes, ~1500 words) for {channel}.
Topic: {cfg['topic']}
Title: {title}

Structure:
## INTRODUCTION (hook + what viewers will learn)
## [SECTION 1 — core topic]
## [SECTION 2 — data & analysis]
## [SECTION 3 — practical steps]
## [SECTION 4 — risks & nuance]
## CONCLUSION + CTA

Spoken text only. Use ## for section headers."""
            system = EN_LONG_SYSTEM
        else:
            prompt = f"""Schrijf een volledig YouTube video script (8-12 minuten, ~1400-1700 woorden) voor {channel}.
Onderwerp: {cfg['topic']}
Titel: {title}

Structuur:
## INTRODUCTIE (hook + wat de kijker gaat leren)
## [SECTIE 1 — kern onderwerp]
## [SECTIE 2 — diepgang / cijfers]
## [SECTIE 3 — praktische toepassing]
## [SECTIE 4 — risico's / nuance]
## CONCLUSIE + CTA

Schrijf ALLEEN de gesproken tekst. Gebruik ## als sectieheaders."""
            system = NL_LONG_SYSTEM

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2500,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return title, msg.content[0].text


def pick_title(channel: str, video_type: str) -> str:
    cfg = CHANNEL_CONFIG[channel]
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    is_en = cfg["lang"] == "en"
    if is_en:
        user_msg = (
            f"Give 1 punchy YouTube {'Short' if video_type=='short' else 'video'} title for {channel} "
            f"({cfg['topic']}). Date: {datetime.now().strftime('%B %Y')}. "
            f"Max 70 chars. Title only, no quotes."
        )
    else:
        user_msg = (
            f"Geef 1 pakkende YouTube {'Short' if video_type=='short' else 'video'} titel voor {channel} ({cfg['topic']}). "
            f"Vandaag: {datetime.now().strftime('%B %Y')}. Max 70 tekens. Alleen de titel, geen aanhalingstekens."
        )
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[{"role": "user", "content": user_msg}],
    )
    return msg.content[0].text.strip().strip('"')


# ── TTS ───────────────────────────────────────────────────────────────────────

def text_to_audio(text: str, output_path: Path, voice: str = "Xander", rate: int = 160) -> Path:
    clean = re.sub(r'##\s*', '', text)
    clean = re.sub(r'\*+', '', clean)
    clean = re.sub(r'\[.*?\]', '', clean)
    clean = clean.strip()

    aiff = output_path.with_suffix(".aiff")
    subprocess.run(["say", "-v", voice, "-r", str(rate), "-o", str(aiff), clean],
                   check=True, capture_output=True)

    ffmpeg = "/opt/homebrew/bin/ffmpeg"
    subprocess.run([ffmpeg, "-y", "-i", str(aiff), "-c:a", "aac", "-b:a", "192k", str(output_path)],
                   check=True, capture_output=True)
    aiff.unlink(missing_ok=True)
    return output_path


# ── Frame generators ──────────────────────────────────────────────────────────

def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for p in ["/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Arial.ttf"]:
        try:
            return ImageFont.truetype(p, size, index=1 if bold else 0)
        except Exception:
            continue
    return ImageFont.load_default()


def make_short_frame(channel: str, headline: str, body: str = "", progress: float = 0.0) -> np.ndarray:
    W, H = 1080, 1920
    cfg = CHANNEL_CONFIG[channel]
    accent = cfg["color"]
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)

    # Accent bar top
    d.rectangle([0, 0, W, 10], fill=accent)
    d.rectangle([0, H-10, W, H], fill=accent)

    # Grid
    for x in range(0, W, 108):
        d.line([(x,0),(x,H)], fill=(20,38,58), width=1)

    # Channel name top
    ch_font = load_font(32, bold=True)
    d.text((W//2, 55), channel, font=ch_font, fill=WHITE, anchor="mm")
    d.rectangle([W//2 - 160, 78, W//2 + 160, 80], fill=accent)

    # Headline center
    f_size = 96 if len(headline) < 25 else (76 if len(headline) < 40 else 60)
    f_head = load_font(f_size, bold=True)
    lines = textwrap.wrap(headline, width=15 if f_size > 80 else 20)
    y = H//2 - len(lines)*55
    for line in lines[:5]:
        d.text((W//2, y), line, font=f_head, fill=WHITE, anchor="mm")
        y += f_size + 12

    # Body
    if body:
        f_body = load_font(38)
        y += 20
        for line in textwrap.wrap(body[:120], 24)[:3]:
            d.text((W//2, y), line, font=f_body, fill=tuple(min(255, c+100) for c in NAVY), anchor="mm")
            y += 50

    # Progress bar
    d.rectangle([0, H-30, int(W*progress), H-20], fill=accent)

    # CTA
    cta_word = "Subscribe" if cfg.get("lang") == "en" else "Abonneer"
    d.text((W//2, H-62), f"▶  {cta_word}  •  {cfg['handle']}", font=load_font(26), fill=WHITE, anchor="mm")

    return np.array(img)


def make_long_frame(channel: str, section_title: str, body: str = "", chapter: str = "") -> np.ndarray:
    W, H = 1920, 1080
    cfg = CHANNEL_CONFIG[channel]
    accent = cfg["color"]
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, W, 10], fill=accent)
    d.rectangle([0, H-10, W, H], fill=accent)

    for x in range(0, W, 192):
        d.line([(x,0),(x,H)], fill=(18,34,54), width=1)

    # Logo
    d.text((80, 54), channel, font=load_font(36, bold=True), fill=WHITE)
    d.rectangle([80, 100, 80+len(channel)*20, 102], fill=accent)

    # Chapter badge
    if chapter:
        cf = load_font(18)
        cw = int(d.textlength(chapter, font=cf)) + 32
        d.rectangle([W-cw-50, 46, W-50, 74], fill=accent)
        d.text((W-cw-34, 50), chapter, font=cf, fill=NAVY)

    # Section title
    f = load_font(72 if len(section_title) < 35 else 54, bold=True)
    y = 180
    for line in textwrap.wrap(section_title, 36)[:3]:
        d.text((80, y), line, font=f, fill=WHITE)
        y += 84

    # Body
    if body:
        f_b = load_font(34)
        y += 20
        for line in textwrap.wrap(body[:250], 60)[:5]:
            d.text((80, y), line, font=f_b, fill=(200, 210, 230))
            y += 46

    return np.array(img)


# ── Video builders ────────────────────────────────────────────────────────────

def build_short(channel: str, title: str, script: str, out: Path, voice: str = "Xander", rate: int = 160) -> Path:
    log.info(f"Short bouwen: {title}")
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', re.sub(r'##\s*', '', script)) if len(s.strip()) > 8]

    audio_path = out.with_suffix(".m4a")
    text_to_audio(script, audio_path, voice=voice, rate=rate)
    audio = AudioFileClip(str(audio_path))
    total = audio.duration

    clips = []
    t = 0.0
    wpm = rate / 60
    for i, sent in enumerate(sentences[:15]):
        dur = max(1.2, len(sent.split()) / wpm)
        if t + dur > total: dur = max(0.3, total - t)
        frame = make_short_frame(channel, title if i == 0 else sent[:55], progress=t/max(total,1))
        clips.append(ImageClip(frame, duration=dur))
        t += dur
        if t >= total: break

    video = concatenate_videoclips(clips).set_audio(audio)
    os.environ["FFMPEG_BINARY"] = "/opt/homebrew/bin/ffmpeg"
    video.write_videofile(str(out), fps=24, codec="libx264", audio_codec="aac",
                          ffmpeg_params=["-crf","22"], logger=None)
    audio_path.unlink(missing_ok=True)
    log.info(f"✓ Short klaar: {out} ({total:.0f}s)")
    return out


def build_long(channel: str, title: str, script: str, out: Path, voice: str = "Xander", rate: int = 160) -> Path:
    log.info(f"Long-form bouwen: {title}")
    sections = []
    cur_title, cur_body = "Introductie", []
    for line in script.split('\n'):
        line = line.strip()
        if not line: continue
        if re.match(r'^##\s+', line):
            if cur_body: sections.append({"title": cur_title, "body": ' '.join(cur_body)})
            cur_title = re.sub(r'^#+\s*', '', line)
            cur_body = []
        elif not line.startswith('[') and len(line) > 20:
            cur_body.append(line)
    if cur_body: sections.append({"title": cur_title, "body": ' '.join(cur_body)})

    clips = []
    for i, sec in enumerate(sections[:8]):
        body_clean = re.sub(r'\*+', '', sec["body"])
        if len(body_clean) < 20: continue
        with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as tf:
            ap = Path(tf.name)
        text_to_audio(body_clean, ap, voice=voice, rate=rate)
        audio = AudioFileClip(str(ap))
        dur = audio.duration

        title_frame = make_long_frame(channel, sec["title"], chapter=f"DEEL {i+1:02d}")
        body_frame  = make_long_frame(channel, sec["title"], body=body_clean[:200], chapter=f"DEEL {i+1:02d}")
        title_dur = min(2.5, dur * 0.12)
        sec_video = concatenate_videoclips([
            ImageClip(title_frame, duration=title_dur),
            ImageClip(body_frame, duration=max(0.5, dur-title_dur)),
        ]).set_audio(audio)
        clips.append(sec_video)
        ap.unlink(missing_ok=True)
        log.info(f"  Deel {i+1}: {sec['title'][:50]} ({dur:.0f}s)")

    full = concatenate_videoclips(clips)
    os.environ["FFMPEG_BINARY"] = "/opt/homebrew/bin/ffmpeg"
    full.write_videofile(str(out), fps=24, codec="libx264", audio_codec="aac",
                         ffmpeg_params=["-crf","20"], logger=None)
    log.info(f"✓ Long klaar: {out} ({full.duration:.0f}s)")
    return out


# ── YouTube upload ────────────────────────────────────────────────────────────

def get_youtube_service(channel_id: str):
    db = get_db()
    ch = db.table("youtube_channels").select("access_token,refresh_token,token_expires").eq("id", channel_id).single().execute().data
    if not ch or not ch.get("access_token"):
        raise RuntimeError(f"Geen token voor channel {channel_id}")

    creds = Credentials(
        token=ch["access_token"],
        refresh_token=ch.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("YOUTUBE_CLIENT_ID"),
        client_secret=os.getenv("YOUTUBE_CLIENT_SECRET"),
    )
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def upload_to_youtube(channel_id: str, video_path: Path, title: str, description: str, tags: list[str], is_short: bool) -> str:
    service = get_youtube_service(channel_id)
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": "22",
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(str(video_path), mimetype="video/mp4", chunksize=2*1024*1024, resumable=True)
    req = service.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    retries = 0
    while response is None:
        try:
            _, response = req.next_chunk()
        except Exception as e:
            if retries < 3:
                retries += 1
                time.sleep(2 ** retries)
            else:
                raise
    return response.get("id", "")


# ── Main ──────────────────────────────────────────────────────────────────────

def run(channel_name: str, video_type: str):
    db = get_db()
    cfg = CHANNEL_CONFIG.get(channel_name)
    if not cfg:
        raise ValueError(f"Onbekend kanaal: {channel_name}. Kies uit: {list(CHANNEL_CONFIG)}")

    ch = get_channel(channel_name)
    channel_id = ch["id"]
    log.info(f"Kanaal: {channel_name} ({channel_id})")

    # 1. Script genereren
    log.info("Script genereren via Claude...")
    title = pick_title(channel_name, video_type)
    log.info(f"Titel: {title}")
    _, script = generate_script(channel_name, video_type, title)
    log.info(f"Script: {len(script.split())} woorden")

    # 2. Video produceren
    safe = "".join(c for c in title[:40] if c.isalnum() or c in " -_").strip().replace(" ", "_")
    out = OUTPUT_DIR / f"{channel_name}_{safe}_{video_type}.mp4"

    if video_type == "short":
        build_short(channel_name, title, script, out, voice=cfg["voice"], rate=cfg["rate"])
    else:
        build_long(channel_name, title, script, out, voice=cfg["voice"], rate=cfg["rate"])

    log.info(f"Video: {out} ({out.stat().st_size // 1024}KB)")

    # 3. Content calendar + script opslaan
    cal_id = str(uuid.uuid4())
    db.table("yt_content_calendar").insert({
        "id":          cal_id,
        "channel_id":  channel_id,
        "title":       title,
        "video_type":  video_type,
        "publish_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "status":      "produced",
        "video_path":  str(out),
    }).execute()
    db.table("yt_scripts").insert({
        "id": str(uuid.uuid4()),
        "calendar_id": cal_id,
        "script_text": script,
        "word_count": len(script.split()),
        "status": "used",
    }).execute()

    # 4. Uploaden
    log.info("Uploaden naar YouTube...")
    if cfg["lang"] == "en":
        tags = [channel_name, cfg["topic"][:30], "property investment", "real estate", "2026", "UK property"]
        description = f"{title}\n\n{cfg['topic'].capitalize()}\n\n{cfg['handle']}\n\n#property #realestate #propertyinvestment"
    else:
        tags = [channel_name, cfg["topic"][:30], "Nederland", "investeren", "2026",
                "vermogen" if "Vermogen" in channel_name else "finance"]
        description = f"{title}\n\n{cfg['topic'].capitalize()}\n\n{cfg['handle']}\n\n#finance #investeren #Nederland"

    yt_id = upload_to_youtube(channel_id, out, title, description, tags, video_type == "short")
    log.info(f"✅ Upload geslaagd: https://youtube.com/watch?v={yt_id}")

    # 5. DB bijwerken
    db.table("youtube_channels").update({
        "last_upload_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", channel_id).execute()

    # Calendar entry markeren als gepubliceerd (zodat calendar_publisher niet opnieuw triggert)
    db.table("yt_content_calendar").update({
        "status": "published",
    }).eq("id", cal_id).execute()

    db.table("youtube_videos").insert({
        "id": str(uuid.uuid4()),
        "video_id": yt_id,
        "channel_id": channel_id,
        "youtube_video_id": yt_id,
        "title": title,
        "description": description,
        "tags": tags,
        "upload_status": "published",
        "privacy_status": "public",
        "is_short": video_type == "short",
        "published_at": datetime.now(timezone.utc).isoformat(),
        "thumbnail_url": f"https://i.ytimg.com/vi/{yt_id}/maxresdefault.jpg",
    }).execute()

    print(json.dumps({"ok": True, "channel": channel_name, "title": title,
                      "youtube_id": yt_id, "url": f"https://youtube.com/watch?v={yt_id}",
                      "file": str(out)}, indent=2, ensure_ascii=False))
    return yt_id


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel", default="VermogenTv", choices=list(CHANNEL_CONFIG))
    parser.add_argument("--type", default="short", choices=["short", "long"])
    args = parser.parse_args()
    run(args.channel, args.type)

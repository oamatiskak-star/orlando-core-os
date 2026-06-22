/**
 * One-shot: publiceer ALLEEN de overdue private video's van de FINANCE-kanalen
 * (niet de loop-kanalen BrickPulse/LoopForge/SliceTheory). Gescopete variant van
 * publish-overdue.ts → de Aquier-funnel-kanalen.
 * Run: npx ts-node --transpile-only src/publish-overdue-finance.ts
 */
import "dotenv/config";
import { getSupabase } from "./lib/supabase";
import { buildOAuthClient, setVideoPublic } from "./lib/youtube-api";

const FINANCE_CHANNELS = [
  "VermogenTv", "SpaarTv", "VastgoedTv", "CryptoVermogen", "BeleggingsTv",
  "AquierTv", "AquierNL", "AquierTvEs", "PropertyInvestorTv",
];

async function main() {
  const db = getSupabase();

  const { data: chans } = await db
    .from("youtube_channels").select("id, name").in("name", FINANCE_CHANNELS);
  const financeIds = (chans ?? []).map((c) => c.id);
  if (financeIds.length === 0) { console.log("Geen finance-kanalen gevonden."); process.exit(0); }

  const { data: overdue, error } = await db
    .from("youtube_upload_queue")
    .select("id, video_id, channel_id, youtube_video_id")
    .in("status", ["uploaded_pending_processing", "verified_live", "verifying", "manual_review_required"])
    .not("youtube_video_id", "is", null)
    .in("channel_id", financeIds)
    .lte("scheduled_publish_at", new Date().toISOString());

  if (error) { console.error("Supabase error:", error.message); process.exit(1); }
  if (!overdue || overdue.length === 0) { console.log("Geen overdue finance-items."); process.exit(0); }

  const videoIds = overdue.map((i) => i.video_id);
  const { data: privateVideos } = await db
    .from("youtube_videos").select("id").in("id", videoIds).eq("privacy_status", "private");

  const privateSet = new Set((privateVideos ?? []).map((v) => v.id));
  const toPublish = overdue.filter((i) => privateSet.has(i.video_id));

  if (toPublish.length === 0) { console.log("Alle overdue finance-videos zijn al publiek."); process.exit(0); }

  console.log(`Publiceren: ${toPublish.length} overdue private finance-videos...`);

  for (const item of toPublish) {
    try {
      const { data: channel } = await db
        .from("youtube_channels").select("*").eq("id", item.channel_id).single();
      if (!channel?.refresh_token) { console.warn(`  x Geen OAuth-token voor kanaal ${item.channel_id}`); continue; }
      const auth = buildOAuthClient(channel);
      await setVideoPublic(auth, item.youtube_video_id);
      await db.from("youtube_videos").update({
        privacy_status: "public", status: "live", updated_at: new Date().toISOString(),
      }).eq("id", item.video_id);
      await db.from("youtube_upload_queue").update({
        status: "verified_live", updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      console.log(`  ok ${item.youtube_video_id} - publiek`);
    } catch (err) {
      console.error(`  x ${item.youtube_video_id}: ${(err as Error).message}`);
    }
  }
  console.log("Klaar.");
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
